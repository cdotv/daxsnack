from email.utils import formataddr, make_msgid, parseaddr
from urllib.parse import urlsplit

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from core.subscription_tokens import build_one_click_unsubscribe_link


def branded_from_email() -> str:
    configured_name, address = parseaddr(settings.DEFAULT_FROM_EMAIL)
    display_name = configured_name or getattr(
        settings, "EMAIL_FROM_NAME", "Open Trading System"
    )
    return formataddr((display_name, address), charset="utf-8")


def _message_id_domain() -> str:
    site_host = urlsplit(str(getattr(settings, "SITE_URL", ""))).hostname
    if site_host:
        return site_host.removeprefix("www.")
    return parseaddr(settings.DEFAULT_FROM_EMAIL)[1].rpartition("@")[2]


def build_multipart_message(*, subject: str, text: str, html: str, to: str):
    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=branded_from_email(),
        to=[to],
        headers={"Message-ID": make_msgid(domain=_message_id_domain())},
    )
    message.attach_alternative(html, "text/html")
    return message


def build_subscriber_message(
    *,
    subject: str,
    text: str,
    html: str,
    subscription,
    site_url: str,
):
    one_click_url = build_one_click_unsubscribe_link(subscription, site_url)
    message = build_multipart_message(
        subject=subject,
        text=text,
        html=html,
        to=subscription.email,
    )
    message.extra_headers.update(
        {
            "List-ID": getattr(
                settings,
                "SUBSCRIBER_LIST_ID",
                "open trading system subscriber alerts <alerts.example.com>",
            ),
            "List-Unsubscribe": f"<{one_click_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Auto-Response-Suppress": "All",
        }
    )
    return message
