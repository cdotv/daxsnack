import os
import json
import concurrent.futures
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from django.core.management.base import BaseCommand
from django.conf import settings
import requests

from core.capital_auth import (
    get_token_headers_with_retry,
    get_token_headers,
    get_trade_write_targets,
    LIVE_CAPITAL_BASE,
    CAPITAL_BASE,
)
from core.broker_trade_service import submit_close_order, build_trade_headers


class Command(BaseCommand):
    help = "Close an open position by epic using a MARKET order (demo)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--epic", required=True, help="EPIC to close (e.g., BTCUSD)"
        )
        parser.add_argument(
            "--deal-id",
            default=None,
            help="Optional dealId to select the exact position",
        )
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--debug", action="store_true")

    def handle(self, *args, **opts):
        epic = str(opts.get("epic") or "").strip()
        dry = bool(opts.get("dry_run"))
        debug = bool(opts.get("debug"))
        deal_id_opt = (opts.get("deal_id") or "").strip() or None
        if not epic:
            self.stderr.write("Missing --epic")
            return

        # Load open_trades.json to find side and size
        base_dir = getattr(settings, "BASE_DIR", None) or os.getcwd()
        path = os.path.join(str(base_dir), "data", "open_trades.json")
        if not os.path.exists(path):
            self.stderr.write("No open_trades.json; nothing to close.")
            return
        with open(path, "r", encoding="utf-8") as f:
            try:
                open_trades = json.load(f) or []
            except Exception:
                open_trades = []
        if not isinstance(open_trades, list):
            open_trades = []

        rec: Optional[Dict[str, Any]] = None
        # Prefer explicit deal-id when provided
        if deal_id_opt:
            for r in open_trades:
                try:
                    if (
                        (r or {}).get("epic")
                        and str((r or {}).get("epic")).upper() == epic.upper()
                        and (r.get("id") == deal_id_opt)
                    ):
                        rec = r
                        break
                except Exception:
                    continue
        # Otherwise prefer non-dry-run real positions first
        if rec is None:
            for r in open_trades:
                try:
                    if (
                        (r or {}).get("epic")
                        and str((r or {}).get("epic")).upper() == epic.upper()
                        and not bool(r.get("dry_run"))
                    ):
                        rec = r
                        break
                except Exception:
                    continue
        # Finally fall back to the first matching record
        if rec is None:
            for r in open_trades:
                try:
                    if (r or {}).get("epic") and str(
                        (r or {}).get("epic")
                    ).upper() == epic.upper():
                        rec = r
                        break
                except Exception:
                    continue
        if not rec:
            self.stderr.write(f"No open trade found for {epic}")
            return

        side = (rec.get("direction") or "").upper()
        if side not in ("BUY", "SELL"):
            # fallback from 'side'
            side = "BUY" if (str(rec.get("side") or "").lower() == "long") else "SELL"
        try:
            qty = float(rec.get("size") or 0.0)
        except Exception:
            qty = 0.0
        if not (qty and qty > 0):
            self.stderr.write(f"Invalid size for open trade {epic}; cannot close.")
            return

        close_dir = "SELL" if side == "BUY" else "BUY"
        order = {
            "epic": epic,
            "direction": close_dir,
            "size": round(qty, 6),
            "orderType": "MARKET",
            "forceOpen": False,
            "guaranteedStop": False,
            "expiry": "-",
        }
        self.stdout.write(self.style.WARNING(f"Closing {epic} → order={order}"))
        if dry or bool(rec.get("dry_run")):
            self.stdout.write(self.style.SUCCESS("Dry-run: no close order placed."))
            return

        # Login
        try:
            headers = get_token_headers_with_retry(
                debug=debug, retries=3, base_delay=0.7
            )
        except Exception:
            try:
                headers = get_token_headers(debug=debug)
            except Exception as e:
                self.stderr.write(f"Login failed: {e}")
                return
        hdrs = dict(headers)
        try:
            from decouple import config as _dc

            api_key = _dc("CAPITAL_API_KEY", default=None)
            if api_key:
                hdrs["X-CAP-API-KEY"] = api_key
        except Exception:
            pass
        hdrs.setdefault("Accept", "application/json")
        hdrs.setdefault("Content-Type", "application/json")
        # Ensure correct account header
        try:
            acct = requests.get(
                f"{CAPITAL_BASE}/api/v1/accounts", headers=hdrs, timeout=20
            )
            if acct.ok:
                data = acct.json() or {}
                accs = data.get("accounts") if isinstance(data, dict) else None
                if isinstance(accs, list) and accs:
                    aid = (accs[0] or {}).get("accountId")
                    if isinstance(aid, str) and aid:
                        hdrs["X-CAP-ACCOUNT-ID"] = aid
        except Exception:
            pass

        parallel_results = self._close_demo_and_live_parallel(
            rec=rec,
            close_dir=close_dir,
            preferred_demo_deal_id=deal_id_opt,
            headers=hdrs,
            debug=debug,
        )
        demo_result = parallel_results.get("demo") or self._close_result(
            account="demo",
            ok=False,
            status="missing_result",
            message="demo_missing_parallel_result",
        )
        live_result = parallel_results.get("live") or self._close_result(
            account="live",
            ok=False,
            status="missing_result",
            message="live_missing_parallel_result",
        )

        if bool(demo_result.get("ok")) and bool(live_result.get("ok")):
            try:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Demo close accepted: {demo_result.get('ack') or demo_result.get('status')}"
                    )
                )
                if bool(live_result.get("required")):
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Live close accepted: {live_result.get('ack') or live_result.get('status')}"
                        )
                    )
            except Exception:
                pass
        else:
            self._notify_manual_parallel_close_failure_once(
                rec=rec,
                epic=epic,
                demo_result=demo_result,
                live_result=live_result,
            )
            try:
                rec2 = self._build_pending_parallel_close_record(
                    rec=rec,
                    reason="manual_close",
                    demo_result=demo_result,
                    live_result=live_result,
                )
                remaining = [rec2 if r is rec else r for r in open_trades]
            except Exception:
                remaining = list(open_trades)
            try:
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(remaining, f, indent=2)
                self.stderr.write(
                    "Manual close incomplete; kept trade locally as close_pending."
                )
            except Exception as e:
                self.stderr.write(f"Failed to write {path}: {e}")
            return

        # Remove from open_trades and persist
        remaining = [r for r in open_trades if r is not rec]
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(remaining, f, indent=2)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Open trades updated → {path} (remaining: {len(remaining)})"
                )
            )
        except Exception as e:
            self.stderr.write(f"Failed to write {path}: {e}")

    def _get_live_account_meta(self, rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            targets = get_trade_write_targets()
            live_enabled = any((t or {}).get("name") == "live" for t in (targets or []))
            if not live_enabled:
                return None
        except Exception:
            return None
        try:
            ba = rec.get("broker_accounts") if isinstance(rec, dict) else None
            if isinstance(ba, dict):
                live = ba.get("live")
                if isinstance(live, dict):
                    did = live.get("deal_id")
                    if isinstance(did, str) and did:
                        return live
                    if bool(live.get("enabled")):
                        return live
            did = rec.get("live_deal_id") if isinstance(rec, dict) else None
            if isinstance(did, str) and did:
                return {"deal_id": did}
            if bool((rec or {}).get("live_close_pending")) or bool(
                (rec or {}).get("demo_closed_at_utc")
            ):
                return {}
        except Exception:
            return None
        return None

    def _close_result(
        self,
        *,
        account: str,
        ok: bool,
        status: str,
        message: str,
        required: bool = True,
        ack: Optional[Dict[str, Any]] = None,
        fill_price: Optional[float] = None,
        deal_id: Optional[str] = None,
        still_open_after: Optional[bool] = None,
        closed_at_utc: Optional[str] = None,
        confirm_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {
            "account": account,
            "required": bool(required),
            "ok": bool(ok),
            "status": str(status or ""),
            "message": str(message or status or ""),
            "ack": ack if isinstance(ack, dict) else None,
            "fill_price": fill_price if isinstance(fill_price, (int, float)) else None,
            "deal_id": deal_id if isinstance(deal_id, str) and deal_id else None,
            "still_open_after": (
                still_open_after if isinstance(still_open_after, bool) else None
            ),
            "closed_at_utc": (
                closed_at_utc
                if isinstance(closed_at_utc, str) and closed_at_utc
                else None
            ),
            "confirm_status": (
                confirm_status
                if isinstance(confirm_status, str) and confirm_status
                else None
            ),
        }

    def _fetch_position_by_deal_id(
        self,
        *,
        base_url: str,
        headers: Dict[str, str],
        deal_id: Optional[str],
        account_name: str,
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        if not (isinstance(deal_id, str) and deal_id):
            return None, f"{account_name}_missing_deal_id"
        try:
            rr = requests.get(
                f"{base_url}/api/v1/positions/{deal_id}", headers=headers, timeout=20
            )
        except Exception as e:
            return None, f"{account_name}_position_lookup_error:{e}"
        if rr.ok:
            try:
                payload = rr.json() or {}
            except Exception as e:
                return None, f"{account_name}_position_lookup_json_error:{e}"
            if isinstance(payload, dict):
                return payload, f"{account_name}_position_lookup_ok"
            return None, f"{account_name}_position_lookup_invalid_payload"
        try:
            payload = rr.json() or {}
            err_code = str(payload.get("errorCode") or "").strip()
        except Exception:
            err_code = ""
        if rr.status_code in {400, 404} or err_code in {
            "error.position.notfound",
            "error.invalid.position",
        }:
            return None, f"{account_name}_position_not_found"
        return None, f"{account_name}_position_lookup_http_{rr.status_code}"

    def _resolve_close_target_from_positions(
        self,
        *,
        base_url: str,
        headers: Dict[str, str],
        epic: str,
        open_direction: str,
        stored_deal_id: Optional[str],
        account_name: str,
    ) -> Tuple[bool, Optional[str], Optional[float], str, Optional[Dict[str, str]]]:
        if isinstance(stored_deal_id, str) and stored_deal_id:
            payload, lookup_status = self._fetch_position_by_deal_id(
                base_url=base_url,
                headers=headers,
                deal_id=stored_deal_id,
                account_name=account_name,
            )
            if isinstance(payload, dict):
                pos = (payload or {}).get("position") or payload or {}
                mkt = (payload or {}).get("market") or {}
                ep2 = (
                    str(mkt.get("epic") or pos.get("epic") or payload.get("epic") or "")
                    .strip()
                    .upper()
                )
                dir2 = (
                    (pos.get("direction") or payload.get("direction") or "")
                    .strip()
                    .upper()
                )
                q2 = pos.get("size") or pos.get("dealSize") or pos.get("quantity")
                try:
                    q2f = float(q2)
                except Exception:
                    q2f = None
                if (not epic or ep2 == epic) and (
                    not open_direction or dir2 == open_direction
                ):
                    return (
                        True,
                        stored_deal_id,
                        q2f,
                        f"{account_name}_resolved_by_direct_deal_lookup",
                        headers,
                    )
            elif lookup_status not in {f"{account_name}_position_not_found"}:
                return False, stored_deal_id, None, lookup_status, headers

        try:
            rr = requests.get(
                f"{base_url}/api/v1/positions", headers=headers, timeout=20
            )
            if not rr.ok:
                return (
                    False,
                    None,
                    None,
                    f"{account_name}_positions_http_{rr.status_code}",
                    headers,
                )
            payload = rr.json() or {}
            items = (
                payload.get("positions") or payload.get("list") or payload
                if isinstance(payload, list)
                else []
            )
        except Exception as e:
            return False, None, None, f"{account_name}_positions_error:{e}", headers

        matches: List[Dict[str, Any]] = []
        for it in items or []:
            mkt = (it or {}).get("market") or {}
            pos = (it or {}).get("position") or it or {}
            ep2 = (
                str(mkt.get("epic") or pos.get("epic") or it.get("epic") or "")
                .strip()
                .upper()
            )
            if ep2 != epic:
                continue
            dir2 = (pos.get("direction") or it.get("direction") or "").strip().upper()
            if open_direction and dir2 != open_direction:
                continue
            did2 = pos.get("dealId") or it.get("dealId")
            q2 = pos.get("size") or pos.get("dealSize") or pos.get("quantity")
            try:
                q2f = float(q2)
            except Exception:
                q2f = None
            matches.append({"deal_id": did2, "size": q2f})

        if isinstance(stored_deal_id, str) and stored_deal_id:
            for m in matches:
                if str(m.get("deal_id") or "") == stored_deal_id:
                    return (
                        True,
                        stored_deal_id,
                        m.get("size"),
                        f"{account_name}_resolved_by_stored_deal_id",
                        headers,
                    )

        if len(matches) == 0:
            return False, None, None, f"{account_name}_already_closed", headers
        if len(matches) > 1:
            return (
                False,
                None,
                None,
                f"{account_name}_close_ambiguous_multiple_matches",
                headers,
            )
        did = matches[0].get("deal_id")
        if not (isinstance(did, str) and did):
            return (
                False,
                None,
                matches[0].get("size"),
                f"{account_name}_missing_deal_id_on_match",
                headers,
            )
        return (
            True,
            did,
            matches[0].get("size"),
            f"{account_name}_resolved_by_epic_direction",
            headers,
        )

    def _extract_fill_price_from_ack(
        self,
        *,
        base_url: str,
        headers: Dict[str, str],
        ack: Optional[Dict[str, Any]],
    ) -> Tuple[Optional[float], Optional[str]]:
        fill_price = None
        confirm_status = None
        try:
            deal_ref = (ack or {}).get("dealReference")
            if not deal_ref:
                st = (ack or {}).get("confirm_status")
                if isinstance(st, str) and st:
                    confirm_status = st.strip().upper()
                return None, confirm_status
            conf_url = f"{base_url}/api/v1/confirms/{deal_ref}"
            for attempt in range(1, 6):
                r = requests.get(conf_url, headers=headers, timeout=20)
                if r.ok:
                    try:
                        cj = r.json() or {}
                    except Exception:
                        cj = {}
                    try:
                        ad0 = (cj.get("affectedDeals") or [])[0] or {}
                    except Exception:
                        ad0 = {}
                    for src in (ad0, cj):
                        for key in ("level", "price", "closeLevel", "closePrice"):
                            try:
                                val = src.get(key)
                                if val is not None:
                                    fill_price = float(val)
                                    break
                            except Exception:
                                pass
                        if fill_price is not None:
                            break
                    try:
                        st = (
                            (cj.get("dealStatus") or cj.get("status") or "")
                            .strip()
                            .upper()
                        )
                    except Exception:
                        st = ""
                    if st:
                        confirm_status = st
                    if confirm_status is not None and fill_price is not None:
                        break
                try:
                    import time as _t

                    _t.sleep(0.25 * attempt)
                except Exception:
                    pass
        except Exception:
            fill_price = None
        if confirm_status is None:
            try:
                st = (ack or {}).get("confirm_status")
                if isinstance(st, str) and st:
                    confirm_status = st.strip().upper()
            except Exception:
                confirm_status = None
        return fill_price, confirm_status

    def _position_still_open(
        self,
        *,
        base_url: str,
        headers: Dict[str, str],
        epic: str,
        open_direction: str,
        deal_id: Optional[str],
    ) -> Optional[bool]:
        if isinstance(deal_id, str) and deal_id:
            payload, lookup_status = self._fetch_position_by_deal_id(
                base_url=base_url,
                headers=headers,
                deal_id=deal_id,
                account_name="position",
            )
            if isinstance(payload, dict):
                pos = (payload or {}).get("position") or payload or {}
                mkt = (payload or {}).get("market") or {}
                ep2 = (
                    str(mkt.get("epic") or pos.get("epic") or payload.get("epic") or "")
                    .strip()
                    .upper()
                )
                dir2 = (
                    (pos.get("direction") or payload.get("direction") or "")
                    .strip()
                    .upper()
                )
                if (not epic or ep2 == epic) and (
                    not open_direction or dir2 == open_direction
                ):
                    return True
            elif lookup_status == "position_position_not_found":
                return False
            elif lookup_status.startswith("position_position_lookup_"):
                return None
        try:
            rr = requests.get(
                f"{base_url}/api/v1/positions", headers=headers, timeout=20
            )
            if not rr.ok:
                return None
            payload = rr.json() or {}
            items = (
                payload.get("positions") or payload.get("list") or payload
                if isinstance(payload, list)
                else []
            )
        except Exception:
            return None

        for it in items or []:
            mkt = (it or {}).get("market") or {}
            pos = (it or {}).get("position") or it or {}
            did = pos.get("dealId") or it.get("dealId")
            ep2 = (
                str(mkt.get("epic") or pos.get("epic") or it.get("epic") or "")
                .strip()
                .upper()
            )
            dir2 = (pos.get("direction") or it.get("direction") or "").strip().upper()
            if (
                isinstance(deal_id, str)
                and deal_id
                and isinstance(did, str)
                and did == deal_id
            ):
                return True
            if ep2 == epic and open_direction and dir2 == open_direction:
                return True
        return False

    def _resolve_demo_close_target(
        self,
        *,
        rec: Dict[str, Any],
        close_dir: str,
        headers: Dict[str, str],
        preferred_deal_id: Optional[str],
    ) -> Tuple[bool, Optional[str], Optional[float], str, Optional[Dict[str, str]]]:
        epic = str((rec or {}).get("epic") or "").strip().upper()
        if not epic:
            return False, None, None, "missing_demo_epic", headers

        open_dir = (rec.get("direction") or "").strip().upper()
        if open_dir not in {"BUY", "SELL"}:
            side = (rec.get("side") or "").strip().lower()
            if side == "long":
                open_dir = "BUY"
            elif side == "short":
                open_dir = "SELL"
        if open_dir not in {"BUY", "SELL"}:
            open_dir = "BUY" if str(close_dir).strip().upper() == "SELL" else "SELL"

        stored_deal_id = (preferred_deal_id or "").strip() or None
        if not stored_deal_id:
            did1 = rec.get("demo_deal_id")
            if isinstance(did1, str) and did1:
                stored_deal_id = did1
            else:
                did2 = rec.get("id")
                if isinstance(did2, str) and did2 and not did2.startswith("local-"):
                    stored_deal_id = did2

        return self._resolve_close_target_from_positions(
            base_url=CAPITAL_BASE,
            headers=headers,
            epic=epic,
            open_direction=open_dir,
            stored_deal_id=stored_deal_id,
            account_name="demo",
        )

    def _resolve_live_close_target(
        self,
        *,
        rec: Dict[str, Any],
        close_dir: str,
        debug: bool,
        preferred_deal_id: Optional[str] = None,
    ) -> tuple[bool, Optional[str], Optional[float], str, Optional[Dict[str, str]]]:
        epic = str((rec or {}).get("epic") or "").strip().upper()
        if not epic:
            return False, None, None, "missing_live_epic", None

        open_dir = (rec.get("direction") or "").strip().upper()
        if open_dir not in {"BUY", "SELL"}:
            side = (rec.get("side") or "").strip().lower()
            if side == "long":
                open_dir = "BUY"
            elif side == "short":
                open_dir = "SELL"
        if open_dir not in {"BUY", "SELL"}:
            open_dir = "BUY" if str(close_dir).strip().upper() == "SELL" else "SELL"

        try:
            hdrs = build_trade_headers(LIVE_CAPITAL_BASE, debug=debug)
        except Exception as e:
            return False, None, None, f"live_header_error:{e}", None

        stored_deal_id = (preferred_deal_id or "").strip() or None
        if not stored_deal_id:
            try:
                meta = self._get_live_account_meta(rec)
                if isinstance(meta, dict):
                    did0 = meta.get("deal_id")
                    if isinstance(did0, str) and did0:
                        stored_deal_id = did0
            except Exception:
                stored_deal_id = None
        return self._resolve_close_target_from_positions(
            base_url=LIVE_CAPITAL_BASE,
            headers=hdrs,
            epic=epic,
            open_direction=open_dir,
            stored_deal_id=stored_deal_id,
            account_name="live",
        )

    def _close_failure_already_notified(self, rec: Optional[Dict[str, Any]]) -> bool:
        return isinstance(rec, dict) and bool(rec.get("close_failure_notified_utc"))

    def _mark_close_failure_notified(
        self,
        rec: Optional[Dict[str, Any]],
        *,
        reason: str,
        scope: str,
    ) -> None:
        if not isinstance(rec, dict):
            return
        rec["close_failure_notified_utc"] = (
            datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        )
        rec["close_failure_notified_reason"] = str(reason or "")
        rec["close_failure_notified_scope"] = str(scope or "manual")

    def _notify_close_failure_once(
        self,
        *,
        rec: Optional[Dict[str, Any]],
        subject: str,
        text: str,
        reason: str,
        scope: str,
    ) -> bool:
        try:
            if self._close_failure_already_notified(rec):
                return False
            from django.conf import settings as _s

            owner = getattr(_s, "NOTIFY_EMAIL", None) or getattr(
                _s, "DEFAULT_FROM_EMAIL", None
            )
            if not owner:
                return False
            from django.core.mail import send_mail

            send_mail(subject, text, None, [owner], fail_silently=True)
            self._mark_close_failure_notified(rec, reason=reason, scope=scope)
            return True
        except Exception:
            return False

    def _notify_manual_parallel_close_failure_once(
        self,
        *,
        rec: Optional[Dict[str, Any]],
        epic: str,
        demo_result: Dict[str, Any],
        live_result: Dict[str, Any],
    ) -> bool:
        txt = (
            f"Manual close incomplete for {epic}.\n"
            f"Demo: {demo_result}\n"
            f"Live: {live_result}\n"
        )
        return self._notify_close_failure_once(
            rec=rec,
            subject="Manual close failure alert",
            text=txt,
            reason="manual_close_failed",
            scope="manual_parallel",
        )

    def _notify_manual_close_failure(
        self,
        epic: str,
        reason: str,
        details: Dict[str, Any],
        rec: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            txt = (
                f"Manual close incomplete for {epic}.\n"
                f"Reason: {reason}.\n"
                f"Details: {details}\n"
            )
            self._notify_close_failure_once(
                rec=rec,
                subject="Manual close failure alert",
                text=txt,
                reason=reason,
                scope="manual",
            )
        except Exception:
            pass

    def _notify_live_close_failure(
        self, epic: str, reason: str, rec: Optional[Dict[str, Any]] = None
    ) -> None:
        try:
            txt = f"Live mirror close failed for {epic}. Reason: {reason}."
            self._notify_close_failure_once(
                rec=rec,
                subject="Live mirror close failure alert (manual)",
                text=txt,
                reason=reason,
                scope="manual_live",
            )
        except Exception:
            pass

    def _close_demo_position(
        self,
        *,
        rec: Dict[str, Any],
        close_dir: str,
        headers: Dict[str, str],
        preferred_deal_id: Optional[str],
        debug: bool,
    ) -> Dict[str, Any]:
        resolved_ok, resolved_deal_id, resolved_size, resolved_msg, hdrs = (
            self._resolve_demo_close_target(
                rec=rec,
                close_dir=close_dir,
                headers=dict(headers or {}),
                preferred_deal_id=preferred_deal_id,
            )
        )
        if not resolved_ok and resolved_msg == "demo_already_closed":
            return self._close_result(
                account="demo",
                ok=True,
                status="already_closed",
                message="demo_already_closed",
                deal_id=resolved_deal_id,
                closed_at_utc=datetime.utcnow()
                .replace(tzinfo=timezone.utc)
                .isoformat(),
            )
        if not resolved_ok and resolved_msg != "demo_missing_deal_id_on_match":
            return self._close_result(
                account="demo",
                ok=False,
                status="error",
                message=str(resolved_msg or "demo_close_target_unresolved"),
                deal_id=resolved_deal_id,
            )

        epic = str((rec or {}).get("epic") or "").strip().upper()
        open_dir = (rec.get("direction") or "").strip().upper()
        if open_dir not in {"BUY", "SELL"}:
            open_dir = "BUY" if str(close_dir).strip().upper() == "SELL" else "SELL"
        try:
            qty = float(resolved_size or rec.get("size") or 0.0)
        except Exception:
            qty = 0.0
        if qty <= 0:
            return self._close_result(
                account="demo",
                ok=False,
                status="error",
                message="invalid_demo_size",
                deal_id=resolved_deal_id,
            )

        order = {
            "epic": epic,
            "direction": close_dir,
            "size": round(float(qty), 6),
            "orderType": "MARKET",
            "forceOpen": False,
            "guaranteedStop": False,
            "expiry": "-",
        }
        if isinstance(resolved_deal_id, str) and resolved_deal_id:
            order["dealId"] = resolved_deal_id
        ok_close, ack, err_close, hdrs_used = submit_close_order(
            CAPITAL_BASE,
            order,
            deal_id=(
                resolved_deal_id
                if isinstance(resolved_deal_id, str) and resolved_deal_id
                else None
            ),
            allow_post_fallback_on_delete_failure=True,
            debug=debug,
            headers=hdrs,
        )
        if not ok_close:
            return self._close_result(
                account="demo",
                ok=False,
                status="submit_failed",
                message=str(err_close or "demo_close_failed"),
                ack=ack if isinstance(ack, dict) else None,
                deal_id=resolved_deal_id,
            )
        fill_price, confirm_status = self._extract_fill_price_from_ack(
            base_url=CAPITAL_BASE,
            headers=hdrs_used,
            ack=ack,
        )
        if confirm_status in {"REJECTED", "FAILED", "ERROR"}:
            return self._close_result(
                account="demo",
                ok=False,
                status="confirm_rejected",
                message=f"demo_close_{str(confirm_status).lower()}",
                ack=ack,
                fill_price=fill_price,
                deal_id=resolved_deal_id,
                confirm_status=confirm_status,
            )
        still_open_after = self._position_still_open(
            base_url=CAPITAL_BASE,
            headers=hdrs_used,
            epic=epic,
            open_direction=open_dir,
            deal_id=resolved_deal_id,
        )
        if still_open_after is None or still_open_after:
            return self._close_result(
                account="demo",
                ok=False,
                status="still_open",
                message=(
                    "demo_still_open_after_close"
                    if still_open_after
                    else "demo_state_unknown_after_close"
                ),
                ack=ack,
                fill_price=fill_price,
                deal_id=resolved_deal_id,
                still_open_after=still_open_after,
                confirm_status=confirm_status,
            )
        return self._close_result(
            account="demo",
            ok=True,
            status="ok",
            message="ok",
            ack=ack,
            fill_price=fill_price,
            deal_id=resolved_deal_id,
            still_open_after=still_open_after,
            closed_at_utc=datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
            confirm_status=confirm_status,
        )

    def _close_live_mirror(
        self,
        *,
        rec: Dict[str, Any],
        close_dir: str,
        deal_id: Optional[str],
        debug: bool,
    ) -> Dict[str, Any]:
        live_meta = self._get_live_account_meta(rec)
        if not isinstance(live_meta, dict):
            return self._close_result(
                account="live",
                ok=True,
                status="not_required",
                message="live_not_required",
                required=False,
            )

        epic = str((rec or {}).get("epic") or "").strip().upper()

        resolved_ok, resolved_deal_id, resolved_size, resolved_msg, hdrs = (
            self._resolve_live_close_target(
                rec=rec,
                close_dir=close_dir,
                debug=debug,
                preferred_deal_id=deal_id,
            )
        )
        if not resolved_ok:
            if resolved_msg == "live_already_closed":
                return self._close_result(
                    account="live",
                    ok=True,
                    status="already_closed",
                    message="live_already_closed",
                    deal_id=resolved_deal_id,
                    closed_at_utc=datetime.utcnow()
                    .replace(tzinfo=timezone.utc)
                    .isoformat(),
                )
            return self._close_result(
                account="live",
                ok=False,
                status="error",
                message=str(resolved_msg or "live_close_target_unresolved"),
                deal_id=resolved_deal_id,
            )
        if not (isinstance(resolved_deal_id, str) and resolved_deal_id):
            return self._close_result(
                account="live", ok=False, status="error", message="missing_live_deal_id"
            )
        try:
            qty = float(
                resolved_size or live_meta.get("size") or rec.get("size") or 0.0
            )
        except Exception:
            qty = 0.0
        if qty <= 0:
            return self._close_result(
                account="live",
                ok=False,
                status="error",
                message="invalid_live_size",
                deal_id=resolved_deal_id,
            )
        open_dir = (rec.get("direction") or "").strip().upper()
        if open_dir not in {"BUY", "SELL"}:
            open_dir = "BUY" if str(close_dir).strip().upper() == "SELL" else "SELL"

        order = {
            "epic": epic,
            "direction": close_dir,
            "size": round(float(qty), 6),
            "orderType": "MARKET",
            "forceOpen": False,
            "guaranteedStop": False,
            "expiry": "-",
            "dealId": resolved_deal_id,
        }
        ok_close, ack, err_close, _ = submit_close_order(
            LIVE_CAPITAL_BASE,
            order,
            deal_id=resolved_deal_id,
            allow_post_fallback_on_delete_failure=False,
            debug=debug,
            headers=hdrs,
        )
        if not ok_close:
            return self._close_result(
                account="live",
                ok=False,
                status="submit_failed",
                message=str(err_close or "live_close_failed"),
                ack=ack if isinstance(ack, dict) else None,
                deal_id=resolved_deal_id,
            )
        fill_price, confirm_status = self._extract_fill_price_from_ack(
            base_url=LIVE_CAPITAL_BASE,
            headers=hdrs,
            ack=ack,
        )
        if confirm_status in {"REJECTED", "FAILED", "ERROR"}:
            return self._close_result(
                account="live",
                ok=False,
                status="confirm_rejected",
                message=f"live_close_{str(confirm_status).lower()}",
                ack=ack,
                fill_price=fill_price,
                deal_id=resolved_deal_id,
                confirm_status=confirm_status,
            )
        still_open_after = self._position_still_open(
            base_url=LIVE_CAPITAL_BASE,
            headers=hdrs,
            epic=epic,
            open_direction=open_dir,
            deal_id=resolved_deal_id,
        )
        if still_open_after is None or still_open_after:
            return self._close_result(
                account="live",
                ok=False,
                status="still_open",
                message=(
                    "live_still_open_after_close"
                    if still_open_after
                    else "live_state_unknown_after_close"
                ),
                ack=ack,
                fill_price=fill_price,
                deal_id=resolved_deal_id,
                still_open_after=still_open_after,
                confirm_status=confirm_status,
            )
        return self._close_result(
            account="live",
            ok=True,
            status="ok",
            message="ok",
            ack=ack,
            fill_price=fill_price,
            deal_id=resolved_deal_id,
            still_open_after=still_open_after,
            closed_at_utc=datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
            confirm_status=confirm_status,
        )

    def _close_demo_and_live_parallel(
        self,
        *,
        rec: Dict[str, Any],
        close_dir: str,
        preferred_demo_deal_id: Optional[str],
        headers: Dict[str, str],
        debug: bool,
    ) -> Dict[str, Dict[str, Any]]:
        results: Dict[str, Dict[str, Any]] = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_map = {
                executor.submit(
                    self._close_demo_position,
                    rec=rec,
                    close_dir=close_dir,
                    headers=dict(headers or {}),
                    preferred_deal_id=preferred_demo_deal_id,
                    debug=debug,
                ): "demo",
                executor.submit(
                    self._close_live_mirror,
                    rec=rec,
                    close_dir=close_dir,
                    deal_id=None,
                    debug=debug,
                ): "live",
            }
            for future, label in list(future_map.items()):
                try:
                    results[label] = future.result()
                except Exception as e:
                    results[label] = self._close_result(
                        account=label,
                        ok=False,
                        status="exception",
                        message=f"{label}_close_exception:{e}",
                    )
        return results

    def _build_pending_parallel_close_record(
        self,
        *,
        rec: Dict[str, Any],
        reason: str,
        demo_result: Dict[str, Any],
        live_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        rec2 = dict(rec)
        now_iso = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        demo_done = bool((demo_result or {}).get("ok"))
        live_done = bool((live_result or {}).get("ok"))

        rec2["close_pending"] = not (demo_done and live_done)
        rec2["pending_close_reason"] = reason
        rec2["last_close_stage"] = "parallel"
        rec2["last_close_attempt_utc"] = now_iso
        rec2["demo_close_pending"] = not demo_done
        rec2["live_close_pending"] = not live_done
        rec2["demo_close_status"] = demo_result.get("status")
        rec2["live_close_status"] = live_result.get("status")
        rec2["demo_close_reason"] = demo_result.get("message")
        rec2["live_close_reason"] = live_result.get("message")
        rec2["demo_close_ack"] = demo_result.get("ack")
        rec2["live_close_ack"] = live_result.get("ack")
        if isinstance(demo_result.get("fill_price"), (int, float)):
            rec2["demo_close_fill_price"] = float(demo_result.get("fill_price"))
        if isinstance(live_result.get("fill_price"), (int, float)):
            rec2["live_close_fill_price"] = float(live_result.get("fill_price"))
        if demo_done:
            rec2["demo_closed_at_utc"] = demo_result.get("closed_at_utc") or now_iso
        if live_done and bool((live_result or {}).get("required")):
            rec2["live_closed_at_utc"] = live_result.get("closed_at_utc") or now_iso

        errors = []
        if not demo_done:
            errors.append(
                str(
                    demo_result.get("message")
                    or demo_result.get("status")
                    or "demo_close_failed"
                )
            )
        if not live_done:
            errors.append(
                str(
                    live_result.get("message")
                    or live_result.get("status")
                    or "live_close_failed"
                )
            )
        rec2["last_close_error"] = "; ".join(errors) if errors else None
        rec2["last_live_close_error"] = (
            str(live_result.get("message") or "") if not live_done else None
        )
        return rec2
