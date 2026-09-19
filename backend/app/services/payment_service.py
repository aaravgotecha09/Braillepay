"""
The payment service is the ONLY place in the codebase allowed to move
money between accounts. Routes must call into this module rather than
touching `accounts`/`transactions` collections directly, so there is a
single, auditable implementation of the transfer logic (Part 49 of the
spec: "Create a single payment service responsible for money movement").

Atomicity strategy
-------------------
A standalone (non-replica-set) MongoDB instance cannot run multi-document
ACID transactions, which is what most local `docker run mongo` / a bare
`docker-compose` single node give you. To stay correct even on a single
node, debits are performed as a single guarded `find_one_and_update`
(`balance >= amount` in the filter), which MongoDB executes atomically -
two concurrent sends from the same account can never both succeed and
double-spend. If the following credit step fails for any reason, we
compensate by crediting the sender back and marking the transaction
FAILED, so money is never silently destroyed.

If `MONGO_URL` points at a replica set or MongoDB Atlas (which supports
multi-document transactions), `session.with_transaction` is used instead
for a cleaner all-or-nothing guarantee.
"""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from pymongo.errors import OperationFailure

from app.database import get_client, get_db
from app.money import from_decimal128, to_decimal128, to_float, validate_amount
from app.services import notification_service

logger = logging.getLogger("braillepay.payments")


class PaymentError(HTTPException):
    pass


