import json
import os
import tempfile
import time
from pathlib import Path

import requests
from decouple import config
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.capital_auth import CAPITAL_BASE, get_token_headers_with_retry


def _equity_from_account(account: dict) -> float | None:
    for key in ("equity", "balance", "available", "cash"):
        value = account.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, dict):
            nested = _equity_from_account(value)
            if nested is not None:
                return nested
    return None


def _atomic_json(path: Path, value) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            delete=False,
        ) as output:
            temporary = Path(output.name)
            json.dump(value, output, indent=2, sort_keys=True)
            output.write("\n")
        temporary.chmod(0o600)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


class Command(BaseCommand):
    help = "Store a generic account-equity snapshot for the public dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--output", default="data/account_snapshot.json")
        parser.add_argument("--history", default="data/account_history.json")
        parser.add_argument("--history-limit", type=int, default=365)

    def handle(self, *args, **options):
        headers = get_token_headers_with_retry()
        api_key = config("CAPITAL_API_KEY", default="")
        if api_key:
            headers["X-CAP-API-KEY"] = api_key
        response = requests.get(
            f"{CAPITAL_BASE}/api/v1/accounts", headers=headers, timeout=20
        )
        if not response.ok:
            raise CommandError(
                f"Account request failed with HTTP {response.status_code}."
            )
        document = response.json()
        accounts = document.get("accounts") if isinstance(document, dict) else None
        if not isinstance(accounts, list) or not accounts:
            raise CommandError("The account response contained no accounts.")

        preferred_id = config("CAPITAL_ACCOUNT_ID", default="").strip()
        account = next(
            (
                item
                for item in accounts
                if isinstance(item, dict)
                and preferred_id
                and str(item.get("accountId") or "") == preferred_id
            ),
            None,
        )
        if account is None:
            account = next((item for item in accounts if isinstance(item, dict)), None)
        equity = _equity_from_account(account or {})
        if equity is None:
            raise CommandError("The selected account contained no equity value.")

        root = Path(settings.BASE_DIR)
        output_path = root / str(options["output"])
        history_path = root / str(options["history"])
        try:
            history = json.loads(history_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            history = []
        if not isinstance(history, list):
            history = []
        now = int(time.time())
        history.append({"ts": now, "equity": equity})
        history = history[-max(1, int(options["history_limit"])) :]

        initial_equity = float(history[0]["equity"])
        total_delta_pct = (
            ((equity - initial_equity) / initial_equity) * 100.0
            if initial_equity
            else None
        )
        snapshot = {
            "ts": now,
            "equity": equity,
            "total_delta_pct": total_delta_pct,
        }
        _atomic_json(history_path, history)
        _atomic_json(output_path, snapshot)
        self.stdout.write(self.style.SUCCESS(f"Snapshot written to {output_path}"))
