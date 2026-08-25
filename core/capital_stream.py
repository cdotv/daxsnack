"""Shared runtime primitives for Capital.com websocket streams.

The important invariant in this module is that every websocket connection owns
its event, tokens, socket and helper threads.  A helper from an old connection
can therefore never send through a newer connection.
"""

from __future__ import annotations

import json
import os
import queue
import random
import threading
import time
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional, Sequence, Tuple

import websocket


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ReconnectBackoff:
    """Bounded exponential reconnect delay with jitter."""

    def __init__(
        self,
        initial_seconds: float = 5.0,
        maximum_seconds: float = 300.0,
        factor: float = 2.0,
        jitter_fraction: float = 0.2,
        random_fn: Callable[[], float] = random.random,
    ) -> None:
        self.initial_seconds = max(0.0, float(initial_seconds))
        self.maximum_seconds = max(self.initial_seconds, float(maximum_seconds))
        self.factor = max(1.0, float(factor))
        self.jitter_fraction = min(1.0, max(0.0, float(jitter_fraction)))
        self._random_fn = random_fn
        self._attempt = 0

    @property
    def attempt(self) -> int:
        return self._attempt

    def reset(self) -> None:
        self._attempt = 0

    def next_delay(self) -> float:
        # Once the cap is reachable, avoid ever evaluating an enormous power.
        exponent = min(self._attempt, 64)
        try:
            raw = min(
                self.maximum_seconds,
                self.initial_seconds * (self.factor**exponent),
            )
        except OverflowError:
            raw = self.maximum_seconds
        self._attempt += 1
        if raw <= 0.0 or self.jitter_fraction <= 0.0:
            return raw
        # Map [0, 1] to [-jitter, +jitter].
        scale = 1.0 + ((2.0 * float(self._random_fn()) - 1.0) * self.jitter_fraction)
        return max(0.0, min(self.maximum_seconds, raw * scale))


class StreamHealth:
    """Thread-safe, throttled JSON health snapshot for a stream process."""

    def __init__(
        self,
        base_dir: str,
        stream_name: str,
        *,
        write_interval_seconds: float = 1.0,
    ) -> None:
        safe_name = "".join(
            c if (c.isalnum() or c in "-_") else "_" for c in stream_name
        )
        self.path = Path(base_dir) / "data" / "stream_health" / f"{safe_name}.json"
        self.stream_name = stream_name
        self.write_interval_seconds = max(0.0, float(write_interval_seconds))
        self._lock = threading.Lock()
        self._write_lock = threading.Lock()
        self._last_write = 0.0
        self._data: Dict[str, Any] = {
            "stream": stream_name,
            "pid": os.getpid(),
            "state": "starting",
            "started_at_utc": _utc_now_iso(),
            "updated_at_utc": _utc_now_iso(),
        }
        self.update(force=True)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._data)

    def update(
        self,
        force: bool = False,
        defer_write: bool = False,
        **values: Any,
    ) -> None:
        now = time.monotonic()
        with self._lock:
            self._data.update(values)
            # State-specific fields must not leak into later lifecycle states.
            # In particular, streams can move from idle to connected while the
            # same health snapshot object remains alive.
            if self._data.get("state") != "idle":
                self._data.pop("idle_reason", None)
            self._data["updated_at_utc"] = _utc_now_iso()
            if defer_write:
                return
            if not force and (now - self._last_write) < self.write_interval_seconds:
                return
            payload = dict(self._data)
            self._last_write = now
        self._write(payload)

    def flush(self) -> None:
        with self._lock:
            payload = dict(self._data)
            self._last_write = time.monotonic()
        self._write(payload)

    def _write(self, payload: Dict[str, Any]) -> None:
        with self._write_lock:
            try:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                suffix = (
                    f".{os.getpid()}.{threading.get_ident()}.{uuid.uuid4().hex}.tmp"
                )
                tmp_path = self.path.with_name(self.path.name + suffix)
                with open(tmp_path, "w", encoding="utf-8") as handle:
                    json.dump(
                        payload, handle, ensure_ascii=False, sort_keys=True, indent=2
                    )
                    handle.flush()
                    os.fsync(handle.fileno())
                os.chmod(tmp_path, 0o600)
                os.replace(tmp_path, self.path)
            except Exception:
                # Health reporting must never take down a trading stream.
                try:
                    if "tmp_path" in locals() and tmp_path.exists():
                        tmp_path.unlink()
                except Exception:
                    pass


