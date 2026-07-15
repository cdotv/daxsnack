from __future__ import annotations

import math
import time
from typing import Any, Dict, Optional, Tuple

import requests
from decouple import config as _dc

from core.capital_auth import get_token_headers_with_retry_for_base


def _json_or_empty(resp: requests.Response) -> Dict[str, Any]:
    try:
        if (resp.headers.get("Content-Type") or "").startswith("application/json"):
            data = resp.json() or {}
            return data if isinstance(data, dict) else {}
    except Exception:
        pass
    return {}


def _attach_api_key(headers: Dict[str, str]) -> None:
    try:
        api_key = _dc("CAPITAL_API_KEY", default=None)
        if api_key:
            headers["X-CAP-API-KEY"] = api_key
    except Exception:
        pass


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _numbers_close(
    a: Optional[float],
    b: Optional[float],
    *,
    rel_tol: float = 1e-6,
    abs_tol: float = 1e-6,
) -> bool:
    if a is None or b is None:
        return False
    try:
        return math.isclose(float(a), float(b), rel_tol=rel_tol, abs_tol=abs_tol)
    except Exception:
        return False


def ensure_account_header(
    api_base: str, headers: Dict[str, str], timeout: int = 20
) -> None:
    """Best-effort set X-CAP-ACCOUNT-ID for the authenticated session."""
    if "X-CAP-ACCOUNT-ID" in headers:
        return
    try:
        r = requests.get(
            f"{str(api_base).rstrip('/')}/api/v1/accounts",
            headers=headers,
            timeout=timeout,
        )
        if not r.ok:
            return
        data = r.json() or {}
        accs = data.get("accounts") if isinstance(data, dict) else None
        if isinstance(accs, list) and accs:
            aid = (accs[0] or {}).get("accountId")
            if isinstance(aid, str) and aid:
                headers["X-CAP-ACCOUNT-ID"] = aid
    except Exception:
        return


def build_trade_headers(api_base: str, debug: bool = False) -> Dict[str, str]:
    """Login + normalized headers for trade write actions."""
    headers = get_token_headers_with_retry_for_base(
        api_base, debug=debug, retries=3, base_delay=0.7
    )
    hdrs = dict(headers or {})
    _attach_api_key(hdrs)
    hdrs.setdefault("Accept", "application/json")
    hdrs.setdefault("Content-Type", "application/json")
    ensure_account_header(api_base, hdrs)
    return hdrs


def resolve_confirm(
    api_base: str, headers: Dict[str, str], ack: Dict[str, Any], debug: bool = False
) -> Dict[str, Any]:
    """Best-effort resolve dealId and status from confirms endpoint."""
    out = dict(ack or {})
    deal_ref = out.get("dealReference")
    if not isinstance(deal_ref, str) or not deal_ref:
        return out
    conf_url = f"{str(api_base).rstrip('/')}/api/v1/confirms/{deal_ref}"
    for attempt in range(1, 8):
        try:
            r = requests.get(conf_url, headers=headers, timeout=20)
            if r.ok:
                cj = _json_or_empty(r)
                try:
                    ad0 = (cj.get("affectedDeals") or [])[0] or {}
                except Exception:
                    ad0 = {}
                did = ad0.get("dealId") or cj.get("dealId")
                if isinstance(did, str) and did:
                    out["dealId"] = did
                st = (cj.get("dealStatus") or cj.get("status") or "").strip().upper()
                if st:
                    out["confirm_status"] = st
                if did or st in {"REJECTED", "FAILED", "ERROR"}:
                    break
            time.sleep(0.25 * attempt)
        except Exception:
            continue
    return out


