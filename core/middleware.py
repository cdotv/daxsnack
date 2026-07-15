from urllib.parse import urlsplit

from django.conf import settings
from django.http import HttpResponsePermanentRedirect
from django.utils.deprecation import MiddlewareMixin


class ContentSecurityPolicyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", settings.CONTENT_SECURITY_POLICY)
        return response


class CanonicalHostRedirectMiddleware(MiddlewareMixin):
    """Redirect a www host to the configured canonical site host."""

    def process_request(self, request):
        canonical_host = urlsplit(str(settings.SITE_URL)).hostname
        if not canonical_host:
            return None
        request_host = request.get_host().split(":", 1)[0]
        if request_host != f"www.{canonical_host}":
            return None
        scheme = "https" if request.is_secure() else "http"
        return HttpResponsePermanentRedirect(
            f"{scheme}://{canonical_host}{request.get_full_path()}"
        )
