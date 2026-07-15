from django.db import models
from django.utils import timezone
import uuid


class Quote(models.Model):
    symbol = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    score = models.FloatField()  # stores Risk:Reward
    text = models.TextField(blank=True, null=True)  # explanation text
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.symbol} (R:R {self.score:.2f})"


class Subscription(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    # Legacy columns retained for schema compatibility. Signed links no longer
    # expose or authenticate against values stored in these fields.
    confirm_token_hash = models.CharField(max_length=128, blank=True)
    unsubscribe_token_hash = models.CharField(max_length=128, blank=True)
    # preferred language for emails: 'en' or 'de' (default 'en')
    language = models.CharField(max_length=2, default="en")

    def __str__(self) -> str:  # pragma: no cover
        status = "active" if self.is_active else "pending"
        identity = self.pk if self.pk is not None else "unsaved"
        return f"Subscription<{identity}> {status}"