def resolve_open_deal_id_from_positions(
    api_base: str,
    headers: Dict[str, str],
    order: Dict[str, Any],
    *,
    debug: bool = False,
) -> Optional[str]:
    """Recover a newly opened dealId from the positions feed when confirm lacks it."""
    target_epic = str((order or {}).get("epic") or "").strip().upper()
    target_direction = str((order or {}).get("direction") or "").strip().upper()
    target_size = _safe_float((order or {}).get("size"))
    target_stop = _safe_float((order or {}).get("stopLevel"))
    target_gs = (order or {}).get("guaranteedStop")
    if not target_epic or not target_direction or target_size is None:
        return None

    url = f"{str(api_base).rstrip('/')}/api/v1/positions"
    for attempt in range(1, 7):
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            if resp.ok:
                data = _json_or_empty(resp)
                items = data.get("positions") if isinstance(data, dict) else None
                matches = []
                if isinstance(items, list):
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        pos = (item or {}).get("position") or item or {}
                        mkt = (item or {}).get("market") or {}
                        epic = (
                            str(
                                mkt.get("epic")
                                or pos.get("epic")
                                or item.get("epic")
                                or ""
                            )
                            .strip()
                            .upper()
                        )
                        direction = (
                            str(pos.get("direction") or item.get("direction") or "")
                            .strip()
                            .upper()
                        )
                        if epic != target_epic or direction != target_direction:
                            continue
                        size = _safe_float(
                            pos.get("size")
                            or pos.get("dealSize")
                            or pos.get("quantity")
                        )
                        if not _numbers_close(
                            size,
                            target_size,
                            rel_tol=1e-9,
                            abs_tol=max(1e-6, abs(target_size) * 1e-6),
                        ):
                            continue
                        stop_level = _safe_float(
                            pos.get("stopLevel") or item.get("stopLevel")
                        )
                        if target_stop is not None and stop_level is not None:
                            if not _numbers_close(
                                stop_level,
                                target_stop,
                                rel_tol=1e-6,
                                abs_tol=max(1e-6, abs(target_stop) * 1e-6),
                            ):
                                continue
                        if isinstance(target_gs, bool):
                            gs = pos.get("guaranteedStop")
                            if gs is not None and bool(gs) != bool(target_gs):
                                continue
                        deal_id = pos.get("dealId") or item.get("dealId")
                        created = (
                            pos.get("createdDateUTC") or pos.get("createdDate") or ""
                        )
                        matches.append((str(created), deal_id))
                if len(matches) == 1:
                    deal_id = matches[0][1]
                    if isinstance(deal_id, str) and deal_id:
                        return deal_id
                if len(matches) > 1:
                    matches.sort(key=lambda it: it[0] or "")
                    deal_id = matches[-1][1]
                    if isinstance(deal_id, str) and deal_id:
                        return deal_id
            time.sleep(0.25 * attempt)
        except Exception:
            continue
    return None


def submit_open_order(
    api_base: str,
    order: Dict[str, Any],
    *,
    debug: bool = False,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 30,
) -> Tuple[bool, Dict[str, Any], str, Dict[str, str]]:
    """
    Submit a trade open order (POST /positions).
    Returns: (ok, ack, error_message, headers_used)
    """
    hdrs = dict(headers or {})
    if not hdrs:
        hdrs = build_trade_headers(api_base, debug=debug)
    else:
        _attach_api_key(hdrs)
        hdrs.setdefault("Accept", "application/json")
        hdrs.setdefault("Content-Type", "application/json")
        ensure_account_header(api_base, hdrs)

    url = f"{str(api_base).rstrip('/')}/api/v1/positions"
    try:
        resp = requests.post(url, headers=hdrs, json=order, timeout=timeout)
    except Exception as e:
        return False, {}, f"open_error: {e}", hdrs
    if not resp.ok:
        return False, {}, f"open_http_{resp.status_code}: {resp.text}", hdrs

    ack = _json_or_empty(resp)
    if "size" not in ack and isinstance(order, dict) and order.get("size") is not None:
        ack["size"] = order.get("size")
    ack = resolve_confirm(api_base, hdrs, ack, debug=debug)
    deal_id = ack.get("dealId") if isinstance(ack, dict) else None
    if not (isinstance(deal_id, str) and deal_id):
        recovered_deal_id = resolve_open_deal_id_from_positions(
            api_base, hdrs, order, debug=debug
        )
        if isinstance(recovered_deal_id, str) and recovered_deal_id:
            ack["dealId"] = recovered_deal_id
            st = str((ack or {}).get("confirm_status") or "").strip().upper()
            if not st:
                ack["confirm_status"] = "ACCEPTED"
    return True, ack, "", hdrs


