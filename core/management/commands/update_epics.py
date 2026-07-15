import os
import json
import time
import random
import string
import requests
from typing import Dict, List, Set, Optional
from django.core.management.base import BaseCommand
from decouple import config
from core.capital_auth import CAPITAL_BASE as BASE_URL

SAVE_PATH = os.path.abspath("data/manual_instruments.json")

SEARCH_CHARS = list(string.ascii_lowercase + string.digits) + [
    "usd",
    "eur",
    "gbp",
    "xau",
    "btc",
]

MAX_RETRIES = 3
RETRY_BASE_DELAY = 0.6  # seconds
PAGE_SIZE = 50  # adjust if the API offers a different max


def _sleep_jitter(base: float):
    time.sleep(base + random.random() * 0.4)


def req_with_retries(
    method: str, url: str, headers: Dict[str, str], **kwargs
) -> Optional[requests.Response]:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.request(method, url, headers=headers, timeout=30, **kwargs)
            if r.status_code in (429, 500, 502, 503, 504):
                _sleep_jitter(RETRY_BASE_DELAY * attempt)
                continue
            return r
        except requests.RequestException:
            _sleep_jitter(RETRY_BASE_DELAY * attempt)
    return None


def login() -> Optional[Dict[str, str]]:
    login_url = f"{BASE_URL}/api/v1/session"
    payload = {
        "identifier": config("CAPITAL_USERNAME"),
        "password": config("CAPITAL_PASSWORD"),
        # If you use encrypted password flow, adjust per docs.
    }
    headers = {
        "X-CAP-API-KEY": config("CAPITAL_API_KEY"),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    r = req_with_retries("POST", login_url, headers=headers, json=payload)
    if not r or r.status_code != 200:
        raise RuntimeError(
            f"Login failed: {getattr(r,'status_code','NO_RESP')} - {getattr(r,'text','')}"
        )
    security_token = r.headers.get("X-SECURITY-TOKEN")
    cst_token = r.headers.get("CST")
    if not (security_token and cst_token):
        raise RuntimeError("Missing CST/X-SECURITY-TOKEN in login response headers.")
    headers.update({"X-SECURITY-TOKEN": security_token, "CST": cst_token})
    return headers


def search_markets(headers: Dict[str, str], query: str) -> List[dict]:
    """
    Calls GET /api/v1/markets?searchTerm=<query>&pageNumber=<n>&pageSize=<m>
    Accumulates all pages if the API responds with pagination data.
    Falls back to single page if pagination is absent.
    """
    url = f"{BASE_URL}/api/v1/markets"
    results: List[dict] = []
    page = 1

    while True:
        params = {"searchTerm": query, "pageNumber": page, "pageSize": PAGE_SIZE}
        r = req_with_retries("GET", url, headers=headers, params=params)
        if not r or r.status_code != 200:
            break
        payload = {}
        try:
            payload = r.json()
        except ValueError:
            break

        # Capital.com often returns a list in 'markets', but structure can vary
        markets = payload.get("markets")
        if isinstance(markets, list):
            results.extend(markets)
        elif isinstance(payload, list):  # just in case it's a raw list
            results.extend(payload)
        else:
            # Unknown structure; bail this page
            break

        # Try to detect pagination
        paging = payload.get("paging") or payload.get("pagination") or {}
        total_pages = paging.get("totalPages") or paging.get("total_pages")
        if total_pages:
            if page >= int(total_pages):
                break
            page += 1
            _sleep_jitter(0.05)
            continue

        # If no explicit pagination info, assume single page
        break

    return results


def normalize_item(m: dict) -> Optional[dict]:
    """
    Normalize various possible shapes into {symbol, name, epic}.
    """
    epic = m.get("epic") or m.get("marketId") or m.get("instrument", {}).get("epic")
    if not epic:
        return None

    # Try common fields for name & symbol
    name = (
        m.get("name")
        or m.get("instrumentName")
        or m.get("instrument", {}).get("name")
        or epic
    )

    symbol = (
        m.get("symbol")
        or m.get("instrument", {}).get("symbol")
        or m.get("marketId")
        or epic
    )

    return {"symbol": symbol, "name": name, "epic": epic}


class Command(BaseCommand):
    help = "Fetch ALL tradeable EPICs from Capital.com via /markets?searchTerm sweeps and save to JSON."

    def handle(self, *args, **kwargs):
        print("🔐 Logging in to Capital.com...")
        try:
            headers = login()
        except Exception as e:
            self.stderr.write(f"❌ {e}")
            return

        print("🔎 Discovering instruments via search sweeps…")
        seen_epics: Set[str] = set()
        instruments: List[dict] = []

        for term in SEARCH_CHARS:
            markets = search_markets(headers, term)
            if not markets:
                continue
            for m in markets:
                item = normalize_item(m)
                if not item:
                    continue
                epic = item["epic"]
                if epic in seen_epics:
                    continue
                seen_epics.add(epic)
                instruments.append(item)
            # be polite
            _sleep_jitter(0.05)

        if not instruments:
            self.stderr.write(
                "⚠️ No instruments discovered. Check credentials or try different SEARCH_CHARS."
            )
            return

        # Sort for stable output
        instruments.sort(key=lambda x: x["epic"])

        os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
        with open(SAVE_PATH, "w") as f:
            json.dump(instruments, f, indent=2)

        print(f"✅ Saved {len(instruments)} instruments to {SAVE_PATH}")
        print("🎉 Done.")
