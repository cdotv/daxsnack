"""Runtime defaults that keep small servers within process/thread limits."""

from __future__ import annotations

import os

BLAS_THREAD_ENV_KEYS = (
    "OPENBLAS_NUM_THREADS",
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
)

_DISABLED_VALUES = {
    "",
    "0",
    "auto",
    "default",
    "defaults",
    "off",
    "false",
    "no",
    "none",
}


def _configured_thread_limit(default: str) -> str | None:
    raw = os.environ.get("DAXSNACK_NUMERIC_THREADS", default).strip()
    if raw.lower() in _DISABLED_VALUES:
        return None
    return raw


def apply_process_thread_env_defaults(default: str = "1") -> None:
    """Cap implicit numeric worker pools unless the operator set them explicitly."""
    value = _configured_thread_limit(default)
    if value is None:
        return
    for key in BLAS_THREAD_ENV_KEYS:
        os.environ.setdefault(key, value)
