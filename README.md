# daxsnack public components

This repository contains independently reviewed, reusable web infrastructure
components originally developed by daxsnack.

## Included components

- Private-by-default runtime file permissions.
- Privacy-preserving subscriber log identifiers.
- Signed confirmation and unsubscribe links.
- Multipart subscriber email and standards-based unsubscribe headers.
- Browser theme initialization and a subscription action template.

This is a component collection, not a standalone application.

## Development

Create an isolated environment and install the reviewed dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
```

Run the checks:

```bash
python -m black --check .
python -m unittest discover -s tests
```

## Release checks

Every revision passes secret scanning, formatting, tests, CI, and CodeQL before
it reaches the protected `main` branch.

## License and attribution

The source is licensed under the Apache License, Version 2.0. Redistributed
copies and derivative works must preserve the attribution from `NOTICE` as
required by the license.

The license does not grant permission to use daxsnack names or marks except to
describe the origin of the source and reproduce the required attribution.
