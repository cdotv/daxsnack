import hashlib
import hmac
import json
import time
from html import escape

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django_ratelimit.decorators import ratelimit

from core.mail_delivery import build_multipart_message
from core.models import Subscription
from core.privacy import subscriber_log_id
from core.setup_provider import load_home_payload
from core.site_profile import get_site_profile
from core.subscription_tokens import (
    SubscriptionTokenError,
    build_confirmation_link,
    read_subscription_token,
)


def _ratelimit_key_global(group, request):
    return "global"


def _ratelimit_key_email(group, request):
    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}
        email = str(data.get("email") or "").strip().lower()
    except (UnicodeDecodeError, json.JSONDecodeError):
        email = ""
    digest = hashlib.sha256(email.encode("utf-8")).hexdigest()[:20]
    return f"email:{digest}" if email else "email:missing"


def _ratelimited_response():
    response = JsonResponse({"ok": False, "error": "Too many requests."}, status=429)
    response["Retry-After"] = "60"
    response["Cache-Control"] = "no-store"
    return response


def _parse_json_body(request) -> dict:
    try:
        value = json.loads(request.body.decode("utf-8")) if request.body else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _build_time_trap_token(purpose: str, timestamp: int) -> str:
    message = f"{purpose}:{timestamp}".encode("utf-8")
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256
    ).hexdigest()


