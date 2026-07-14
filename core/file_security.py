import os

PRIVATE_UMASK = 0o077


def apply_private_umask() -> int:
    """Prevent newly created runtime files from being group/world readable."""
    return os.umask(PRIVATE_UMASK)
