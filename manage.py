#!/usr/bin/env python
import os
import sys

from core.file_security import apply_private_umask
from core.runtime_limits import apply_process_thread_env_defaults

apply_private_umask()


def main():
    apply_process_thread_env_defaults()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django.") from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
