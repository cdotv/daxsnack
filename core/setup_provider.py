"""Stable boundary between the public web app and a private strategy package."""

import json

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string

MAX_PUBLIC_PAYLOAD_BYTES = 256 * 1024
PUBLIC_PAYLOAD_KEYS = {
    "setup_payload",
    "day_setups_payload",
    "capital_check",
    "running_items",
    "closed_items",
    "public_activity",
    "instrument_stats",
    "benchmark_ranking",
    "account_total_delta_pct",
    "est_annual_return_pct",
    "version_display",
}


def empty_home_payload() -> dict:
    """Return the safe empty state used until an operator connects a provider."""
    return {
        "setup_payload": None,
        "day_setups_payload": {"items": []},
        "capital_check": None,
        "running_items": [],
        "closed_items": [],
        "public_activity": {"items": []},
        "instrument_stats": None,
        "benchmark_ranking": [],
        "account_total_delta_pct": None,
        "est_annual_return_pct": None,
        "version_display": None,
    }


def _validate_payload(value) -> dict:
    if not isinstance(value, dict):
        raise ImproperlyConfigured("The home payload provider must return a dict.")
    unknown = sorted(set(value) - PUBLIC_PAYLOAD_KEYS)
    if unknown:
        raise ImproperlyConfigured(f"Unsupported public payload keys: {unknown}")
    try:
        encoded = json.dumps(value, ensure_ascii=True, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ImproperlyConfigured(
            "The public payload must be strict JSON data."
        ) from exc
    if len(encoded) > MAX_PUBLIC_PAYLOAD_BYTES:
        raise ImproperlyConfigured("The public payload exceeds the size limit.")
    payload = empty_home_payload()
    payload.update(value)
    return payload


def load_home_payload(request) -> dict:
    """Load the configured operator callable, or return an empty dashboard."""
    provider_path = str(
        getattr(settings, "TRADING_SYSTEM_HOME_PAYLOAD_PROVIDER", "") or ""
    ).strip()
    if not provider_path:
        return empty_home_payload()
    try:
        provider = import_string(provider_path)
    except ImportError as exc:
        raise ImproperlyConfigured(
            "TRADING_SYSTEM_HOME_PAYLOAD_PROVIDER is not importable."
        ) from exc
    if not callable(provider):
        raise ImproperlyConfigured(
            "The configured home payload provider is not callable."
        )
    return _validate_payload(provider(request))