async def _next_reference_id(db) -> str:
    """Atomically incrementing daily reference counter -> BPYYYYMMDDNNNN."""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    counter_name = f"reference:{today}"
    doc = await db.counters.find_one_and_update(
        {"name": counter_name},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc["value"]
    return f"BP{today}{seq:04d}"


async def _load_sender_context(db, sender_user_id: str):
    user = await db.users.find_one({"user_id": sender_user_id})
    account = await db.accounts.find_one({"user_id": sender_user_id})
    if not user or not account:
        raise PaymentError(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sender account not found"
        )
    return user, account


async def _load_receiver_context(db, receiver_upi: str):
    user = await db.users.find_one({"upi_id": receiver_upi})
    if not user:
        raise PaymentError(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found"
        )
    account = await db.accounts.find_one({"user_id": user["user_id"]})
    if not account:
        raise PaymentError(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found"
        )
    return user, account


async def _debit(db, account_id: str, amount: Decimal):
    """Atomically decrement balance only if funds are sufficient."""
    result = await db.accounts.find_one_and_update(
        {"account_id": account_id, "balance": {"$gte": to_decimal128(amount)}},
        {"$inc": {"balance": to_decimal128(-amount)}},
        return_document=True,
    )
    if result is None:
        raise PaymentError(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Insufficient demo balance",
        )
    return result


async def _credit(db, account_id: str, amount: Decimal):
    return await db.accounts.find_one_and_update(
        {"account_id": account_id},
        {"$inc": {"balance": to_decimal128(amount)}},
        return_document=True,
    )


async def send_payment(
    *,
    sender_user_id: str,
    receiver_upi: str,
    raw_amount,
    note: str | None,
    idempotency_key: str | None,
) -> dict:
    """Move simulated money from the authenticated sender to a recipient
    identified by UPI ID. Returns the persisted transaction document.
    """
    db = get_db()

    # --- Idempotency: replay-safe on retry -------------------------------
    if idempotency_key:
        existing = await db.transactions.find_one(
            {"idempotency_key": idempotency_key, "sender_user_id": sender_user_id}
        )
        if existing:
            logger.info("Idempotent replay for key=%s", idempotency_key)
            return existing

    amount = validate_amount(raw_amount)

    sender_user, sender_account = await _load_sender_context(db, sender_user_id)
    receiver_upi = receiver_upi.strip().lower()

    if receiver_upi == sender_user["upi_id"]:
        raise PaymentError(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot send a payment to yourself",
        )

    receiver_user, receiver_account = await _load_receiver_context(db, receiver_upi)

    transaction_id = f"TXN-{uuid.uuid4().hex[:16].upper()}"
    reference_id = await _next_reference_id(db)
    now = datetime.now(timezone.utc)

    tx_doc = {
        "transaction_id": transaction_id,
        "reference_id": reference_id,
        "sender_user_id": sender_user["user_id"],
        "receiver_user_id": receiver_user["user_id"],
        "sender_upi": sender_user["upi_id"],
        "receiver_upi": receiver_user["upi_id"],
        "sender_account_id": sender_account["account_id"],
        "receiver_account_id": receiver_account["account_id"],
        "sender_bank_id": sender_account["bank_id"],
        "receiver_bank_id": receiver_account["bank_id"],
        "amount": to_decimal128(amount),
        "currency": "INR",
        "note": note,
        "type": "PAYMENT",
        "status": "PENDING",
        "created_at": now,
        "completed_at": None,
        "simulated": True,
        "description": f"{sender_user['name']} paid {receiver_user['name']}",
        "refunded": False,
    }
    if idempotency_key:
        tx_doc["idempotency_key"] = idempotency_key

    # Reserve the transaction row (also enforces idempotency at the DB
    # level via the unique partial index on idempotency_key).
    try:
        await db.transactions.insert_one(dict(tx_doc))
    except Exception as exc:  # duplicate key on idempotency_key race
        if idempotency_key:
            existing = await db.transactions.find_one(
                {"idempotency_key": idempotency_key, "sender_user_id": sender_user_id}
            )
            if existing:
                return existing
        raise PaymentError(
            status_code=status.HTTP_409_CONFLICT, detail="Payment already processed"
        ) from exc

    # --- Try a real multi-document transaction first (replica set / Atlas)
    used_native_transaction = False
    client = get_client()
    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                sender_updated = await db.accounts.find_one_and_update(
                    {
                        "account_id": sender_account["account_id"],
                        "balance": {"$gte": to_decimal128(amount)},
                    },
                    {"$inc": {"balance": to_decimal128(-amount)}},
                    return_document=True,
                    session=session,
                )
                if sender_updated is None:
                    # Raising here lets the `async with` context manager
                    # abort the transaction automatically.
                    raise PaymentError(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Insufficient demo balance",
                    )
                await db.accounts.update_one(
                    {"account_id": receiver_account["account_id"]},
                    {"$inc": {"balance": to_decimal128(amount)}},
                    session=session,
                )
                await db.transactions.update_one(
                    {"transaction_id": transaction_id},
                    {"$set": {"status": "SUCCESS", "completed_at": now}},
                    session=session,
                )
        used_native_transaction = True
        sender_balance_after = from_decimal128(sender_updated["balance"])
    except PaymentError:
        await db.transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"status": "FAILED", "completed_at": now}},
        )
        raise
    except OperationFailure:
        used_native_transaction = False
    except Exception:
        used_native_transaction = False

    if not used_native_transaction:
        # --- Fallback path for a standalone (non-replica-set) Mongo -----
        try:
            sender_updated = await _debit(db, sender_account["account_id"], amount)
        except PaymentError:
            await db.transactions.update_one(
                {"transaction_id": transaction_id},
                {"$set": {"status": "FAILED", "completed_at": now}},
            )
            raise
        try:
            await _credit(db, receiver_account["account_id"], amount)
        except Exception:
            # Compensate: give the money back and mark the transfer failed
            # rather than losing it.
            await db.accounts.update_one(
                {"account_id": sender_account["account_id"]},
                {"$inc": {"balance": to_decimal128(amount)}},
            )
            await db.transactions.update_one(
                {"transaction_id": transaction_id},
                {"$set": {"status": "FAILED", "completed_at": now}},
            )
            raise PaymentError(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment could not be completed. No funds were moved.",
            )

        await db.transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"status": "SUCCESS", "completed_at": now}},
        )
        sender_balance_after = from_decimal128(sender_updated["balance"])

    final_doc = await db.transactions.find_one({"transaction_id": transaction_id})
    final_doc["_sender_balance_after"] = to_float(sender_balance_after)

    if final_doc["status"] == "SUCCESS":
        amount_str = f"₹{to_float(amount):,.2f}"
        await notification_service.create_notification(
            user_id=receiver_user["user_id"],
            type="PAYMENT_RECEIVED",
            title="Money received",
            message=f"You received {amount_str} from {sender_user['name']}.",
            data={"transaction_id": transaction_id, "reference_id": reference_id},
        )
        await notification_service.create_notification(
            user_id=sender_user["user_id"],
            type="PAYMENT_SENT",
            title="Payment sent",
            message=f"You sent {amount_str} to {receiver_user['name']}.",
            data={"transaction_id": transaction_id, "reference_id": reference_id},
        )

    return final_doc


