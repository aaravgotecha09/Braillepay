from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_db
from app.deps import get_current_user
from app.models import TransactionListResponse, TransactionPublic, UserPublic
from app.serializers import serialize_transaction

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    current_user: UserPublic = Depends(get_current_user),
    type: str | None = Query(None, description="PAYMENT, RECEIVED, REFUND, PAYMENT_REQUEST"),
    status_filter: str | None = Query(None, alias="status", description="SUCCESS, FAILED, PENDING, CANCELLED"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    search: str | None = Query(None, description="Matches note, description, or counterparty UPI"),
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """Transaction history for the authenticated user only — a user can
    never see another user's transactions, even by guessing an ID.
    """
    db = get_db()

    query: dict = {
        "$or": [
            {"sender_user_id": current_user.user_id},
            {"receiver_user_id": current_user.user_id},
        ]
    }

    if type:
        query["type"] = type
    if status_filter:
        query["status"] = status_filter
    if date_from or date_to:
        date_clause = {}
        if date_from:
            date_clause["$gte"] = date_from
        if date_to:
            date_clause["$lte"] = date_to
        query["created_at"] = date_clause
    if min_amount is not None or max_amount is not None:
        amount_clause = {}
        if min_amount is not None:
            amount_clause["$gte"] = min_amount
        if max_amount is not None:
            amount_clause["$lte"] = max_amount
        # amount is stored as Decimal128; Mongo compares numeric types fine.
        query["amount"] = amount_clause
    if search:
        query["$and"] = query.get("$and", []) + [
            {
                "$or": [
                    {"note": {"$regex": search, "$options": "i"}},
                    {"description": {"$regex": search, "$options": "i"}},
                    {"sender_upi": {"$regex": search, "$options": "i"}},
                    {"receiver_upi": {"$regex": search, "$options": "i"}},
                ]
            }
        ]

    total = await db.transactions.count_documents(query)
    cursor = (
        db.transactions.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    items = [serialize_transaction(d, viewer_user_id=current_user.user_id) for d in docs]

    return TransactionListResponse(items=items, total=total, limit=limit, skip=skip)


@router.get("/{transaction_id}", response_model=TransactionPublic)
async def get_transaction(
    transaction_id: str, current_user: UserPublic = Depends(get_current_user)
):
    db = get_db()
    doc = await db.transactions.find_one({"transaction_id": transaction_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if current_user.user_id not in (doc["sender_user_id"], doc["receiver_user_id"]):
        # Same response as "not found" — don't reveal that the ID exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    return serialize_transaction(doc, viewer_user_id=current_user.user_id)
