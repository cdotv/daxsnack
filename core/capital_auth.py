# =========================
# FILE: core/capital_auth.py
# =========================
from __future__ import annotations

import random
import time

import requests
from decouple import config

DEMO_CAPITAL_BASE = "https://demo-api-capital.backend-capital.com"
LIVE_CAPITAL_BASE = "https://api-capital.backend-capital.com"
CAPITAL_LOGIN_JITTER_MIN_SECONDS = float(
    config("CAPITAL_LOGIN_JITTER_MIN_SECONDS", default=1.0)
)
CAPITAL_LOGIN_JITTER_MAX_SECONDS = float(
    config("CAPITAL_LOGIN_JITTER_MAX_SECONDS", default=8.0)
)


def _truthy(val: str | None) -> bool:
    if val is None:
        return False
    return val.strip().lower() in ("1", "true", "yes", "on")


def get_api_base() -> str:
    """
    Resolve Capital.com API base URL with the following precedence:
      1) CAPITAL_API_BASE (full URL)
      2) CAPITAL_ENV = 'demo' or CAPITAL_USE_DEMO=true
      3) default live URL
    """
    # 1) explicit full base URL
    explicit = config("CAPITAL_API_BASE", default=None)
    if explicit:
        return str(explicit)

    # 2) environment-style switch
    # If CAPITAL_USE_DEMO is explicitly set, it has priority over CAPITAL_ENV
    use_demo_val = config("CAPITAL_USE_DEMO", default=None)
    if use_demo_val is not None:
        return DEMO_CAPITAL_BASE if _truthy(use_demo_val) else LIVE_CAPITAL_BASE

    env = (config("CAPITAL_ENV", default=None) or "").strip().lower()
    if env == "demo":
        return DEMO_CAPITAL_BASE
    if env == "live":
        return LIVE_CAPITAL_BASE

    # 3) default to demo when unspecified
    return DEMO_CAPITAL_BASE


CAPITAL_BASE = get_api_base()
API_SESSION = f"{CAPITAL_BASE}/api/v1/session"


def live_new_trades_enabled() -> bool:
    """Return whether the operator explicitly enabled live writes."""
    return _truthy(config("CAPITAL_LIVE_NEW_TRADES_ENABLED", default="false"))


def get_trade_write_targets(now_utc=None) -> list[dict]:
    """
    Return account targets for trade write actions.

    Always includes demo. Includes live only after an explicit opt-in.
    """
    targets = [{"name": "demo", "base_url": DEMO_CAPITAL_BASE}]
    if live_new_trades_enabled():
        targets.append({"name": "live", "base_url": LIVE_CAPITAL_BASE})
    return targets


def _api_session_for_base(api_base: str) -> str:
    return f"{str(api_base).rstrip('/')}/api/v1/session"


def sample_login_jitter_delay(
    minimum: float | None = None, maximum: float | None = None
) -> float:
    """
    Sample a one-time startup delay before the first Capital login in a process.

    This is intended to spread out simultaneous stream restarts and reduce
    bursty login storms against Capital auth endpoints. Callers should decide
    when to apply it and ensure they do so at most once per process.
    """
    lo = CAPITAL_LOGIN_JITTER_MIN_SECONDS if minimum is None else float(minimum)
    hi = CAPITAL_LOGIN_JITTER_MAX_SECONDS if maximum is None else float(maximum)
    if not (lo > 0.0 or hi > 0.0):
        return 0.0
    if hi < lo:
        lo, hi = hi, lo
    lo = max(lo, 0.0)
    hi = max(hi, 0.0)
    if hi <= 0.0:
        return 0.0
    if hi == lo:
        return float(lo)
    return float(random.uniform(lo, hi))


