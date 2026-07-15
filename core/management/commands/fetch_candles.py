import json
import re
import tempfile
from pathlib import Path

import requests
from decouple import config
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.capital_auth import CAPITAL_BASE, get_token_headers_with_retry

SAFE_EPIC = re.compile(r"[A-Za-z0-9_.-]{1,80}")


class Command(BaseCommand):
    help = "Fetch generic price bars into a local runtime JSON file."

    def add_arguments(self, parser):
        parser.add_argument("epic")
        parser.add_argument("--resolution", default="DAY")
        parser.add_argument("--max-bars", type=int, default=100)
        parser.add_argument("--output", default=None)

    def handle(self, *args, **options):
        epic = str(options["epic"] or "").strip()
        if not SAFE_EPIC.fullmatch(epic):
            raise CommandError("The epic contains unsupported characters.")
        maximum = min(max(int(options["max_bars"]), 1), 1000)
        headers = get_token_headers_with_retry()
        api_key = config("CAPITAL_API_KEY", default="")
        if api_key:
            headers["X-CAP-API-KEY"] = api_key
        response = requests.get(
            f"{CAPITAL_BASE}/api/v1/prices/{epic}",
            headers=headers,
            params={"resolution": options["resolution"], "max": maximum},
            timeout=30,
        )
        if not response.ok:
            raise CommandError(
                f"Price request failed with HTTP {response.status_code}."
            )
        document = response.json()
        if not isinstance(document, dict) or not isinstance(
            document.get("prices"), list
        ):
            raise CommandError("The price response has an unsupported shape.")

        relative = options["output"] or f"data/candles/{epic}.json"
        destination = Path(settings.BASE_DIR) / str(relative)
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=destination.parent,
                prefix=f".{destination.name}.",
                delete=False,
            ) as output:
                temporary = Path(output.name)
                json.dump({"epic": epic, "prices": document["prices"]}, output)
                output.write("\n")
            temporary.chmod(0o600)
            temporary.replace(destination)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        self.stdout.write(self.style.SUCCESS(f"Prices written to {destination}"))
