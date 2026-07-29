import unittest
from unittest.mock import patch

from core import broker_trade_service as service


class _FakeResponse:
    def __init__(self, payload, *, ok=True, status_code=200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code
        self.headers = {"Content-Type": "application/json"}
        self.text = str(payload)

    def json(self):
        return self._payload


class PublicBrokerTradeServiceTests(unittest.TestCase):
    api_base = "https://broker.example.test"
    headers = {
        "X-CAP-ACCOUNT-ID": "account-example",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    order = {
        "epic": "EXAMPLE.MARKET",
        "direction": "BUY",
        "size": 1.0,
    }

    def test_terminal_confirmations_fail_before_position_recovery(self):
        for status in ("REJECTED", "FAILED", "ERROR"):
            with (
                self.subTest(status=status),
                patch.object(
                    service.requests,
                    "post",
                    return_value=_FakeResponse({"dealReference": "reference-example"}),
                ),
                patch.object(
                    service.requests,
                    "get",
                    return_value=_FakeResponse(
                        {
                            "dealStatus": status,
                            "affectedDeals": [{"dealId": "deal-example"}],
                            "reason": "TEST_REJECTION",
                        }
                    ),
                ),
                patch.object(service.time, "sleep", return_value=None),
                patch.object(
                    service,
                    "resolve_open_deal_id_from_positions",
                ) as recover,
            ):
                ok, acknowledgement, error, _ = service.submit_open_order(
                    self.api_base,
                    self.order,
                    headers=self.headers,
                )

            self.assertFalse(ok)
            self.assertEqual(acknowledgement["confirm_status"], status)
            self.assertEqual(acknowledgement["dealId"], "deal-example")
            self.assertEqual(
                error,
                f"open_confirm_{status.lower()}: TEST_REJECTION",
            )
            recover.assert_not_called()

    def test_accepted_confirmation_remains_successful(self):
        with (
            patch.object(
                service.requests,
                "post",
                return_value=_FakeResponse({"dealReference": "reference-example"}),
            ),
            patch.object(
                service.requests,
                "get",
                return_value=_FakeResponse(
                    {
                        "dealStatus": "ACCEPTED",
                        "affectedDeals": [{"dealId": "deal-example"}],
                    }
                ),
            ),
            patch.object(service.time, "sleep", return_value=None),
            patch.object(
                service,
                "resolve_open_deal_id_from_positions",
            ) as recover,
        ):
            ok, acknowledgement, error, _ = service.submit_open_order(
                self.api_base,
                self.order,
                headers=self.headers,
            )

        self.assertTrue(ok)
        self.assertEqual(error, "")
        self.assertEqual(acknowledgement["dealId"], "deal-example")
        self.assertEqual(acknowledgement["confirm_status"], "ACCEPTED")
        recover.assert_not_called()


if __name__ == "__main__":
    unittest.main()