def get_token_headers(debug: bool = False) -> dict:
    """
    Log in to Capital.com and return the required headers:
      {"CST": "...", "X-SECURITY-TOKEN": "..."}
    Uses python-decouple to read:
      CAPITAL_API_KEY
      CAPITAL_ID
      CAPITAL_PASSWORD
    """
    api_key = config("CAPITAL_API_KEY")
    ident = config("CAPITAL_ID")
    passwd = config("CAPITAL_PASSWORD")

    headers = {
        "X-CAP-API-KEY": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "identifier": ident,
        "password": passwd,
        "encryptedPassword": False,
    }
    if debug:
        print(
            "[DBG] POST /session for token (capital_auth.get_token_headers) ...",
            flush=True,
        )
    resp = requests.post(API_SESSION, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Capital login HTTP {resp.status_code} {resp.reason}")

    cst = resp.headers.get("CST")
    xst = resp.headers.get("X-SECURITY-TOKEN")
    if not cst or not xst:
        raise RuntimeError(
            "Capital auth missing token in response (no CST/X-SECURITY-TOKEN)"
        )

    if debug:
        print("[DBG] Obtained Capital token headers.", flush=True)
    # Return only session tokens for subsequent requests
    return {"CST": cst, "X-SECURITY-TOKEN": xst}


def get_token_headers_for_base(api_base: str, debug: bool = False) -> dict:
    """
    Log in to a specific Capital.com API base URL and return session headers.
    """
    api_key = config("CAPITAL_API_KEY")
    ident = config("CAPITAL_ID")
    passwd = config("CAPITAL_PASSWORD")

    headers = {
        "X-CAP-API-KEY": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "identifier": ident,
        "password": passwd,
        "encryptedPassword": False,
    }
    session_url = _api_session_for_base(api_base)
    if debug:
        print(
            f"[DBG] POST {session_url} for token (capital_auth.get_token_headers_for_base) ...",
            flush=True,
        )
    resp = requests.post(session_url, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Capital login HTTP {resp.status_code} {resp.reason}")

    cst = resp.headers.get("CST")
    xst = resp.headers.get("X-SECURITY-TOKEN")
    if not cst or not xst:
        raise RuntimeError(
            "Capital auth missing token in response (no CST/X-SECURITY-TOKEN)"
        )

    if debug:
        print("[DBG] Obtained Capital token headers.", flush=True)
    return {"CST": cst, "X-SECURITY-TOKEN": xst}


def get_token_headers_with_retry(
    debug: bool = False, retries: int = 3, base_delay: float = 0.7
) -> dict:
    """
    Obtain Capital.com session headers with small exponential backoff.

    Retries up to `retries` times on failure (e.g., HTTP 429 Too Many Requests)
    with delays approx: base_delay * (2**attempt) + jitter.
    """
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return get_token_headers(debug=debug)
        except Exception as e:  # pragma: no cover - network dependent
            last_err = e
            try:
                sleep_for = float(base_delay) * (2**attempt) + random.random() * 0.25
                if debug:
                    print(
                        f"[DBG] Capital auth retry {attempt+1}/{retries} after error: {e} (sleep {sleep_for:.2f}s)",
                        flush=True,
                    )
                time.sleep(sleep_for)
            except Exception:
                pass
    # Exhausted
    raise (
        last_err
        if last_err is not None
        else RuntimeError("capital_auth: token retries exhausted")
    )


def get_token_headers_with_retry_for_base(
    api_base: str,
    debug: bool = False,
    retries: int = 3,
    base_delay: float = 0.7,
) -> dict:
    """Retry wrapper for get_token_headers_for_base."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return get_token_headers_for_base(api_base=api_base, debug=debug)
        except Exception as e:  # pragma: no cover - network dependent
            last_err = e
            try:
                sleep_for = float(base_delay) * (2**attempt) + random.random() * 0.25
                if debug:
                    print(
                        f"[DBG] Capital auth retry {attempt+1}/{retries} for {api_base} after error: {e} (sleep {sleep_for:.2f}s)",
                        flush=True,
                    )
                time.sleep(sleep_for)
            except Exception:
                pass
    raise (
        last_err
        if last_err is not None
        else RuntimeError("capital_auth: token retries exhausted")
    )
