"""
Razorpay merchant-checkout support for BraillePay (test mode by default).

What this module does
- Creates Razorpay Orders through the documented REST endpoint (POST /v1/orders, HTTP basic auth
  with key_id:key_secret).
- Verifies the payment signature returned to the browser after Checkout (HMAC-SHA256 of
  "<order_id>|<payment_id>" with the key secret).
- Verifies webhook signatures (HMAC-SHA256 of the raw request body with the webhook secret).
- Refuses to run in live mode unless the operator explicitly approved it (RAZORPAY_LIVE_APPROVED=true).

What this module does NOT do
- It does not move money between BraillePay users and does not change the demo ledger.
- It does not treat a browser callback as proof of payment. Only a verified signature AND a
  webhook confirmation mark an order as captured (see routes/razorpay.py).

Razorpay references (re-check before production): https://razorpay.com/docs/payments/payment-gateway/
"""

import hashlib
import hmac

import httpx

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"
REQUEST_TIMEOUT_SECONDS = 10.0


class RazorpayError(Exception):
    """Raised when Razorpay rejects a request or cannot be reached."""


class RazorpayConfigError(Exception):
    """Raised when the Razorpay settings are unsafe or incomplete."""


def verify_payment_signature(order_id: str, payment_id: str, signature: str, key_secret: str) -> bool:
    """Checkout handler signature: HMAC-SHA256("<order_id>|<payment_id>", key_secret) == signature."""
    if not (order_id and payment_id and signature and key_secret):
        return False
    expected = hmac.new(
        key_secret.encode("utf-8"), f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str | None, webhook_secret: str) -> bool:
    """Webhook signature: HMAC-SHA256(raw request body, webhook secret) == X-Razorpay-Signature."""
    if not (raw_body is not None and signature and webhook_secret):
        return False
    expected = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def check_mode(settings) -> None:
    """Fail closed on any unsafe combination of mode and key prefix."""
    mode = (settings.razorpay_mode or "").lower()
    key = settings.razorpay_key_id or ""
    if mode == "test":
        if key and not key.startswith("rzp_test_"):
            raise RazorpayConfigError("RAZORPAY_MODE=test but the key id is not a test key (rzp_test_...).")
        return
    if mode == "live":
        if not settings.razorpay_live_approved:
            raise RazorpayConfigError("Live mode is refused: RAZORPAY_LIVE_APPROVED is not true.")
        if key and not key.startswith("rzp_live_"):
            raise RazorpayConfigError("RAZORPAY_MODE=live but the key id is not a live key (rzp_live_...).")
        return
    raise RazorpayConfigError(f"Unknown RAZORPAY_MODE {settings.razorpay_mode!r}; use 'test'.")


def is_configured(settings) -> bool:
    return bool(settings.razorpay_enabled and settings.razorpay_key_id and settings.razorpay_key_secret)


async def create_order(*, settings, amount_paise: int, currency: str, receipt: str, notes: dict) -> dict:
    """POST /v1/orders. amount is an integer number of paise (1 INR = 100 paise)."""
    payload = {"amount": amount_paise, "currency": currency, "receipt": receipt, "notes": notes}
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{RAZORPAY_API_BASE}/orders",
                json=payload,
                auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
            )
    except httpx.HTTPError as exc:
        raise RazorpayError("Could not reach Razorpay.") from exc
    if resp.status_code >= 400:
        # Do not log or return the response body verbatim: it can echo request details.
        raise RazorpayError(f"Razorpay rejected the order request (HTTP {resp.status_code}).")
    data = resp.json()
    if not data.get("id"):
        raise RazorpayError("Razorpay returned an order without an id.")
    return data
