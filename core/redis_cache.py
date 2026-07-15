import os
from typing import Optional

import redis


def _redis_socket_path() -> str:
    sock = os.environ.get("REDIS_SOCKET", "~/.redis/sock")
    return os.path.expanduser(sock)


def get_redis_client() -> redis.Redis:
    return redis.Redis(
        unix_socket_path=_redis_socket_path(),
        decode_responses=True,
    )


def get_redis_socket_path() -> str:
    return _redis_socket_path()
