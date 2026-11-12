from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

import environ
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
ORDER_MENU_PRICING_SERVICE = env("ORDER_MENU_PRICING_SERVICE", default="")
ORDER_TAX_RATE = env("ORDER_TAX_RATE", default="0")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "channels",
    "apps.accounts",
    "apps.core",
    "apps.audit",
    "apps.menu",
    "apps.locations",
    "apps.orders",
    "apps.kitchen",
    "apps.payments",
    "apps.inventory",
    "apps.production",
    "apps.analytics",
    "apps.notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Le front envoie `Idempotency-Key` sur les créations de commande (POST /orders/, /public/orders/).
CORS_ALLOW_HEADERS = (*default_headers, "idempotency-key")

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = env("TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

SUPABASE_STORAGE_BUCKET = env("SUPABASE_STORAGE_BUCKET", default="")
SUPABASE_STORAGE_REGION = env("SUPABASE_STORAGE_REGION", default="")
SUPABASE_S3_ENDPOINT_URL = env("SUPABASE_S3_ENDPOINT_URL", default="")
SUPABASE_S3_ACCESS_KEY_ID = env("SUPABASE_S3_ACCESS_KEY_ID", default="")
SUPABASE_S3_SECRET_ACCESS_KEY = env("SUPABASE_S3_SECRET_ACCESS_KEY", default="")
SUPABASE_STORAGE_PUBLIC_BASE_URL = env(
    "SUPABASE_STORAGE_PUBLIC_BASE_URL", default=""
)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
    },
}

supabase_storage_values = (
    SUPABASE_STORAGE_BUCKET,
    SUPABASE_STORAGE_REGION,
    SUPABASE_S3_ENDPOINT_URL,
    SUPABASE_S3_ACCESS_KEY_ID,
    SUPABASE_S3_SECRET_ACCESS_KEY,
    SUPABASE_STORAGE_PUBLIC_BASE_URL,
)
if any(supabase_storage_values) and not all(supabase_storage_values):
    raise ImproperlyConfigured(
        "Configure all SUPABASE_STORAGE_* and SUPABASE_S3_* settings, "
        "or leave them all empty to use local media storage."
    )

if all(supabase_storage_values):
    public_storage_url = urlsplit(SUPABASE_STORAGE_PUBLIC_BASE_URL)
    s3_endpoint = urlsplit(SUPABASE_S3_ENDPOINT_URL)
    if (
        public_storage_url.scheme != "https"
        or not public_storage_url.netloc
        or s3_endpoint.scheme != "https"
        or not s3_endpoint.netloc
    ):
        raise ImproperlyConfigured("Supabase Storage URLs must use HTTPS.")

    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "access_key": SUPABASE_S3_ACCESS_KEY_ID,
            "secret_key": SUPABASE_S3_SECRET_ACCESS_KEY,
            "bucket_name": SUPABASE_STORAGE_BUCKET,
            "region_name": SUPABASE_STORAGE_REGION,
            "endpoint_url": SUPABASE_S3_ENDPOINT_URL,
            "addressing_style": "path",
            "signature_version": "s3v4",
            "default_acl": None,
            "querystring_auth": False,
            "file_overwrite": False,
            "custom_domain": (
                f"{public_storage_url.netloc}{public_storage_url.path.rstrip('/')}"
            ),
            "url_protocol": "https:",
        },
    }

PASSWORD_RESET_TIMEOUT = 3600
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"
    },
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "user": "300/min",
        "login": "5/min",
        "password_reset": "3/hour",
        "public_menu": "60/min",
        "public_order": "10/min",
        "public_track": "30/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": env("JWT_SIGNING_KEY"),
}
TRACKING_TOKEN_KEY = env("TRACKING_TOKEN_KEY")

SPECTACULAR_SETTINGS = {
    "TITLE": "API Restaurant",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "PaymentMethodEnum": "common.constants.PAYMENT_METHOD_CHOICES",
    },
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL"),
    }
}
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [env("REDIS_URL")]},
    }
}
