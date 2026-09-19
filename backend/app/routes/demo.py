from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.database import get_db
from app.models import BankPublic, DemoResetResponse, DemoStatsResponse, UserPublic
from app.money import from_decimal128, to_float
from app.serializers import serialize_transaction
from app.services import seed_service

router = APIRouter(prefix="/api/demo", tags=["Demo"])
settings = get_settings()


def _require_demo_mode():
    if not settings.demo_mode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post("/reset", response_model=DemoResetResponse)
async def reset_demo_data():
    """Restore all six demo users/accounts to their seeded starting
    balances, wipe demo-generated transactions/requests/notifications,
    and recreate the sample historical data. Only available in demo mode.
    """
    _require_demo_mode()
    db = get_db()
    result = await seed_service.reset_demo(db)
    return DemoResetResponse(**result)


@router.get("/stats", response_model=DemoStatsResponse)
async def demo_stats():
    """Powers the optional demo admin dashboard (Part 34). Demo-mode only."""
    _require_demo_mode()
    db = get_db()

    users_cursor = db.users.find({"demo": True}).sort("username", 1)
    users = await users_cursor.to_list(length=50)
    banks = await db.banks.find({}).to_list(length=10)
    accounts = await db.accounts.find({}).to_list(length=50)

    total_demo_balance = sum(to_float(from_decimal128(a["balance"])) for a in accounts)

    total_transactions = await db.transactions.count_documents({})
    successful_payments = await db.transactions.count_documents(
        {"status": "SUCCESS", "type": {"$in": ["PAYMENT", "REFUND"]}}
    )
    failed_payments = await db.transactions.count_documents({"status": "FAILED"})

    success_docs = await db.transactions.find(
        {"status": "SUCCESS", "type": "PAYMENT"}
    ).to_list(length=10000)
    total_money_sent = sum(to_float(from_decimal128(t["amount"])) for t in success_docs)

    recent = (
        await db.transactions.find({}).sort("created_at", -1).limit(10).to_list(length=10)
    )

    return DemoStatsResponse(
        total_users=len(users),
        total_banks=len(banks),
        total_demo_balance=total_demo_balance,
        total_transactions=total_transactions,
        successful_payments=successful_payments,
        failed_payments=failed_payments,
        total_money_sent=total_money_sent,
        total_money_received=total_money_sent,  # every simulated payment's sent == received
        users=[
            UserPublic(user_id=u["user_id"], username=u["username"], name=u["name"], upi_id=u["upi_id"])
            for u in users
        ],
        banks=[
            BankPublic(bank_id=b["bank_id"], name=b["name"], code=b["code"], ifsc=b["ifsc"])
            for b in banks
        ],
        recent_transactions=[serialize_transaction(t) for t in recent],
    )