@never_cache
@ensure_csrf_cookie
def form_tokens(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    timestamp = int(time.time())
    return JsonResponse(
        {
            "ts": timestamp,
            "contact": {
                "ts": timestamp,
                "ttoken": _build_time_trap_token("contact-v1", timestamp),
            },
            "subscribe": {
                "ts": timestamp,
                "ttoken": _build_time_trap_token("subscribe-v1", timestamp),
            },
        }
    )


@ensure_csrf_cookie
def best_trade(request):
    payload = load_home_payload(request)
    site_profile = get_site_profile()
    show_total = bool(getattr(settings, "SHOW_ACCOUNT_TOTAL_PERFORMANCE", False))
    show_annual = bool(getattr(settings, "SHOW_EST_ANNUAL_RETURN", False))
    total_delta = payload.get("account_total_delta_pct")
    annual_return = payload.get("est_annual_return_pct")
    return render(
        request,
        "index.html",
        {
            "contact_ts": "",
            "contact_sig": "",
            "subscribe_ts": "",
            "subscribe_sig": "",
            "account_total_delta_pct": total_delta,
            "show_account_total_performance": show_total,
            "show_est_annual_return": show_annual,
            "show_account_summary": (show_total and total_delta is not None)
            or (show_annual and annual_return is not None),
            "est_annual_return_pct": annual_return,
            "version_display": payload.get("version_display"),
            "site_profile": site_profile,
            "frontend_data": {
                "injectedSetup": payload.get("setup_payload"),
                "injectedDaySetups": payload.get("day_setups_payload"),
                "capitalCheck": payload.get("capital_check"),
                "injectedRunning": {"items": payload.get("running_items") or []},
                "injectedClosed": {"items": payload.get("closed_items") or []},
                "injectedPublicActivity": payload.get("public_activity")
                or {"items": []},
                "injectedInstrumentStats": payload.get("instrument_stats"),
                "injectedBenchmarkRanking": payload.get("benchmark_ranking") or [],
                "benchmarkSnapshotUrl": "/api/live/benchmarks/",
                "openTradesSnapshotUrl": "/api/live/open-trades/",
                "accountTotalDeltaPct": total_delta,
                "siteProfile": site_profile,
            },
        },
    )


@never_cache
def benchmarks_snapshot(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    payload = load_home_payload(request)
    return JsonResponse({"items": payload.get("benchmark_ranking") or []})


@never_cache
def open_trades_snapshot(request):
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    payload = load_home_payload(request)
    return JsonResponse({"items": payload.get("running_items") or []})


def retired_sse_stream(request):
    return JsonResponse(
        {"error": "This endpoint has been replaced by snapshot polling."}, status=410
    )


@ratelimit(
    group="contact_email_hour",
    key=_ratelimit_key_email,
    rate="10/h",
    method="POST",
    block=False,
)
@ratelimit(
    group="contact_global_hour",
    key=_ratelimit_key_global,
    rate="100/h",
    method="POST",
    block=False,
)
def contact(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if getattr(request, "limited", False):
        return _ratelimited_response()
    data = _parse_json_body(request)
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip()
    message = str(data.get("message") or "").strip()
    if str(data.get("homepage") or data.get("hp") or "").strip():
        return JsonResponse({"ok": True})

    errors = {}
    if not name or len(name) > 200:
        errors["name"] = "Enter a valid name."
    try:
        validate_email(email)
    except ValidationError:
        errors["email"] = "Enter a valid email address."
    if not message or len(message) > 5000:
        errors["message"] = "Enter a valid message."
    if errors:
        return JsonResponse({"ok": False, "errors": errors}, status=400)

    recipient = str(settings.CONTACT_EMAIL or "").strip()
    if not recipient:
        return JsonResponse(
            {"ok": False, "error": "Contact is not configured."}, status=503
        )
    body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"
    try:
        send_mail(
            subject="Website contact",
            message=body,
            from_email=None,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception:
        return JsonResponse({"ok": False, "error": "Sending failed."}, status=500)
    return JsonResponse({"ok": True})


@ratelimit(
    group="subscribe_email_hour",
    key=_ratelimit_key_email,
    rate="3/h",
    method="POST",
    block=False,
)
@ratelimit(
    group="subscribe_global_hour",
    key=_ratelimit_key_global,
    rate="100/h",
    method="POST",
    block=False,
)
def subscribe(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if getattr(request, "limited", False):
        return _ratelimited_response()
    data = _parse_json_body(request)
    email = str(data.get("email") or "").strip().lower()
    if str(data.get("homepage") or "").strip():
        return JsonResponse({"ok": True})
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse(
            {"ok": False, "errors": {"email": "Enter a valid email address."}},
            status=400,
        )

    existing = Subscription.objects.filter(email=email).first()
    if existing is not None:
        return JsonResponse({"ok": True})
    subscription = Subscription.objects.create(
        email=email,
        is_active=False,
        confirmed_at=None,
        confirm_token_hash="",
        unsubscribe_token_hash="",
        language="de" if str(data.get("lang") or "").lower() == "de" else "en",
    )
    confirm_link = build_confirmation_link(subscription, settings.SITE_URL)
    safe_link = escape(confirm_link, quote=True)
    try:
        message = build_multipart_message(
            subject=f"Confirm your {get_site_profile()['name']} subscription",
            text=(
                "Confirm your email to receive setup notifications.\n\n"
                f"Confirm: {confirm_link}\n\n"
                "If you did not request this, ignore this email."
            ),
            html=(
                "<p>Confirm your email to receive setup notifications.</p>"
                f'<p><a href="{safe_link}">Confirm subscription</a></p>'
                "<p>If you did not request this, ignore this email.</p>"
            ),
            to=email,
        )
        message.send(fail_silently=False)
    except Exception:
        subscription.delete()
        return JsonResponse({"ok": False, "error": "Sending failed."}, status=500)
    return JsonResponse({"ok": True})


_SUBSCRIPTION_ACTION_COPY = {
    "en": {
        "home": "return to the open trading system",
        "invalid_title": "invalid link",
        "invalid_message": "this link is invalid or has expired.",
        "confirm_title": "confirm subscription",
        "confirm_message": "confirm that you want to receive setup notifications.",
        "confirm_button": "confirm subscription",
        "confirmed_title": "subscription confirmed",
        "confirmed_message": "you will receive future setup notifications.",
        "unsubscribe_title": "unsubscribe",
        "unsubscribe_message": "confirm that you no longer want to receive emails.",
        "unsubscribe_button": "unsubscribe",
        "unsubscribed_title": "unsubscribed",
        "unsubscribed_message": "you will no longer receive emails.",
    },
    "de": {
        "home": "zurueck zum offenen handelssystem",
        "invalid_title": "ungueltiger link",
        "invalid_message": "dieser link ist ungueltig oder abgelaufen.",
        "confirm_title": "abonnement bestaetigen",
        "confirm_message": "bestaetige den erhalt von setup-benachrichtigungen.",
        "confirm_button": "abonnement bestaetigen",
        "confirmed_title": "abonnement bestaetigt",
        "confirmed_message": "du erhaeltst kuenftige setup-benachrichtigungen.",
        "unsubscribe_title": "abmelden",
        "unsubscribe_message": "bestaetige, dass du keine e-mails mehr erhalten moechtest.",
        "unsubscribe_button": "abmelden",
        "unsubscribed_title": "abgemeldet",
        "unsubscribed_message": "du erhaeltst keine e-mails mehr.",
    },
}


def _subscription_action_response(
    request,
    *,
    language="en",
    title_key,
    message_key,
    status=200,
    form_action=None,
    button_key=None,
    token=None,
):
    language = language if language in _SUBSCRIPTION_ACTION_COPY else "en"
    copy = _SUBSCRIPTION_ACTION_COPY[language]
    response = render(
        request,
        "subscription_action.html",
        {
            "language": language,
            "title": copy[title_key],
            "message": copy[message_key],
            "home_label": copy["home"],
            "form_action": form_action,
            "button_label": copy.get(button_key) if button_key else None,
            "token": token,
            "site_profile": get_site_profile(),
        },
        status=status,
    )
    response["Cache-Control"] = "no-store"
    response["Referrer-Policy"] = "origin"
    response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


def _subscription_from_token(token, purpose):
    try:
        claims = read_subscription_token(token, purpose)
    except SubscriptionTokenError:
        return None
    return Subscription.objects.filter(pk=claims["subscription_id"]).first()


def _subscription_token_from_request(request):
    source = request.POST if request.method == "POST" else request.GET
    return str(source.get("t") or "").strip()


@never_cache
def confirm_subscribe(request):
    if request.method not in {"GET", "POST"}:
        return HttpResponse(status=405, headers={"Allow": "GET, POST"})
    token = _subscription_token_from_request(request)
    subscription = _subscription_from_token(token, "confirm") if token else None
    if subscription is None:
        return _subscription_action_response(
            request,
            title_key="invalid_title",
            message_key="invalid_message",
            status=400,
        )
    if request.method == "GET" and not subscription.is_active:
        return _subscription_action_response(
            request,
            language=subscription.language,
            title_key="confirm_title",
            message_key="confirm_message",
            form_action="/subscribe/confirm/",
            button_key="confirm_button",
            token=token,
        )
    if request.method == "POST" and not subscription.is_active:
        subscription.is_active = True
        subscription.confirmed_at = timezone.now()
        subscription.save(update_fields=["is_active", "confirmed_at"])
    return _subscription_action_response(
        request,
        language=subscription.language,
        title_key="confirmed_title",
        message_key="confirmed_message",
    )


@never_cache
def unsubscribe(request):
    if request.method not in {"GET", "POST"}:
        return HttpResponse(status=405, headers={"Allow": "GET, POST"})
    token = _subscription_token_from_request(request)
    subscription = _subscription_from_token(token, "unsubscribe") if token else None
    if subscription is None:
        return _subscription_action_response(
            request,
            title_key="invalid_title",
            message_key="invalid_message",
            status=400,
        )
    if request.method == "GET":
        return _subscription_action_response(
            request,
            language=subscription.language,
            title_key="unsubscribe_title",
            message_key="unsubscribe_message",
            form_action="/unsubscribe/",
            button_key="unsubscribe_button",
            token=token,
        )
    language = subscription.language
    log_identifier = subscriber_log_id(subscription.email)
    subscription.delete()
    print(f"[unsubscribe] removed {log_identifier}")
    return _subscription_action_response(
        request,
        language=language,
        title_key="unsubscribed_title",
        message_key="unsubscribed_message",
    )


@csrf_exempt
@never_cache
def unsubscribe_one_click(request):
    if request.method != "POST":
        return HttpResponse(status=405, headers={"Allow": "POST"})
    if request.POST.get("List-Unsubscribe") != "One-Click":
        return HttpResponse(status=400)
    token = str(request.GET.get("t") or "").strip()
    try:
        claims = read_subscription_token(token, "unsubscribe")
    except SubscriptionTokenError:
        return HttpResponse(status=400)
    Subscription.objects.filter(pk=claims["subscription_id"]).delete()
    return HttpResponse(status=204)
