from fastapi import APIRouter

from app.database import get_db
from app.models import BankPublic
from app.money import from_decimal128, to_float
from pydantic import BaseModel

router = APIRouter(prefix="/api/banks", tags=["Banks"])


class BankSummary(BaseModel):
    bank: BankPublic
    demo: bool = True
    account_count: int
    total_transaction_volume: float


@router.get("", response_model=list[BankSummary])
async def list_banks():
    """The two fictional demo banks, clearly labeled as such, with basic
    stats. Neither is a real financial institution — see the `demo` flag.
    """
    db = get_db()
    banks = await db.banks.find({}).to_list(length=10)

    out = []
    for bank in banks:
        account_count = await db.accounts.count_documents({"bank_id": bank["bank_id"]})

        # Volume = sum of successful PAYMENT amounts sent from an account at this bank.
        account_ids = [
            a["account_id"]
            async for a in db.accounts.find({"bank_id": bank["bank_id"]}, {"account_id": 1})
        ]
        volume_docs = await db.transactions.find(
            {
                "sender_account_id": {"$in": account_ids},
                "status": "SUCCESS",
                "type": {"$in": ["PAYMENT", "REFUND"]},
            }
        ).to_list(length=10000)
        volume = sum(to_float(from_decimal128(t["amount"])) for t in volume_docs)

        out.append(
            BankSummary(
                bank=BankPublic(
                    bank_id=bank["bank_id"], name=bank["name"], code=bank["code"], ifsc=bank["ifsc"]
                ),
                demo=bank.get("demo", True),
                account_count=account_count,
                total_transaction_volume=volume,
            )
        )
    return out
