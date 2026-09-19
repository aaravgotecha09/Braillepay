from app.models import TransactionPublic
from app.money import to_float


def serialize_transaction(doc: dict, viewer_user_id: str | None = None) -> TransactionPublic:
    direction = None
    if viewer_user_id:
        if doc["sender_user_id"] == viewer_user_id:
            direction = "SENT"
        elif doc["receiver_user_id"] == viewer_user_id:
            direction = "RECEIVED"

    return TransactionPublic(
        transaction_id=doc["transaction_id"],
        reference_id=doc["reference_id"],
        sender_user_id=doc["sender_user_id"],
        receiver_user_id=doc["receiver_user_id"],
        sender_upi=doc["sender_upi"],
        receiver_upi=doc["receiver_upi"],
        sender_account_id=doc["sender_account_id"],
        receiver_account_id=doc["receiver_account_id"],
        sender_bank_id=doc["sender_bank_id"],
        receiver_bank_id=doc["receiver_bank_id"],
        amount=to_float(doc["amount"]),
        currency=doc.get("currency", "INR"),
        note=doc.get("note"),
        type=doc.get("type", "PAYMENT"),
        status=doc.get("status", "PENDING"),
        created_at=doc["created_at"],
        completed_at=doc.get("completed_at"),
        simulated=doc.get("simulated", True),
        description=doc.get("description"),
        refunded=doc.get("refunded", False),
        direction=direction,
    )