PeriodicTask = Tuple[str, float, Callable[["CapitalStreamSession"], None]]


class CapitalStreamSession:
    """One websocket connection and its strictly session-bound helpers."""

    def __init__(
        self,
        *,
        name: str,
        endpoint: str,
        tokens: Dict[str, str],
        ping_seconds: float,
        on_open: Callable[["CapitalStreamSession", Any], None],
        on_message: Callable[["CapitalStreamSession", Any, str], None],
        on_close: Optional[Callable[["CapitalStreamSession", Any, Any], None]] = None,
        on_error: Optional[Callable[["CapitalStreamSession", Any, Any], None]] = None,
        periodic_tasks: Sequence[PeriodicTask] = (),
        health: Optional[StreamHealth] = None,
        ping_timeout_seconds: float = 30.0,
        stable_after_seconds: float = 60.0,
        logger: Optional[Callable[[str, str], None]] = None,
        websocket_factory: Callable[..., Any] = websocket.WebSocketApp,
        helper_join_timeout_seconds: float = 5.0,
    ) -> None:
        self.name = name
        self.endpoint = endpoint
        self.tokens = dict(tokens or {})
        self.ping_seconds = max(0.05, float(ping_seconds))
        self.ping_timeout_seconds = max(0.05, float(ping_timeout_seconds))
        self.stable_after_seconds = max(0.0, float(stable_after_seconds))
        self.on_open = on_open
        self.on_message = on_message
        self.on_close = on_close
        self.on_error = on_error
        self.periodic_tasks = tuple(periodic_tasks)
        self.health = health
        self.logger = logger
        self.websocket_factory = websocket_factory
        self.helper_join_timeout_seconds = max(0.0, float(helper_join_timeout_seconds))

        self.session_id = uuid.uuid4().hex[:16]
        self.stop_event = threading.Event()
        self._send_lock = threading.Lock()
        self._heartbeat_lock = threading.Lock()
        self._heartbeat_ack = threading.Event()
        self._pending_ping_correlation: Optional[str] = None
        self._ping_counter = 0
        self._subscriptions_lock = threading.Lock()
        self._subscribed_epics: set[str] = set()
        self._helpers: list[threading.Thread] = []
        self._ws: Any = None
        self._opened_monotonic: Optional[float] = None
        self._closed_monotonic: Optional[float] = None
        self._close_reason = "websocket_returned"

    @property
    def connected_seconds(self) -> float:
        if self._opened_monotonic is None:
            return 0.0
        end = (
            self._closed_monotonic
            if self._closed_monotonic is not None
            else time.monotonic()
        )
        return max(0.0, end - self._opened_monotonic)

    @property
    def was_stable(self) -> bool:
        return self.connected_seconds >= self.stable_after_seconds

    @property
    def active(self) -> bool:
        return self._opened_monotonic is not None and not self.stop_event.is_set()

    def run(self) -> float:
        self._health_update(
            force=True,
            state="connecting",
            session_id=self.session_id,
            endpoint=self.endpoint,
            last_error=None,
            heartbeat="not_sent",
            last_rx_at_utc=None,
            last_quote_at_utc=None,
            last_quote_epic=None,
            last_ping_sent_at_utc=None,
            last_ping_ack_at_utc=None,
        )
        self._ws = self.websocket_factory(
            self.endpoint,
            on_open=self._handle_open,
            on_message=self._handle_message,
            on_close=self._handle_close,
            on_error=self._handle_error,
        )
        try:
            self._ws.run_forever(ping_interval=None, ping_timeout=None)
        finally:
            self.stop_event.set()
            self._heartbeat_ack.set()
            self._closed_monotonic = time.monotonic()
            try:
                self._ws.close()
            except Exception:
                pass
            self._join_helpers()
            final_health: Dict[str, Any] = {
                "state": "disconnected",
                "session_id": self.session_id,
                "disconnected_at_utc": _utc_now_iso(),
                "connected_seconds": round(self.connected_seconds, 3),
                "close_reason": self._close_reason,
            }
            if self.health is not None:
                snapshot = self.health.snapshot()
                if snapshot.get("heartbeat") == "waiting_ack":
                    # A normal close can race between recording a ping and
                    # sending it.  Do not leave a disconnected stream looking
                    # as though it still has an outstanding heartbeat.
                    final_health["heartbeat"] = (
                        "ok" if snapshot.get("last_ping_ack_at_utc") else "stopped"
                    )
            self._health_update(force=True, **final_health)
        return self.connected_seconds

    def send(self, payload: Dict[str, Any]) -> None:
        if self.stop_event.is_set():
            raise RuntimeError(f"stale websocket session {self.session_id}")
        message = json.dumps(payload, separators=(",", ":"))
        with self._send_lock:
            if self.stop_event.is_set() or self._ws is None:
                raise RuntimeError(f"inactive websocket session {self.session_id}")
            self._ws.send(message)

    def close(self, reason: str) -> None:
        if reason:
            self._close_reason = str(reason)
        self.stop_event.set()
        self._heartbeat_ack.set()
        try:
            if self._ws is not None:
                self._ws.close()
        except Exception:
            pass

    def set_subscribed_count(self, count: int) -> None:
        self._health_update(subscribed_epics=max(0, int(count)))

    def subscribed_epics(self) -> set[str]:
        with self._subscriptions_lock:
            return set(self._subscribed_epics)

    def replace_subscriptions(self, epics: Iterable[str]) -> None:
        with self._subscriptions_lock:
            self._subscribed_epics = {str(epic) for epic in epics}
            count = len(self._subscribed_epics)
        self.set_subscribed_count(count)

    def add_subscriptions(self, epics: Iterable[str]) -> None:
        with self._subscriptions_lock:
            self._subscribed_epics.update(str(epic) for epic in epics)
            count = len(self._subscribed_epics)
        self.set_subscribed_count(count)

    def remove_subscriptions(self, epics: Iterable[str]) -> None:
        with self._subscriptions_lock:
            self._subscribed_epics.difference_update(str(epic) for epic in epics)
            count = len(self._subscribed_epics)
        self.set_subscribed_count(count)

    def _handle_open(self, ws: Any) -> None:
        self._opened_monotonic = time.monotonic()
        self._health_update(
            force=True,
            state="connected",
            session_id=self.session_id,
            connected_at_utc=_utc_now_iso(),
        )
        self._log(
            "info", f"[{self.name}] websocket connected session={self.session_id}"
        )
        try:
            self.on_open(self, ws)
        except Exception as exc:
            self._handle_error(ws, exc)
            self.close("on_open_failed")
            return
        self._start_helper("heartbeat", self._heartbeat_loop)
        if self.health is not None:
            self._start_helper("health", self._health_loop)
        for task_name, interval, callback in self.periodic_tasks:
            self._start_helper(
                task_name,
                lambda task_name=task_name, interval=interval, callback=callback: self._periodic_loop(
                    task_name, interval, callback
                ),
            )

    def _handle_message(self, ws: Any, message: str) -> None:
        now_iso = _utc_now_iso()
        parsed: Optional[Dict[str, Any]] = None
        try:
            candidate = json.loads(message)
            if isinstance(candidate, dict):
                parsed = candidate
        except Exception:
            pass
        values: Dict[str, Any] = {"last_rx_at_utc": now_iso}
        if parsed is not None and parsed.get("destination") == "quote":
            values["last_quote_at_utc"] = now_iso
            payload = parsed.get("payload")
            if isinstance(payload, dict) and isinstance(payload.get("epic"), str):
                values["last_quote_epic"] = payload.get("epic")
        self._health_update(defer_write=True, **values)

        if parsed is not None and parsed.get("destination") == "ping":
            correlation = str(parsed.get("correlationId") or "")
            ping_payload = parsed.get("payload")
            if not isinstance(ping_payload, dict):
                ping_payload = {}
            status = str(
                parsed.get("status") or ping_payload.get("status") or ""
            ).upper()
            with self._heartbeat_lock:
                pending = self._pending_ping_correlation
                if (
                    pending
                    and correlation == pending
                    and status in {"", "OK", "SUCCESS"}
                ):
                    self._pending_ping_correlation = None
                    self._heartbeat_ack.set()
                    self._health_update(
                        defer_write=True,
                        last_ping_ack_at_utc=now_iso,
                        heartbeat="ok",
                    )

        try:
            self.on_message(self, ws, message)
        except Exception as exc:
            self._handle_error(ws, exc)

    def _handle_close(self, ws: Any, *args: Any) -> None:
        self.stop_event.set()
        self._heartbeat_ack.set()
        self._closed_monotonic = time.monotonic()
        if self._close_reason == "websocket_returned":
            self._close_reason = "remote_or_transport_close"
        self._log("info", f"[{self.name}] websocket closed session={self.session_id}")
        if self.on_close is not None:
            try:
                self.on_close(self, ws, *args)
            except Exception:
                pass

    def _handle_error(self, ws: Any, error: Any) -> None:
        self._health_update(
            force=True, last_error=str(error), last_error_at_utc=_utc_now_iso()
        )
        self._log(
            "error", f"[{self.name}] websocket error session={self.session_id}: {error}"
        )
        if self.on_error is not None:
            try:
                self.on_error(self, ws, error)
            except Exception:
                pass

    def _heartbeat_loop(self) -> None:
        while not self.stop_event.wait(self.ping_seconds):
            self._ping_counter += 1
            correlation = f"{self.session_id}-ping-{self._ping_counter}"
            with self._heartbeat_lock:
                self._pending_ping_correlation = correlation
                self._heartbeat_ack.clear()
            try:
                self._health_update(
                    last_ping_sent_at_utc=_utc_now_iso(), heartbeat="waiting_ack"
                )
                self.send(
                    {
                        "destination": "ping",
                        "correlationId": correlation,
                        "cst": self.tokens.get("CST"),
                        "securityToken": self.tokens.get("X-SECURITY-TOKEN"),
                    }
                )
            except Exception as exc:
                if self.stop_event.is_set():
                    return
                self._health_update(
                    force=True, heartbeat="send_failed", last_error=str(exc)
                )
                self.close("heartbeat_send_failed")
                return
            acknowledged = self._heartbeat_ack.wait(self.ping_timeout_seconds)
            if self.stop_event.is_set():
                return
            if not acknowledged:
                self._health_update(
                    force=True,
                    heartbeat="timeout",
                    last_error="heartbeat acknowledgement timeout",
                )
                self._log(
                    "error",
                    f"[{self.name}] heartbeat acknowledgement timed out session={self.session_id}",
                )
                self.close("heartbeat_timeout")
                return

    def _health_loop(self) -> None:
        while not self.stop_event.wait(1.0):
            if self.health is not None:
                self.health.flush()

    def _periodic_loop(
        self,
        task_name: str,
        interval_seconds: float,
        callback: Callable[["CapitalStreamSession"], None],
    ) -> None:
        interval = max(0.05, float(interval_seconds))
        while not self.stop_event.wait(interval):
            started = time.monotonic()
            try:
                callback(self)
                self._health_update(
                    **{
                        f"last_{task_name}_at_utc": _utc_now_iso(),
                        f"last_{task_name}_seconds": round(
                            time.monotonic() - started, 3
                        ),
                    }
                )
            except Exception as exc:
                self._health_update(
                    force=True,
                    **{
                        f"last_{task_name}_error": str(exc),
                        f"last_{task_name}_error_at_utc": _utc_now_iso(),
                    },
                )
                self._log(
                    "error", f"[{self.name}] periodic task {task_name} failed: {exc}"
                )

    def _start_helper(self, suffix: str, target: Callable[[], None]) -> None:
        thread = threading.Thread(
            target=target,
            name=f"{self.name}-{self.session_id}-{suffix}",
            daemon=True,
        )
        self._helpers.append(thread)
        thread.start()

    def _join_helpers(self) -> None:
        current = threading.current_thread()
        for helper in self._helpers:
            if helper is current:
                continue
            helper.join(self.helper_join_timeout_seconds)
        lingering = [
            helper.name
            for helper in self._helpers
            if helper.is_alive() and helper is not current
        ]
        if lingering:
            self._health_update(force=True, lingering_helpers=lingering)
            self._log(
                "error",
                f"[{self.name}] session helpers still finishing: {', '.join(lingering)}",
            )
        else:
            self._health_update(lingering_helpers=[])

    def _health_update(
        self,
        force: bool = False,
        defer_write: bool = False,
        **values: Any,
    ) -> None:
        if self.health is not None:
            self.health.update(
                force=force,
                defer_write=defer_write,
                **values,
            )

    def _log(self, level: str, message: str) -> None:
        if self.logger is not None:
            try:
                self.logger(level, message)
            except Exception:
                pass


