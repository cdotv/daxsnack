import json
import tempfile
import threading
import time
import unittest

from core.capital_stream import (
    CapitalStreamSession,
    CoalescingQuoteWorker,
    ReconnectBackoff,
    SerialActionWorker,
    StreamHealth,
    merge_quote_payload,
)


class _FakeWebSocket:
    def __init__(
        self,
        endpoint,
        *,
        on_open,
        on_message,
        on_close,
        on_error,
        acknowledge_pings=True,
    ):
        self.endpoint = endpoint
        self.on_open = on_open
        self.on_message = on_message
        self.on_close = on_close
        self.on_error = on_error
        self.acknowledge_pings = acknowledge_pings
        self.sent = []
        self.ping_sent = threading.Event()
        self.closed = threading.Event()
        self._close_lock = threading.Lock()
        self._close_callback_sent = False

    def run_forever(self, **kwargs):
        self.on_open(self)
        self.closed.wait(2.0)
        self._emit_close()

    def send(self, message):
        data = json.loads(message)
        self.sent.append(data)
        if self.acknowledge_pings and data.get("destination") == "ping":
            self.on_message(
                self,
                json.dumps(
                    {
                        "destination": "ping",
                        "correlationId": data.get("correlationId"),
                        "status": "OK",
                    }
                ),
            )
        if data.get("destination") == "ping":
            self.ping_sent.set()

    def close(self):
        self.closed.set()
        self._emit_close()

    def _emit_close(self):
        with self._close_lock:
            if self._close_callback_sent:
                return
            self._close_callback_sent = True
        self.on_close(self, 1000, "closed")


class TestReconnectBackoff(unittest.TestCase):
    def test_backoff_is_bounded_and_resets(self):
        backoff = ReconnectBackoff(
            initial_seconds=5,
            maximum_seconds=20,
            jitter_fraction=0,
        )
        self.assertEqual([backoff.next_delay() for _ in range(5)], [5, 10, 20, 20, 20])
        backoff.reset()
        self.assertEqual(backoff.next_delay(), 5)


