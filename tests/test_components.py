import os
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.devsettings")
os.environ.setdefault(
    "SECRET_KEY",
    "public-tests-only-synthetic-signing-key-with-many-unique-characters",
)  # pragma: allowlist secret

import django

django.setup()

from django.test import Client, SimpleTestCase

from core.capital_auth import get_trade_write_targets, live_new_trades_enabled
from core.file_security import apply_private_umask
from core.mail_delivery import build_multipart_message, build_subscriber_message
from core.privacy import subscriber_log_id
from core.setup_provider import _validate_payload, empty_home_payload
from core.subscription_tokens import (
    SubscriptionTokenError,
    make_subscription_token,
    read_subscription_token,
)

ROOT = Path(__file__).resolve().parents[1]


class PublicComponentTests(unittest.TestCase):
    def test_private_umask_is_applied(self):
        previous = apply_private_umask()
        try:
            current = os.umask(previous)
        finally:
            os.umask(previous)
        self.assertEqual(current, 0o077)

    def test_subscriber_identifier_does_not_expose_address(self):
        address = "subscriber@example.com"
        identifier = subscriber_log_id(address)
        self.assertNotIn(address, identifier)
        self.assertEqual(identifier, subscriber_log_id(address.upper()))

    def test_subscription_tokens_are_tamper_evident_and_purpose_bound(self):
        subscription = SimpleNamespace(pk=42)
        token = make_subscription_token(subscription, "confirm")
        self.assertEqual(
            read_subscription_token(token, "confirm"),
            {"subscription_id": 42},
        )
        with self.assertRaises(SubscriptionTokenError):
            read_subscription_token(token + "x", "confirm")
        with self.assertRaises(SubscriptionTokenError):
            read_subscription_token(token, "unsubscribe")

    def test_mail_is_multipart_and_supports_one_click_unsubscribe(self):
        message = build_multipart_message(
            subject="Confirmation",
            text="Plain text",
            html="<p>HTML</p>",
            to="recipient@example.com",
        )
        self.assertEqual(message.body, "Plain text")
        self.assertEqual(message.alternatives[0].mimetype, "text/html")

        subscriber_message = build_subscriber_message(
            subject="Notification",
            text="Plain text",
            html="<p>HTML</p>",
            subscription=SimpleNamespace(pk=42, email="recipient@example.com"),
            site_url="https://example.com",
        )
        self.assertEqual(
            subscriber_message.extra_headers["List-Unsubscribe-Post"],
            "List-Unsubscribe=One-Click",
        )


class PublicApplicationTests(SimpleTestCase):
    def test_homepage_runs_without_a_private_provider(self):
        response = Client().get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "your universe. your strategy. your setup.")
        self.assertNotContains(response, "Configure SITE_OWNER_ADDRESS")

    def test_provider_boundary_accepts_only_strict_documented_payloads(self):
        payload = _validate_payload(
            {
                "setup_payload": {
                    "best": {
                        "instrument": {"name": "Example Market"},
                        "strategy": "example_strategy",
                    }
                }
            }
        )
        self.assertEqual(payload["running_items"], [])
        with self.assertRaises(Exception):
            _validate_payload({"private_internal_state": True})
        with self.assertRaises(Exception):
            _validate_payload({"setup_payload": float("nan")})

    def test_empty_payload_contains_no_market_or_performance_values(self):
        payload = empty_home_payload()
        self.assertIsNone(payload["setup_payload"])
        self.assertIsNone(payload["account_total_delta_pct"])
        self.assertEqual(payload["running_items"], [])

    def test_live_broker_writes_are_opt_in(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CAPITAL_LIVE_NEW_TRADES_ENABLED", None)
            self.assertFalse(live_new_trades_enabled())
            self.assertEqual(
                [target["name"] for target in get_trade_write_targets()], ["demo"]
            )

    def test_private_source_categories_are_absent(self):
        self.assertFalse((ROOT / "core" / "strategies").exists())
        self.assertFalse((ROOT / "data").exists())
        paths = [path.relative_to(ROOT).as_posix().lower() for path in ROOT.rglob("*")]
        self.assertFalse(any("backtest" in path for path in paths))

    def test_source_identity_is_limited_to_readme(self):
        forbidden = ("dax" + "snack", "christopher" + " vogt")
        for path in ROOT.rglob("*"):
            if not path.is_file() or ".git" in path.parts:
                continue
            try:
                text = path.read_text(encoding="utf-8").casefold()
            except UnicodeDecodeError:
                continue
            for value in forbidden:
                with self.subTest(path=path, value=value):
                    if path == ROOT / "README.md":
                        self.assertIn(value, text)
                    else:
                        self.assertNotIn(value, text)

    def test_frontend_avoids_codeql_blocking_patterns(self):
        loader = (ROOT / "static" / "js" / "app.js").read_text(encoding="utf-8")
        frontend = (ROOT / "static" / "js" / "app_main.js").read_text(encoding="utf-8")
        template = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")

        self.assertNotIn("data-main-src", loader)
        self.assertNotIn("dsAppMainSrc", loader)
        self.assertIn("hasAttribute('data-main-minified')", loader)
        self.assertNotIn("data-main-minified", template)
        self.assertNotIn("'pie' + Math.random()", frontend)
        self.assertNotIn("document.cookie.match('(^|;)\\s*' + name", frontend)
        self.assertIn("document.cookie.split(';')", frontend)


if __name__ == "__main__":
    unittest.main()
