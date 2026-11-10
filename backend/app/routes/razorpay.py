"""
Razorpay merchant checkout routes (test mode by default). See docs/RAZORPAY.md.

Order lifecycle (stored in `payment_orders`, separate from the demo ledger):
  CREATED                    order created on Razorpay, checkout not yet completed
  VERIFIED_AWAITING_WEBHOOK  browser signature verified; NOT final until the webhook arrives
  CAPTURED                   webhook payment.captured received for this order (final)
  FAILED                     webhook payment.failed received and no capture
  AMOUNT_MISMATCH            captured amount differs from the order amount (needs human review)

A frontend callback never marks an order CAPTURED on its own.
"""
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import UserPublic
from app.money import from_decimal128, to_decimal128, to_float, validate_amount
from app.services import razorpay_service as rzp

router = APIRouter(prefix="/api/razorpay", tags=["Razorpay (test mode)"])


def _now():
    return datetime.now(timezone.utc)


def _require_ready():
    settings = get_settings()
    if not rzp.is_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay checkout is not configured on this server. No payment was taken.",
        )
    try:
        rzp.check_mode(settings)
    except rzp.RazorpayConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Razorpay configuration refused: {exc}",
        )
    return settings


def _public(doc: dict) -> dict:
    return {
        "order_id": doc["order_id"],
        "razorpay_order_id": doc["razorpay_order_id"],
        "razorpay_payment_id": doc.get("razorpay_payment_id"),
        "amount": to_float(from_decimal128(doc["amount"])),
        "currency": doc.get("currency", "INR"),
        "status": doc["status"],
        "mode": doc.get("mode", "test"),
        "created_at": doc["created_at"],
    }


class CreateOrderBody(BaseModel):
    amount: float | str = Field(..., description="Rupees, up to two decimal places")
    note: str | None = Field(default=None, max_length=120)


class VerifyBody(BaseModel):
    razorpay_order_id: str = Field(..., min_length=3, max_length=64)
    razorpay_payment_id: str = Field(..., min_length=3, max_length=64)
    razorpay_signature: str = Field(..., min_length=10, max_length=256)


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(body: CreateOrderBody, current_user: UserPublic = Depends(get_current_user)):
    """Create a Razorpay Order for the signed-in user. Returns what Razorpay Checkout needs."""
    settings = _require_ready()
    amount = validate_amount(body.amount)          # 422 on bad, zero, negative or >2dp amounts
    amount_paise = int(amount * 100)
    order_id = str(uuid.uuid4())

    try:
        rzp_order = await rzp.create_order(
            settings=settings,
            amount_paise=amount_paise,
            currency="INR",
            receipt=order_id,
            notes={"internal_order_id": order_id, "user_id": current_user.user_id},
        )
    except rzp.RazorpayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"{exc} No payment was taken.")

    now = _now()
    doc = {
        "order_id": order_id,
        "razorpay_order_id": rzp_order["id"],
        "razorpay_payment_id": None,
        "user_id": current_user.user_id,
        "amount": to_decimal128(amount),
        "currency": "INR",
        "note": body.note,
        "status": "CREATED",
        "mode": settings.razorpay_mode,
        "created_at": now,
        "updated_at": now,
    }
    await get_db().payment_orders.insert_one(doc)
    return {
        **_public(doc),
        "key_id": settings.razorpay_key_id,        # publishable key only; the secret is never returned
        "amount_paise": amount_paise,
    }


@router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: UserPublic = Depends(get_current_user)):
    doc = await get_db().payment_orders.find_one({"order_id": order_id, "user_id": current_user.user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _public(doc)


@router.post("/verify")
async def verify_payment(body: VerifyBody, current_user: UserPublic = Depends(get_current_user)):
    """Verify the Checkout handler signature. Does NOT mark the order captured; the webhook does."""
    settings = _require_ready()
    db = get_db()
    doc = await db.payment_orders.find_one(
        {"razorpay_order_id": body.razorpay_order_id, "user_id": current_user.user_id}
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if not rzp.verify_payment_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, settings.razorpay_key_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The payment signature could not be verified. The order was not confirmed.",
        )

    if doc.get("razorpay_payment_id") and doc["razorpay_payment_id"] != body.razorpay_payment_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This order already has a different payment.")

    if doc["status"] in ("CREATED", "VERIFIED_AWAITING_WEBHOOK"):
        await db.payment_orders.update_one(
            {"razorpay_order_id": body.razorpay_order_id, "user_id": current_user.user_id},
            {"$set": {
                "status": "VERIFIED_AWAITING_WEBHOOK",
                "razorpay_payment_id": body.razorpay_payment_id,
                "updated_at": _now(),
            }},
        )
        doc = await db.payment_orders.find_one({"razorpay_order_id": body.razorpay_order_id})
    result = _public(doc)
    result["message"] = (
        "Signature verified. Waiting for Razorpay's webhook confirmation before this is final."
        if doc["status"] == "VERIFIED_AWAITING_WEBHOOK"
        else "Order status is already final."
    )
    return result


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def razorpay_webhook(request: Request):
    """Razorpay webhook. Authenticated by signature over the RAW body, deduplicated by event id."""
    settings = get_settings()
    raw = await request.body()
    if not rzp.verify_webhook_signature(raw, request.headers.get("X-Razorpay-Signature"), settings.razorpay_webhook_secret):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")
    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed webhook body")

    db = get_db()
    event_id = request.headers.get("X-Razorpay-Event-Id") or ""
    event_type = event.get("event", "")
    if event_id:
        try:
            await db.webhook_events.insert_one({"event_id": event_id, "event": event_type, "received_at": _now()})
        except DuplicateKeyError:
            return {"status": "duplicate", "event_id": event_id}

    entity = (((event.get("payload") or {}).get("payment") or {}).get("entity")) or {}
    razorpay_order_id = entity.get("order_id")
    if not razorpay_order_id:
        return {"status": "ignored", "event": event_type}

    order = await db.payment_orders.find_one({"razorpay_order_id": razorpay_order_id})
    if not order:
        return {"status": "unknown_order"}

    now = _now()
    if event_type == "payment.captured":
        captured_paise = int(entity.get("amount") or 0)
        expected_paise = int(from_decimal128(order["amount"]) * 100)
        if captured_paise != expected_paise:
            new_status = "AMOUNT_MISMATCH"
        else:
            new_status = "CAPTURED"
        if order["status"] != "CAPTURED":
            await db.payment_orders.update_one(
                {"razorpay_order_id": razorpay_order_id},
                {"$set": {"status": new_status, "razorpay_payment_id": entity.get("id"), "updated_at": now}},
            )
        return {"status": new_status.lower()}

    if event_type == "payment.failed":
        if order["status"] != "CAPTURED":
            await db.payment_orders.update_one(
                {"razorpay_order_id": razorpay_order_id},
                {"$set": {"status": "FAILED", "updated_at": now}},
            )
        return {"status": "failed"}

    return {"status": "ignored", "event": event_type}
