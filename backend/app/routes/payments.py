from fastapi import APIRouter, Depends, Header

from app.deps import get_current_user
from app.models import PaymentReceipt, PaymentSendRequest, UserPublic
from app.money import from_decimal128, to_float
from app.serializers import serialize_transaction
from app.services import payment_service

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post(
    "/send",
    response_model=PaymentReceipt,
    responses={
        404: {"description": "Recipient not found"},
        422: {"description": "Invalid amount or insufficient balance"},
        409: {"description": "Payment already processed"},
    },
)
async def send_payment(
    body: PaymentSendRequest,
    current_user: UserPublic = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    """Send a simulated payment to another BraillePay demo user by UPI ID.

    - Amount is validated and re-checked entirely server-side.
    - Balance is never trusted from the frontend.
    - Sending the same `Idempotency-Key` twice returns the original
      receipt instead of moving money a second time.
    """
    tx_doc = await payment_service.send_payment(
        sender_user_id=current_user.user_id,
        receiver_upi=body.receiver_upi,
        raw_amount=body.amount,
        note=body.note,
        idempotency_key=idempotency_key,
    )

    sender_balance_after = tx_doc.get("_sender_balance_after")
    if sender_balance_after is None:
        # Idempotent replay path: look the current balance up fresh.
        from app.database import get_db

        db = get_db()
        acct = await db.accounts.find_one({"account_id": tx_doc["sender_account_id"]})
        sender_balance_after = to_float(from_decimal128(acct["balance"]))

    transaction = serialize_transaction(tx_doc, viewer_user_id=current_user.user_id)

    return PaymentReceipt(
        transaction=transaction,
        sender_balance_after=sender_balance_after,
        message=(
            f"Payment successful. ₹{transaction.amount:,.2f} sent to "
            f"{tx_doc['description'].split(' paid ')[-1]}."
            if transaction.status == "SUCCESS"
            else "Payment could not be completed."
        ),
    )


@router.post(
    "/{transaction_id}/refund",
    response_model=PaymentReceipt,
    responses={
        403: {"description": "Only the recipient of a payment can refund it"},
        404: {"description": "Transaction not found"},
        409: {"description": "This payment has already been refunded"},
        422: {"description": "Only a successful payment can be refunded"},
    },
)
async def refund_payment(
    transaction_id: str, current_user: UserPublic = Depends(get_current_user)
):
    """Demo-only refund: the original recipient sends the money back to
    the original sender. Duplicate refunds are rejected atomically.
    """
    refund_doc = await payment_service.refund_payment(
        transaction_id=transaction_id, actor_user_id=current_user.user_id
    )

    sender_balance_after = refund_doc.get("_sender_balance_after")
    if sender_balance_after is None:
        from app.database import get_db

        db = get_db()
        acct = await db.accounts.find_one({"account_id": refund_doc["sender_account_id"]})
        sender_balance_after = to_float(from_decimal128(acct["balance"]))

    transaction = serialize_transaction(refund_doc, viewer_user_id=current_user.user_id)

    return PaymentReceipt(
        transaction=transaction,
        sender_balance_after=sender_balance_after,
        message=f"Refund of ₹{transaction.amount:,.2f} completed.",
    )
