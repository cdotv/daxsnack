from .settings import *  # noqa: F403

DEBUG = True
SECURE_SSL_REDIRECT = False
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False
ALLOWED_HOSTS = ["testserver", "127.0.0.1", "localhost"]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "daxsnack-public-development",
    },
    "ratelimit": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "daxsnack-public-ratelimit",
    },
}
