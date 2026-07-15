from email.utils import parseaddr
from pathlib import Path

from decouple import Csv, UndefinedValueError, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = config("DEBUG", default=False, cast=bool)
try:
    SECRET_KEY = config("SECRET_KEY")
except UndefinedValueError as exc:
    raise ImproperlyConfigured("SECRET_KEY must be set in the environment.") from exc
if not str(SECRET_KEY).strip():
    raise ImproperlyConfigured("SECRET_KEY must be set in the environment.")
if not DEBUG and (
    len(SECRET_KEY) < 50
    or len(set(SECRET_KEY)) < 5
    or SECRET_KEY.startswith("django-insecure-")
):
    raise ImproperlyConfigured("Configure a strong, unique production SECRET_KEY.")

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="127.0.0.1,localhost", cast=Csv())
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

SITE_URL = config("SITE_URL", default="https://daxsnack.com").rstrip("/")
SITE_AUTHOR = config("SITE_AUTHOR", default="Christopher Vogt")
SITE_OWNER_ADDRESS = config("SITE_OWNER_ADDRESS", default="")
CONTACT_EMAIL = config("CONTACT_EMAIL", default="contact@example.com")
DAXSNACK_HOME_PAYLOAD_PROVIDER = config(
    "DAXSNACK_HOME_PAYLOAD_PROVIDER", default=""
).strip()
SHOW_ACCOUNT_TOTAL_PERFORMANCE = config(
    "SHOW_ACCOUNT_TOTAL_PERFORMANCE", default=False, cast=bool
)
SHOW_EST_ANNUAL_RETURN = config("SHOW_EST_ANNUAL_RETURN", default=False, cast=bool)

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.ContentSecurityPolicyMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "core.middleware.CanonicalHostRedirectMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG

CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "base-uri 'self'; "
    "connect-src 'self' https://*.tradingview.com https://*.tradingview-widget.com "
    "wss://*.tradingview.com wss://*.tradingview-widget.com; "
    "font-src 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'self'; "
    "frame-src https://*.tradingview.com https://*.tradingview-widget.com; "
    "img-src 'self' data: https://*.tradingview.com https://*.tradingview-widget.com; "
    "media-src 'self'; object-src 'none'; "
    "script-src 'self' https://s3.tradingview.com https://*.tradingview.com "
    "https://*.tradingview-widget.com; "
    "script-src-attr 'none'; style-src 'self' 'unsafe-inline'; "
    "worker-src 'self' blob:; upgrade-insecure-requests"
)

database_engine = config("DB_ENGINE", default="sqlite").strip().lower()
if database_engine in {"postgres", "postgresql"}:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME"),
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
WHITENOISE_MAX_AGE = 31536000 if not DEBUG else 0
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

EMAIL_BACKEND = config(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config(
    "DEFAULT_FROM_EMAIL", default="daxsnack <contact@example.com>"
)
EMAIL_FROM_NAME = config("EMAIL_FROM_NAME", default="daxsnack")
NOTIFY_EMAIL = config("NOTIFY_EMAIL", default="")
EMAIL_TIMEOUT = config("EMAIL_TIMEOUT", default=20, cast=int)

if not DEBUG and EMAIL_BACKEND.endswith("smtp.EmailBackend"):
    if not EMAIL_USE_TLS:
        raise ImproperlyConfigured("Production SMTP must use STARTTLS.")
    smtp_identity = parseaddr(EMAIL_HOST_USER)[1] or EMAIL_HOST_USER
    visible_sender = parseaddr(DEFAULT_FROM_EMAIL)[1]
    if not visible_sender or smtp_identity.casefold() != visible_sender.casefold():
        raise ImproperlyConfigured(
            "Production DEFAULT_FROM_EMAIL must match EMAIL_HOST_USER."
        )

redis_url = config("RATELIMIT_REDIS_URL", default="").strip()
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "daxsnack-public-default",
    }
}
if redis_url:
    CACHES["ratelimit"] = {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": redis_url,
        "KEY_PREFIX": "daxsnack-public-ratelimit",
    }
else:
    CACHES["ratelimit"] = {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "daxsnack-public-ratelimit",
    }

RATELIMIT_USE_CACHE = "ratelimit"
RATELIMIT_IP_META_KEY = "core.ratelimit.get_client_ip"
RATELIMIT_FAIL_OPEN = False
RATELIMIT_CACHE_PREFIX = "daxsnack-public-rl:"

# Optional Capital.com adapter configuration. No credential values are stored here.
CAPITAL_API_KEY = config("CAPITAL_API_KEY", default="")
CAPITAL_LIVE_NEW_TRADES_ENABLED = config(
    "CAPITAL_LIVE_NEW_TRADES_ENABLED", default=False, cast=bool
)