async def refund_payment(*, transaction_id: str, actor_user_id: str) -> dict:
    """Refund a previously SUCCESSFUL payment back to its original sender.

    Only the original *receiver* of the payment can trigger a refund (they
    are the one giving the money back). Guards against double refunds with
    an atomic "only if not already refunded" update.
    """
    db = get_db()

    original = await db.transactions.find_one({"transaction_id": transaction_id})
    if not original:
        raise PaymentError(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if actor_user_id not in (original["sender_user_id"], original["receiver_user_id"]):
        raise PaymentError(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if actor_user_id != original["receiver_user_id"]:
        raise PaymentError(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the recipient of a payment can refund it",
        )

    if original.get("type") != "PAYMENT" or original.get("status") != "SUCCESS":
        raise PaymentError(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only a successful payment can be refunded",
        )

    # Atomic "claim" of the refund — prevents two concurrent refund
    # requests for the same transaction from both succeeding.
    claimed = await db.transactions.find_one_and_update(
        {"transaction_id": transaction_id, "refunded": {"$ne": True}},
        {"$set": {"refunded": True}},
        return_document=True,
    )
    if claimed is None:
        raise PaymentError(
            status_code=status.HTTP_409_CONFLICT, detail="This payment has already been refunded"
        )

    amount = from_decimal128(original["amount"])
    refund_tx_id = f"TXN-{uuid.uuid4().hex[:16].upper()}"
    reference_id = await _next_reference_id(db)
    now = datetime.now(timezone.utc)

    refund_doc = {
        "transaction_id": refund_tx_id,
        "reference_id": reference_id,
        "sender_user_id": original["receiver_user_id"],
        "receiver_user_id": original["sender_user_id"],
        "sender_upi": original["receiver_upi"],
        "receiver_upi": original["sender_upi"],
        "sender_account_id": original["receiver_account_id"],
        "receiver_account_id": original["sender_account_id"],
        "sender_bank_id": original["receiver_bank_id"],
        "receiver_bank_id": original["sender_bank_id"],
        "amount": to_decimal128(amount),
        "currency": "INR",
        "note": f"Refund of {original['transaction_id']}",
        "type": "REFUND",
        "status": "PENDING",
        "created_at": now,
        "completed_at": None,
        "simulated": True,
        "description": f"Refund for payment {original['reference_id']}",
        "refunded": False,
        "refund_of_transaction_id": original["transaction_id"],
    }
    await db.transactions.insert_one(dict(refund_doc))

    try:
        debited = await _debit(db, original["receiver_account_id"], amount)
    except PaymentError:
        # Roll back the "claim" so the payment can be retried/refunded later.
        await db.transactions.update_one(
            {"transaction_id": transaction_id}, {"$set": {"refunded": False}}
        )
        await db.transactions.update_one(
            {"transaction_id": refund_tx_id}, {"$set": {"status": "FAILED", "completed_at": now}}
        )
        raise

    try:
        await _credit(db, original["sender_account_id"], amount)
    except Exception:
        await db.accounts.update_one(
            {"account_id": original["receiver_account_id"]},
            {"$inc": {"balance": to_decimal128(amount)}},
        )
        await db.transactions.update_one(
            {"transaction_id": transaction_id}, {"$set": {"refunded": False}}
        )
        await db.transactions.update_one(
            {"transaction_id": refund_tx_id}, {"$set": {"status": "FAILED", "completed_at": now}}
        )
        raise PaymentError(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Refund could not be completed. No funds were moved.",
        )

    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"refund_transaction_id": refund_tx_id}},
    )
    await db.transactions.update_one(
        {"transaction_id": refund_tx_id},
        {"$set": {"status": "SUCCESS", "completed_at": now}},
    )

    refund_final = await db.transactions.find_one({"transaction_id": refund_tx_id})
    refund_final["_sender_balance_after"] = to_float(from_decimal128(debited["balance"]))

    amount_str = f"₹{to_float(amount):,.2f}"
    await notification_service.create_notification(
        user_id=original["sender_user_id"],
        type="REFUND_RECEIVED",
        title="Refund received",
        message=f"You received a refund of {amount_str} for payment {original['reference_id']}.",
        data={"transaction_id": refund_tx_id, "refund_of": transaction_id},
    )

    return refund_final
