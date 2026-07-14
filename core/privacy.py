import hashlib
import hmac

from django.conf import settings


def subscriber_log_id(email: str) -> str:
    """Return a stable, non-reversible identifier for subscriber logs."""
    normalized = str(email or "").strip().lower().encode("utf-8")
    secret = settings.SECRET_KEY.encode("utf-8")
    digest = hmac.new(secret, normalized, hashlib.sha256).hexdigest()[:12]
    return f"subscriber:{digest}"
