from django.urls import path
from .views import (
    benchmarks_snapshot,
    best_trade,
    confirm_subscribe,
    contact,
    form_tokens,
    open_trades_snapshot,
    retired_sse_stream,
    subscribe,
    unsubscribe,
    unsubscribe_one_click,
)

urlpatterns = [
    path("", best_trade, name="best_trade"),
    path("form-tokens/", form_tokens, name="form_tokens"),
    path("api/live/benchmarks/", benchmarks_snapshot, name="benchmarks_snapshot"),
    path("api/live/open-trades/", open_trades_snapshot, name="open_trades_snapshot"),
    path("sse/benchmarks/", retired_sse_stream, name="benchmarks_stream"),
    path("sse/open-trades/", retired_sse_stream, name="open_trades_stream"),
    path("contact/", contact, name="contact"),
    path("subscribe/", subscribe, name="subscribe"),
    path("subscribe/confirm/", confirm_subscribe, name="confirm_subscribe"),
    path("unsubscribe/", unsubscribe, name="unsubscribe"),
    path("unsubscribe/one-click/", unsubscribe_one_click, name="unsubscribe_one_click"),
]
