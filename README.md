# daxsnack

daxsnack is a self-hosted Django dashboard for publishing a daily market setup,
showing open and closed positions, and managing email subscriptions. The live
project is available at the full URL [https://daxsnack.com](https://daxsnack.com).

The author is **Christopher Vogt**.

## Public-source boundary

This repository contains the reusable web application: Django configuration,
models and migrations, the frontend source and required assets, subscription
and email handling, generic broker adapters, and reviewed market-data and
position-management commands.

It intentionally does **not** contain:

- the `core/strategies/` directory or any daxsnack strategy rules, parameters,
  filters, rankings, entry/exit logic, or portfolio-selection logic;
- the private `data/` directory, market/account records, or generated results;
- backtests, optimizers, simulations, acceptance decisions, or performance
  evidence; or
- production credentials, host paths, schedules, personal addresses, logs,
  generated minified bundles, or backup assets.

Values shown in examples are synthetic placeholders. They are not daxsnack
settings, recommendations, or historical results.

## Bring your own strategy

The public application starts in a safe empty-dashboard state. To make it useful,
develop and independently backtest your own strategy, then expose only its
display payload through a Python callable. Keep the private implementation in a
separate package and configure its dotted path with
`DAXSNACK_HOME_PAYLOAD_PROVIDER`.

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
DAXSNACK_HOME_PAYLOAD_PROVIDER=my_private_package.provider.get_home_payload
```

The provider must return JSON-compatible data and is constrained by the public
payload boundary in `core/setup_provider.py`. The example prices, date, name,
and direction above are deliberately generic.

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

Open `http://127.0.0.1:8000/`. Email is printed to the terminal in development.
Before an internet-facing deployment, replace every example value, configure a
production database and SMTP delivery, set the canonical host/origin values,
provide legally required operator details, run `collectstatic`, and keep any
live-order capability disabled until you have reviewed and tested it yourself.

## Checks

```bash
python -m black --check .
python -m unittest discover -s tests -v
```

Public revisions pass secret scanning, boundary validation, formatting, tests,
CI, and CodeQL before reaching the protected `main` branch.

## License and attribution

The source is licensed under the Apache License, Version 2.0. Redistributed
copies and derivative works must preserve the attribution in `NOTICE` as
required by the license.

The license does not grant permission to use the daxsnack names or marks except
to describe the source's origin and reproduce required attribution.
