"""Validated, operator-configurable public identity values."""

from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

_FIELDS = {
    "name": ("SITE_NAME", "open trading system", 100),
    "title": ("SITE_TITLE", "Open Trading System", 160),
    "description": (
        "SITE_DESCRIPTION",
        "A self-hostable dashboard for operator-provided trading setups.",
        300,
    ),
    "url": ("SITE_URL", "https://example.com", 300),
    "owner_name": ("SITE_OWNER_NAME", "Example Operator", 160),
    "owner_address": ("SITE_OWNER_ADDRESS", "", 500),
    "contact_email": ("CONTACT_EMAIL", "contact@example.com", 254),
    "benchmark_key": ("SYSTEM_BENCHMARK_KEY", "system", 80),
}


def get_site_profile() -> dict[str, object]:
    """Return a small validated profile safe to expose to templates and JSON."""
    values = {}
    for key, (setting_name, default, max_length) in _FIELDS.items():
        value = str(getattr(settings, setting_name, default) or "").strip()
        if key not in {"owner_address"} and not value:
            raise ImproperlyConfigured(f"{setting_name} must not be empty.")
        if len(value) > max_length or any(ord(character) < 32 for character in value):
            raise ImproperlyConfigured(f"{setting_name} is invalid.")
        values[key] = value

    parsed_url = urlsplit(values["url"])
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.hostname:
        raise ImproperlyConfigured("SITE_URL must be an absolute HTTP(S) URL.")
    if "@" not in values["contact_email"]:
        raise ImproperlyConfigured("CONTACT_EMAIL must be an email address.")

    return {
        "name": values["name"],
        "title": values["title"],
        "description": values["description"],
        "url": values["url"].rstrip("/"),
        "benchmarkKey": values["benchmark_key"].lower(),
        "owner": {
            "name": values["owner_name"],
            "address": values["owner_address"],
            "email": values["contact_email"],
        },
    }


def site_profile_context(request) -> dict[str, dict[str, object]]:
    """Django context processor for consistent identity in every template."""
    return {"site_profile": get_site_profile()}
