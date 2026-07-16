# Open Trading System

This repository contains the reusable web application behind the
daxsnack trading system.

- Live website: [https://daxsnack.com](https://daxsnack.com)
- Author: Christopher Vogt

The project is intended for people who want to host their own trading system
with a strategy and backtests they have developed and validated themselves.
It is not a ready-made trading strategy.

## What is included

- Django configuration, URLs, models, and migrations
- the browser interface and static assets
- email subscriptions and contact handling
- generic market-data, broker, and position-management components
- a strict provider interface for supplying dashboard data
- tests and production-oriented security defaults

## What is not included

- `core/strategies/` and all private strategy rules or parameters
- `data/`, account records, market history, and generated results
- backtests, optimizers, simulations, and performance evidence
- production credentials, server paths, schedules, logs, and backups

The public application starts with an empty dashboard. Example names, contacts,
markets, prices, dates, and results are placeholders and must be replaced before
publishing an instance.

## Connect your strategy

Keep your strategy and research in a separate private package. Expose only the
data needed by the dashboard through a Python callable and set its dotted path
in `TRADING_SYSTEM_HOME_PAYLOAD_PROVIDER`.

Example provider:

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

Configure the provider in `.env`:

```dotenv
TRADING_SYSTEM_HOME_PAYLOAD_PROVIDER=my_private_package.provider.get_home_payload
```

The provider must return strict JSON-compatible data accepted by
`core/setup_provider.py`. It should not expose strategy internals, credentials,
or private records.

## Installation

Python 3.11 or newer is recommended.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Put the generated value in `SECRET_KEY` inside `.env`, then initialize and run
the application:

```bash
DJANGO_SETTINGS_MODULE=config.devsettings python manage.py migrate
DJANGO_SETTINGS_MODULE=config.devsettings python manage.py runserver
```

Open `http://127.0.0.1:8000/`. Development email is written to the terminal.

## Configuration

The checked-in defaults use the generic name `open trading system` and example
contact details. Set these values for your own deployment:

- `SITE_NAME`
- `SITE_TITLE`
- `SITE_DESCRIPTION`
- `SITE_URL`
- `SITE_OWNER_NAME`
- `SITE_OWNER_ADDRESS`
- `CONTACT_EMAIL`

Before exposing the application to the internet, also configure allowed hosts,
trusted origins, a production database, authenticated SMTP delivery, static
files, and any legally required operator information. Keep live-order support
disabled until the complete integration has been tested safely.

## Public-source boundary

The export is default-deny: only reviewed files in the private export manifest
can enter this repository. Public-specific adapters replace production modules
where necessary. Every public revision is checked for excluded directories,
private identity outside this README, credentials, formatting errors, test
failures, dependency vulnerabilities, and CodeQL findings.

Run the local checks with:

```bash
python -m black --check .
python -m unittest discover -s tests -v
```

## License

The source is licensed under the Apache License, Version 2.0. Redistributed
copies and derivative works must preserve the attribution in `NOTICE` as
required by the license.
