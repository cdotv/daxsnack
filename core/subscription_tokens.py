from urllib.parse import urlencode

from django.conf import settings
from django.core import signing

CONFIRMATION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
_TOKEN_VERSION = 1
_TOKEN_CONFIG = {
    "confirm": {
        "salt": "open-trading-system.subscription.confirm.v1",
        "path": "/subscribe/confirm/",
        "max_age": CONFIRMATION_MAX_AGE_SECONDS,
    },
    "unsubscribe": {
        "salt": "open-trading-system.subscription.unsubscribe.v1",
        "path": "/unsubscribe/",
        "max_age": None,
    },
}


class SubscriptionTokenError(ValueError):
    pass


def _token_config(purpose):
    try:
        config = dict(_TOKEN_CONFIG[purpose])
    except KeyError as exc:
        raise SubscriptionTokenError("Unsupported subscription token purpose.") from exc
    configured_salts = getattr(settings, "SUBSCRIPTION_TOKEN_SALTS", {})
    if isinstance(configured_salts, dict):
        salt = str(configured_salts.get(purpose) or "").strip()
        if salt:
            config["salt"] = salt
    return config


def make_subscription_token(subscription, purpose):
    config = _token_config(purpose)
    if subscription.pk is None:
        raise SubscriptionTokenError(
            "Subscription must be saved before issuing a token."
        )
    payload = {
        "v": _TOKEN_VERSION,
        "p": purpose,
        "id": int(subscription.pk),
    }
    return signing.dumps(payload, salt=config["salt"], compress=True)


def read_subscription_token(token, purpose):
    config = _token_config(purpose)
    try:
        payload = signing.loads(
            str(token or ""),
            salt=config["salt"],
            max_age=config["max_age"],
        )
    except signing.BadSignature as exc:
        raise SubscriptionTokenError("Invalid or expired subscription token.") from exc

    if not isinstance(payload, dict):
        raise SubscriptionTokenError("Invalid subscription token payload.")
    if payload.get("v") != _TOKEN_VERSION or payload.get("p") != purpose:
        raise SubscriptionTokenError("Invalid subscription token purpose.")
    try:
        subscription_id = int(payload.get("id"))
    except (TypeError, ValueError) as exc:
        raise SubscriptionTokenError("Invalid subscription token identity.") from exc
    if subscription_id <= 0:
        raise SubscriptionTokenError("Invalid subscription token identity.")
    return {"subscription_id": subscription_id}


def build_subscription_link(subscription, purpose, site_url):
    config = _token_config(purpose)
    token = make_subscription_token(subscription, purpose)
    query = urlencode({"t": token})
    return f"{str(site_url or '').rstrip('/')}{config['path']}?{query}"


def build_confirmation_link(subscription, site_url):
    return build_subscription_link(subscription, "confirm", site_url)


def build_unsubscribe_link(subscription, site_url):
    return build_subscription_link(subscription, "unsubscribe", site_url)


def build_one_click_unsubscribe_link(subscription, site_url):
    token = make_subscription_token(subscription, "unsubscribe")
    query = urlencode({"t": token})
    return f"{str(site_url or '').rstrip('/')}/unsubscribe/one-click/?{query}"
