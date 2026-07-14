import os
import unittest
from types import SimpleNamespace

from django.conf import settings

if not settings.configured:
    settings.configure(
        DEFAULT_FROM_EMAIL="daxsnack <sender@daxsnack.com>",
        EMAIL_FROM_NAME="daxsnack",
        SECRET_KEY="test-only-public-component-signing-key",  # pragma: allowlist secret
        SITE_URL="https://daxsnack.com",
    )

from core.file_security import apply_private_umask
from core.mail_delivery import build_multipart_message, build_subscriber_message
from core.privacy import subscriber_log_id
from core.subscription_tokens import (
    SubscriptionTokenError,
    make_subscription_token,
    read_subscription_token,
)


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
            site_url="https://daxsnack.com",
        )
        self.assertEqual(
            subscriber_message.extra_headers["List-Unsubscribe-Post"],
            "List-Unsubscribe=One-Click",
        )


if __name__ == "__main__":
    unittest.main()