def submit_close_order(
    api_base: str,
    order: Dict[str, Any],
    *,
    deal_id: Optional[str] = None,
    allow_post_fallback_on_delete_failure: bool = True,
    debug: bool = False,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 30,
) -> Tuple[bool, Dict[str, Any], str, Dict[str, str]]:
    """
    Submit a close order.
    - If deal_id is given: tries DELETE /positions/{deal_id}.
      When allow_post_fallback_on_delete_failure=True, falls back to POST /positions.
    - Else: POST /positions.
    Returns: (ok, ack, error_message, headers_used)
    """
    hdrs = dict(headers or {})
    if not hdrs:
        hdrs = build_trade_headers(api_base, debug=debug)
    else:
        _attach_api_key(hdrs)
        hdrs.setdefault("Accept", "application/json")
        hdrs.setdefault("Content-Type", "application/json")
        ensure_account_header(api_base, hdrs)

    base = str(api_base).rstrip("/")
    resp: Optional[requests.Response] = None
    try:
        if isinstance(deal_id, str) and deal_id:
            url_del = f"{base}/api/v1/positions/{deal_id}"
            resp = requests.delete(url_del, headers=hdrs, timeout=timeout)
            if (not resp.ok) and bool(allow_post_fallback_on_delete_failure):
                url_post = f"{base}/api/v1/positions"
                resp = requests.post(
                    url_post, headers=hdrs, json=order, timeout=timeout
                )
        else:
            url_post = f"{base}/api/v1/positions"
            resp = requests.post(url_post, headers=hdrs, json=order, timeout=timeout)
    except Exception as e:
        return False, {}, f"close_error: {e}", hdrs

    if resp is None or not resp.ok:
        if resp is None:
            return False, {}, "close_error: no response", hdrs
        return False, {}, f"close_http_{resp.status_code}: {resp.text}", hdrs

    ack = _json_or_empty(resp)
    ack = resolve_confirm(api_base, hdrs, ack, debug=debug)
    return True, ack, "", hdrs


def submit_stop_update(
    api_base: str,
    deal_id: str,
    stop_level: float,
    *,
    guaranteed_stop: bool = False,
    debug: bool = False,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 30,
) -> Tuple[bool, str, Dict[str, str]]:
    """
    Update stop level for one deal.
    Tries PUT /positions/{dealId}, falls back PUT /positions/otc.
    Returns: (ok, error_message, headers_used)
    """
    if not (isinstance(deal_id, str) and deal_id):
        return False, "missing_deal_id", dict(headers or {})

    hdrs = dict(headers or {})
    if not hdrs:
        hdrs = build_trade_headers(api_base, debug=debug)
    else:
        _attach_api_key(hdrs)
        hdrs.setdefault("Accept", "application/json")
        hdrs.setdefault("Content-Type", "application/json")
        ensure_account_header(api_base, hdrs)

    base = str(api_base).rstrip("/")
    body1 = {
        "stopLevel": float(stop_level),
        "guaranteedStop": bool(guaranteed_stop),
    }
    try:
        url1 = f"{base}/api/v1/positions/{deal_id}"
        resp = requests.put(url1, headers=hdrs, json=body1, timeout=timeout)
        if 200 <= resp.status_code < 300:
            return True, "", hdrs

        body2 = {
            "dealId": deal_id,
            "stopLevel": float(stop_level),
            "guaranteedStop": bool(guaranteed_stop),
        }
        url2 = f"{base}/api/v1/positions/otc"
        resp2 = requests.put(url2, headers=hdrs, json=body2, timeout=timeout)
        if 200 <= resp2.status_code < 300:
            return True, "", hdrs
        return False, f"stop_http_{resp.status_code}/{resp2.status_code}", hdrs
    except Exception as e:
        return False, f"stop_error: {e}", hdrs
