from django.urls import path, include
from core import urls as core_urls

urlpatterns = [
    path("", include(core_urls)),
]