class TestStreamHealth(unittest.TestCase):
    def test_idle_reason_is_removed_when_stream_leaves_idle(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            health = StreamHealth(tmpdir, "test", write_interval_seconds=0)
            health.update(
                force=True,
                state="idle",
                idle_reason="no_open_trades",
            )
            self.assertEqual(health.snapshot().get("idle_reason"), "no_open_trades")

            health.update(force=True, state="connected")

            snapshot = health.snapshot()
            self.assertEqual(snapshot.get("state"), "connected")
            self.assertNotIn("idle_reason", snapshot)
            with open(health.path, "r", encoding="utf-8") as handle:
                persisted = json.load(handle)
            self.assertNotIn("idle_reason", persisted)


class TestQuoteCoalescing(unittest.TestCase):
    def test_merge_keeps_latest_and_both_touch_extremes(self):
        merged = None
        for quote in (
            {"epic": "X", "bid": 100.0, "ofr": 100.2, "timestamp": 1},
            {"epic": "X", "bid": 99.0, "ofr": 99.2, "timestamp": 2},
            {"epic": "X", "bid": 101.0, "ofr": 101.2, "timestamp": 3},
            {"epic": "X", "bid": 100.5, "ofr": 100.7, "timestamp": 4},
        ):
            merged = merge_quote_payload(merged, quote)
        self.assertEqual(merged["timestamp"], 4)
        self.assertEqual(merged["_long_touch"]["ofr"], 101.2)
        self.assertEqual(merged["_long_touch"]["timestamp"], 3)
        self.assertEqual(merged["_short_touch"]["bid"], 99.0)
        self.assertEqual(merged["_short_touch"]["timestamp"], 2)
        self.assertEqual(merged["_coalesced_count"], 4)

    def test_worker_is_bounded_by_epic(self):
        worker = CoalescingQuoteWorker(
            name="bounded-test", processor=lambda _key, _payload: None, max_keys=3
        )
        for number in range(20):
            worker.submit(
                str(number), {"epic": str(number), "bid": number, "ofr": number + 0.1}
            )
        self.assertEqual(worker.pending_count(), 3)

    def test_rate_limit_coalesces_quotes_without_losing_touch_extremes(self):
        processed = []
        first_done = threading.Event()
        second_done = threading.Event()

        def process(_key, payload):
            processed.append((time.monotonic(), payload))
            (first_done if len(processed) == 1 else second_done).set()

        worker = CoalescingQuoteWorker(
            name="rate-limit-test",
            processor=process,
            max_keys=3,
            min_interval_seconds=0.08,
        )
        worker.start()
        worker.submit("X", {"epic": "X", "bid": 100.0, "ofr": 100.2})
        self.assertTrue(first_done.wait(0.5))
        for quote in (
            {"epic": "X", "bid": 99.0, "ofr": 99.2, "timestamp": 2},
            {"epic": "X", "bid": 102.0, "ofr": 102.2, "timestamp": 3},
            {"epic": "X", "bid": 101.0, "ofr": 101.2, "timestamp": 4},
        ):
            worker.submit("X", quote)
        self.assertTrue(second_done.wait(0.5))
        worker.stop()

        self.assertGreaterEqual(processed[1][0] - processed[0][0], 0.06)
        payload = processed[1][1]
        self.assertEqual(payload["timestamp"], 4)
        self.assertEqual(payload["_long_touch"]["ofr"], 102.2)
        self.assertEqual(payload["_short_touch"]["bid"], 99.0)


class TestSerialActionWorker(unittest.TestCase):
    def test_actions_are_deduplicated_and_serial(self):
        release = threading.Event()
        started = threading.Event()
        completed = []

        def action(value):
            started.set()
            release.wait(1.0)
            completed.append(value)

        worker = SerialActionWorker(name="action-test", max_pending=3)
        worker.start()
        self.assertTrue(worker.submit("same", action, 1))
        self.assertFalse(worker.submit("same", action, 2))
        self.assertTrue(started.wait(0.5))
        self.assertTrue(worker.submit("next", action, 3))
        release.set()
        deadline = time.monotonic() + 1.0
        while len(completed) < 2 and time.monotonic() < deadline:
            time.sleep(0.01)
        worker.stop()
        self.assertEqual(completed, [1, 3])

    def test_replace_pending_runs_the_latest_value_after_current(self):
        release = threading.Event()
        started = threading.Event()
        completed = []

        def action(value):
            started.set()
            if value == 1:
                release.wait(1.0)
            completed.append(value)

        worker = SerialActionWorker(name="replace-action-test", max_pending=3)
        worker.start()
        self.assertTrue(worker.submit("publish", action, 1))
        self.assertTrue(started.wait(0.5))
        self.assertTrue(worker.submit("publish", action, 2, replace_pending=True))
        self.assertTrue(worker.submit("publish", action, 3, replace_pending=True))
        release.set()
        deadline = time.monotonic() + 1.0
        while len(completed) < 2 and time.monotonic() < deadline:
            time.sleep(0.01)
        worker.stop()
        self.assertEqual(completed, [1, 3])


class TestCapitalStreamSession(unittest.TestCase):
    def _session(self, tmpdir, *, acknowledge_pings, ping_timeout_seconds=0.04):
        holder = {}

        def factory(endpoint, **callbacks):
            ws = _FakeWebSocket(
                endpoint, acknowledge_pings=acknowledge_pings, **callbacks
            )
            holder["ws"] = ws
            return ws

        health = StreamHealth(tmpdir, "test", write_interval_seconds=0)
        session = CapitalStreamSession(
            name="test-stream",
            endpoint="wss://example.invalid/connect",
            tokens={"CST": "cst", "X-SECURITY-TOKEN": "security"},
            ping_seconds=0.03,
            ping_timeout_seconds=ping_timeout_seconds,
            stable_after_seconds=0,
            on_open=lambda current, _ws: current.send({"destination": "subscribe"}),
            on_message=lambda _session, _ws, _message: None,
            health=health,
            websocket_factory=factory,
            helper_join_timeout_seconds=0.5,
        )
        return session, holder, health

    def test_heartbeat_ack_is_tracked_and_helpers_finish(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session, holder, health = self._session(tmpdir, acknowledge_pings=True)

            def close_after_ping():
                deadline = time.monotonic() + 1.0
                while "ws" not in holder and time.monotonic() < deadline:
                    time.sleep(0.001)
                ws = holder.get("ws")
                if ws is not None:
                    ws.ping_sent.wait(0.5)
                session.close("test_complete")

            closer = threading.Thread(target=close_after_ping)
            closer.start()
            session.run()
            closer.join()

            pings = [m for m in holder["ws"].sent if m.get("destination") == "ping"]
            self.assertGreaterEqual(len(pings), 1)
            snapshot = health.snapshot()
            self.assertEqual(snapshot.get("heartbeat"), "ok")
            self.assertEqual(snapshot.get("state"), "disconnected")
            self.assertFalse(any(thread.is_alive() for thread in session._helpers))
            with self.assertRaises(RuntimeError):
                session.send({"destination": "stale"})

    def test_missing_heartbeat_ack_closes_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session, holder, health = self._session(tmpdir, acknowledge_pings=False)
            session.run()
            self.assertEqual(session._close_reason, "heartbeat_timeout")
            self.assertEqual(health.snapshot().get("heartbeat"), "timeout")
            self.assertTrue(holder["ws"].closed.is_set())
            self.assertFalse(any(thread.is_alive() for thread in session._helpers))

    def test_repeated_sessions_do_not_reuse_events_or_leave_helpers(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            sessions = []
            for _number in range(5):
                session, _holder, _health = self._session(
                    tmpdir, acknowledge_pings=False
                )
                session.run()
                sessions.append(session)
            self.assertEqual(
                len({id(session.stop_event) for session in sessions}), len(sessions)
            )
            self.assertTrue(all(session.stop_event.is_set() for session in sessions))
            self.assertFalse(
                any(
                    thread.is_alive() and thread.name.startswith("test-stream-")
                    for thread in threading.enumerate()
                )
            )

    def test_subscription_state_is_owned_by_each_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            first, _first_holder, _first_health = self._session(
                tmpdir, acknowledge_pings=True
            )
            second, _second_holder, _second_health = self._session(
                tmpdir, acknowledge_pings=True
            )
            first.replace_subscriptions({"ONE", "TWO"})
            second.replace_subscriptions({"THREE"})
            first.remove_subscriptions({"ONE"})

            self.assertEqual(first.subscribed_epics(), {"TWO"})
            self.assertEqual(second.subscribed_epics(), {"THREE"})

    def test_remote_close_wakes_heartbeat_ack_wait_immediately(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session, _holder, health = self._session(
                tmpdir,
                acknowledge_pings=False,
                ping_timeout_seconds=1.0,
            )
            timer = threading.Timer(0.06, lambda: session.close("remote_test"))
            started = time.monotonic()
            timer.start()
            session.run()
            timer.join()
            self.assertLess(time.monotonic() - started, 0.4)
            self.assertNotEqual(health.snapshot().get("heartbeat"), "timeout")
            self.assertFalse(any(thread.is_alive() for thread in session._helpers))


if __name__ == "__main__":
    unittest.main()
