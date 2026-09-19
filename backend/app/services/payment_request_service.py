"""
Simulated "request money" flow. A payment request never moves money by
itself — paying one just calls into payment_service.send_payment with an
idempotency key derived from the request, so a request can only ever be
paid once even under a double-click / retry.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.database import get_db
from app.services import notification_service, payment_service


async def _expire_if_needed(db, doc: dict) -> dict:
    if doc["status"] == "PENDING" and doc["expires_at"] <= datetime.now(timezone.utc):
        await db.payment_requests.update_one(
            {"request_id": doc["request_id"]}, {"$set": {"status": "EXPIRED"}}
        )
        doc["status"] = "EXPIRED"
    return doc


async def create_request(
    *, requester_user_id: str, payer_upi: str, amount: float, note: str | None, expires_in_hours: int
) -> dict:
    db = get_db()

    requester = await db.users.find_one({"user_id": requester_user_id})
    payer = await db.users.find_one({"upi_id": payer_upi})
    if not payer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")
    if payer["user_id"] == requester_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot request money from yourself",
        )
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Amount must be greater than ₹0"
        )

    now = datetime.now(timezone.utc)
    doc = {
        "request_id": f"req_{uuid.uuid4().hex[:16]}",
        "requester_user_id": requester_user_id,
        "payer_user_id": payer["user_id"],
        "requester_upi": requester["upi_id"],
        "payer_upi": payer["upi_id"],
        "requester_name": requester["name"],
        "payer_name": payer["name"],
        "amount": amount,
        "note": note,
        "status": "PENDING",
        "created_at": now,
        "expires_at": now + timedelta(hours=expires_in_hours),
        "paid_transaction_id": None,
    }
    await db.payment_requests.insert_one(dict(doc))

    await notification_service.create_notification(
        user_id=payer["user_id"],
        type="PAYMENT_REQUEST_RECEIVED",
        title="Payment request",
        message=f"{requester['name']} requested ₹{amount:,.2f} from you.",
        data={"request_id": doc["request_id"]},
    )

    return doc


async def list_requests(*, user_id: str, direction: str | None = None) -> list[dict]:
    db = get_db()
    query: dict = {"$or": [{"requester_user_id": user_id}, {"payer_user_id": user_id}]}
    if direction == "incoming":
        query = {"payer_user_id": user_id}
    elif direction == "outgoing":
        query = {"requester_user_id": user_id}

    docs = await db.payment_requests.find(query).sort("created_at", -1).to_list(length=200)
    return [await _expire_if_needed(db, d) for d in docs]


async def get_request_or_404(request_id: str) -> dict:
    db = get_db()
    doc = await db.payment_requests.find_one({"request_id": request_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found")
    return await _expire_if_needed(db, doc)


async def pay_request(*, request_id: str, payer_user_id: str) -> dict:
    db = get_db()
    doc = await get_request_or_404(request_id)

    if doc["payer_user_id"] != payer_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found")
    if doc["status"] != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This request is already {doc['status'].lower()}",
        )

    tx_doc = await payment_service.send_payment(
        sender_user_id=payer_user_id,
        receiver_upi=doc["requester_upi"],
        raw_amount=doc["amount"],
        note=doc["note"] or f"Payment request {doc['request_id']}",
        idempotency_key=f"payreq-{doc['request_id']}",
    )

    updated = await db.payment_requests.find_one_and_update(
        {"request_id": request_id, "status": "PENDING"},
        {"$set": {"status": "PAID", "paid_transaction_id": tx_doc["transaction_id"]}},
        return_document=True,
    )
    if updated is None:
        # Someone else paid/declined it in the meantime, but the payment
        # itself already succeeded (or was replayed idempotently) above.
        updated = await db.payment_requests.find_one({"request_id": request_id})

    await notification_service.create_notification(
        user_id=doc["requester_user_id"],
        type="PAYMENT_REQUEST_PAID",
        title="Payment request paid",
        message=f"{doc['payer_name']} paid your request for ₹{doc['amount']:,.2f}.",
        data={"request_id": request_id, "transaction_id": tx_doc["transaction_id"]},
    )

    return updated


async def decline_request(*, request_id: str, payer_user_id: str) -> dict:
    db = get_db()
    doc = await get_request_or_404(request_id)

    if doc["payer_user_id"] != payer_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found")
    if doc["status"] != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This request is already {doc['status'].lower()}",
        )

    updated = await db.payment_requests.find_one_and_update(
        {"request_id": request_id, "status": "PENDING"},
        {"$set": {"status": "DECLINED"}},
        return_document=True,
    )
    return updated or doc


async def cancel_request(*, request_id: str, requester_user_id: str) -> dict:
    db = get_db()
    doc = await get_request_or_404(request_id)

    if doc["requester_user_id"] != requester_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found")
    if doc["status"] != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This request is already {doc['status'].lower()}",
        )

    updated = await db.payment_requests.find_one_and_update(
        {"request_id": request_id, "status": "PENDING"},
        {"$set": {"status": "CANCELLED"}},
        return_document=True,
    )
    return updated or doc