def merge_quote_payload(
    previous: Optional[Dict[str, Any]], latest: Dict[str, Any]
) -> Dict[str, Any]:
    """Coalesce quotes while retaining exact long/short touch extrema."""

    now = time.monotonic()
    incoming = dict(latest)
    if previous is None:
        result = dict(incoming)
        result["_first_received_monotonic"] = now
        result["_received_monotonic"] = now
        result["_coalesced_count"] = 1
        result["_long_touch"] = dict(incoming)
        result["_short_touch"] = dict(incoming)
        return result

    result = dict(incoming)
    result["_first_received_monotonic"] = previous.get("_first_received_monotonic", now)
    result["_received_monotonic"] = now
    result["_coalesced_count"] = int(previous.get("_coalesced_count", 1) or 1) + 1

    prev_long = previous.get("_long_touch")
    if not isinstance(prev_long, dict):
        prev_long = previous
    prev_short = previous.get("_short_touch")
    if not isinstance(prev_short, dict):
        prev_short = previous

    def _number(payload: Dict[str, Any], key: str) -> Optional[float]:
        try:
            value = float(payload.get(key))
            return value if value == value else None
        except Exception:
            return None

    old_ask = _number(prev_long, "ofr")
    new_ask = _number(incoming, "ofr")
    result["_long_touch"] = dict(
        incoming
        if old_ask is None or (new_ask is not None and new_ask >= old_ask)
        else prev_long
    )

    old_bid = _number(prev_short, "bid")
    new_bid = _number(incoming, "bid")
    result["_short_touch"] = dict(
        incoming
        if old_bid is None or (new_bid is not None and new_bid <= old_bid)
        else prev_short
    )
    return result


