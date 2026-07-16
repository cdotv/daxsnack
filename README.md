# Open Trading System

A self-hostable Django dashboard for publishing operator-provided trading setups. It provides the reusable application around a trading
system while leaving strategy research and validation to each operator.

All names, URLs, contacts, markets, prices, dates, and performance values in
this repository are generic examples. Configure your own identity and data
before publishing a deployment.

## Public-source boundary

This repository contains the reusable Django application, models and
migrations, frontend source and assets, subscriptions and email handling,
generic broker adapters, and reviewed market-data and position-management
commands.

It intentionally does **not** contain:

- `core/strategies/` or strategy rules, parameters, filters, rankings,
  entry/exit logic, or portfolio-selection logic;
- `data/`, market or account records, or generated results;
- backtests, optimizers, simulations, acceptance decisions, or performance
  evidence; or
- production credentials, private host paths, schedules, personal data, logs,
  generated minified bundles, or backups.

The export is default-deny. Only files named in the private export manifest are
copied. Public-only adapters replace production components where sharing the
source would cross that boundary. Secret scanning, identity checks, formatting,
tests, CI, and CodeQL must pass before a public revision reaches `main`.

## Configure identity once

Branding and example identity are configuration, not values embedded throughout
the application. Start from `.env.example` and set `SITE_NAME`, `SITE_TITLE`,
`SITE_DESCRIPTION`, `SITE_URL`, `SITE_OWNER_NAME`, `SITE_OWNER_ADDRESS`, and
`CONTACT_EMAIL`. The checked-in defaults use open trading system,
https://example.com, and contact@example.com.

README, notice, and environment examples are rendered from one validated
metadata table during the private-to-public export. The export refuses unknown
template variables, non-example public identities, unresolved placeholders,
credentials, and private project identities. This keeps routine source updates
automatic without silently rewriting arbitrary code.

## Bring your own strategy and backtests

The application starts in a safe empty-dashboard state. Develop and
independently backtest your own strategy in a separate private package, then
expose only its display payload through a Python callable. Configure its dotted
path with `TRADING_SYSTEM_HOME_PAYLOAD_PROVIDER`.

For example, an installed private module could expose:

```python
def get_home_payload(request):
    return {
        "setup_payload": {
            "best": {
                "instrument": {
                    "name": "Example Market",
                    "symbol": "EXAMPLE",
                    "epic": None,
                },
                "strategy": "example_strategy",
                "side": "long",
                "entry": 100.0,
                "stop": 95.0,
                "date": "2030-01-02",
            }
        },
        "running_items": [],
        "closed_items": [],
    }
```

Then set:

```dotenv
TRADING_SYSTEM_HOME_PAYLOAD_PROVIDER=my_private_package.provider.get_home_payload
```

The provider must return strict JSON-compatible data and is constrained by
`core/setup_provider.py`. The example values above are synthetic placeholders,
not a strategy or recommendation.

## Local setup

Python 3.11 or newer is recommended.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copy the generated value into `SECRET_KEY` in `.env`, then initialize and run:

```bash
DJANGO_SETTINGS_MODULE=config.devsettings python manage.py migrate
DJANGO_SETTINGS_MODULE=config.devsettings python manage.py runserver
```

Open `http://127.0.0.1:8000/`. Development email is printed to the terminal.
Before an internet-facing deployment, replace every example value, configure a
production database and authenticated SMTP delivery, set canonical hosts and
origins, provide legally required operator details, run `collectstatic`, and
keep live-order capability disabled until you have reviewed and tested it.

## Checks

```bash
python -m black --check .
python -m unittest discover -s tests -v
```

## License

The source is licensed under the Apache License, Version 2.0. Redistributed
copies and derivative works must preserve the attribution in `NOTICE` as
required by the license.
