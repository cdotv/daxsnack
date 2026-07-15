from django.core.management.base import BaseCommand, CommandError

from core.broker_trade_service import submit_stop_update
from core.capital_auth import (
    CAPITAL_BASE,
    LIVE_CAPITAL_BASE,
    live_new_trades_enabled,
)


class Command(BaseCommand):
    help = "Update one protective stop with explicit identifiers."

    def add_arguments(self, parser):
        parser.add_argument("--deal-id", required=True)
        parser.add_argument("--stop", required=True, type=float)
        parser.add_argument("--guaranteed", action="store_true")
        parser.add_argument("--live", action="store_true")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        deal_id = str(options["deal_id"] or "").strip()
        if not deal_id:
            raise CommandError("A non-empty deal ID is required.")
        if options["dry_run"]:
            self.stdout.write("Dry run: no stop update submitted.")
            return
        if options["live"] and not live_new_trades_enabled():
            raise CommandError(
                "Live writes are disabled. Explicitly enable them in the environment first."
            )
        api_base = LIVE_CAPITAL_BASE if options["live"] else CAPITAL_BASE
        ok, error, _headers = submit_stop_update(
            api_base,
            deal_id,
            float(options["stop"]),
            guaranteed_stop=bool(options["guaranteed"]),
        )
        if not ok:
            raise CommandError(error or "The stop update failed.")
        self.stdout.write(self.style.SUCCESS("Stop update accepted."))