class CoalescingQuoteWorker:
    """One bounded latest-per-epic worker with touch-extreme preservation."""

    def __init__(
        self,
        *,
        name: str,
        processor: Callable[[str, Dict[str, Any]], None],
        max_keys: int = 40,
        min_interval_seconds: float = 0.0,
        health: Optional[StreamHealth] = None,
    ) -> None:
        self.name = name
        self.processor = processor
        self.max_keys = max(1, int(max_keys))
        self.min_interval_seconds = max(0.0, float(min_interval_seconds))
        self.health = health
        self._condition = threading.Condition()
        self._pending: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        self._last_started: "OrderedDict[str, float]" = OrderedDict()
        self._stopping = False
        self._thread = threading.Thread(target=self._run, name=name, daemon=True)
        self._started = False

    def start(self) -> None:
        with self._condition:
            if self._started:
                return
            self._started = True
            self._thread.start()

    def submit(self, key: str, payload: Dict[str, Any]) -> bool:
        with self._condition:
            if self._stopping:
                return False
            previous = self._pending.pop(key, None)
            if previous is None and len(self._pending) >= self.max_keys:
                # Drop the oldest key, never build unbounded websocket lag.
                self._pending.popitem(last=False)
            self._pending[key] = merge_quote_payload(previous, payload)
            pending_count = len(self._pending)
            self._condition.notify()
        if self.health is not None:
            self.health.update(
                defer_write=True,
                worker_pending_epics=pending_count,
            )
        return True

    def stop(self, timeout_seconds: float = 5.0) -> None:
        with self._condition:
            self._stopping = True
            self._condition.notify_all()
        if self._started and self._thread is not threading.current_thread():
            self._thread.join(max(0.0, float(timeout_seconds)))

    def pending_count(self) -> int:
        with self._condition:
            return len(self._pending)

    def _run(self) -> None:
        while True:
            with self._condition:
                while not self._pending and not self._stopping:
                    self._condition.wait()
                if self._stopping and not self._pending:
                    return
                now = time.monotonic()
                selected_key: Optional[str] = None
                shortest_wait: Optional[float] = None
                for candidate_key in self._pending.keys():
                    wait_seconds = self.min_interval_seconds - (
                        now - float(self._last_started.get(candidate_key, 0.0) or 0.0)
                    )
                    if self._stopping or wait_seconds <= 0.0:
                        selected_key = candidate_key
                        break
                    if shortest_wait is None or wait_seconds < shortest_wait:
                        shortest_wait = wait_seconds
                if selected_key is None:
                    self._condition.wait(timeout=max(0.001, shortest_wait or 0.001))
                    continue
                key = selected_key
                payload = self._pending.pop(key)
                self._last_started[key] = now
                self._last_started.move_to_end(key)
                while len(self._last_started) > (self.max_keys * 4):
                    self._last_started.popitem(last=False)
                pending_count = len(self._pending)
            started = time.monotonic()
            received = float(
                payload.get("_first_received_monotonic", started) or started
            )
            try:
                self.processor(key, payload)
                error = None
            except Exception as exc:
                error = str(exc)
            if self.health is not None:
                values: Dict[str, Any] = {
                    "worker_pending_epics": pending_count,
                    "worker_last_epic": key,
                    "worker_last_lag_seconds": round(max(0.0, started - received), 3),
                    "worker_last_runtime_seconds": round(time.monotonic() - started, 3),
                    "worker_last_completed_at_utc": _utc_now_iso(),
                }
                if error is not None:
                    values["worker_last_error"] = error
                    values["worker_last_error_at_utc"] = _utc_now_iso()
                self.health.update(force=bool(error), **values)


