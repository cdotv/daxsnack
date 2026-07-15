import ipaddress


def get_client_ip(request) -> str:
    """Return the proxy-observed client IP used for rate-limit buckets."""
    forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR") or "")
    remote_addr = str(request.META.get("REMOTE_ADDR") or "").strip()

    # App backends may be reachable through a trusted frontend proxy.
    # Its appended/rightmost forwarded value cannot be supplied by the client.
    forwarded_candidates = [
        part.strip() for part in forwarded.split(",") if part.strip()
    ]
    ordered = list(reversed(forwarded_candidates)) + (
        [remote_addr] if remote_addr else []
    )
    for candidate in ordered:
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            continue

    # Keep requests in one fail-safe bucket instead of disabling the limit.
    return "unknown"