class SerialActionWorker:
    """Bounded, de-duplicated worker for blocking order/exit actions."""

    def __init__(
        self,
        *,
        name: str,
        max_pending: int = 100,
        health: Optional[StreamHealth] = None,
    ) -> None:
        self.name = name
        self.health = health
        self._queue: (
            "queue.Queue[Optional[Tuple[str, Callable[..., None], tuple, dict]]]"
        ) = queue.Queue(maxsize=max(1, int(max_pending)))
        self._keys_lock = threading.Lock()
        self._keys: set[str] = set()
        self._replacements: Dict[str, Tuple[str, Callable[..., None], tuple, dict]] = {}
        self._thread = threading.Thread(target=self._run, name=name, daemon=True)
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._started = True
        self._thread.start()

    def submit(
        self,
        key: str,
        callback: Callable[..., None],
        *args: Any,
        replace_pending: bool = False,
        **kwargs: Any,
    ) -> bool:
        key = str(key)
        with self._keys_lock:
            if key in self._keys:
                if not replace_pending:
                    return False
                self._replacements[key] = (key, callback, args, kwargs)
                return True
            self._keys.add(key)
        try:
            self._queue.put_nowait((key, callback, args, kwargs))
        except queue.Full:
            with self._keys_lock:
                self._keys.discard(key)
            if self.health is not None:
                self.health.update(force=True, action_queue_full=True)
            return False
        if self.health is not None:
            self.health.update(
                defer_write=True,
                action_pending=self._queue.qsize(),
            )
        return True

    def stop(self, timeout_seconds: float = 5.0) -> None:
        if not self._started:
            return
        try:
            self._queue.put_nowait(None)
        except queue.Full:
            return
        self._thread.join(max(0.0, float(timeout_seconds)))

    def _run(self) -> None:
        while True:
            item = self._queue.get()
            if item is None:
                self._queue.task_done()
                return
            key, callback, args, kwargs = item
            error: Optional[str] = None
            replacement = None
            try:
                callback(*args, **kwargs)
            except Exception as exc:
                error = str(exc)
            finally:
                with self._keys_lock:
                    replacement = self._replacements.pop(key, None)
                    if replacement is None:
                        self._keys.discard(key)
                self._queue.task_done()
            if replacement is not None:
                try:
                    self._queue.put_nowait(replacement)
                except queue.Full:
                    with self._keys_lock:
                        self._keys.discard(key)
                        self._replacements.pop(key, None)
                    error = error or "replacement action queue full"
            if self.health is not None:
                values: Dict[str, Any] = {
                    "action_pending": self._queue.qsize(),
                    "action_last_key": key,
                    "action_last_completed_at_utc": _utc_now_iso(),
                }
                if error is not None:
                    values["action_last_error"] = error
                    values["action_last_error_at_utc"] = _utc_now_iso()
                self.health.update(force=bool(error), **values)


def stream_command_logger(
    command: Any, *, debug: bool = False
) -> Callable[[str, str], None]:
    """Return an unthrottled lifecycle logger for a Django command."""

    def _log(level: str, message: str) -> None:
        if level == "info" and not debug:
            return
        target = command.stderr if level == "error" else command.stdout
        target.write(message)

    return _log


def wait_for_reconnect(
    health: StreamHealth,
    backoff: ReconnectBackoff,
    *,
    stable: bool,
    reason: str,
) -> float:
    if stable:
        backoff.reset()
    delay = backoff.next_delay()
    health.update(
        force=True,
        state="reconnecting",
        reconnect_reason=reason,
        reconnect_attempt=backoff.attempt,
        reconnect_delay_seconds=round(delay, 3),
    )
    return delay
