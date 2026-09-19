from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_db
from app.deps import get_current_user
from app.models import BankPublic, UserPublic
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserLookupResponse(BaseModel):
    user: UserPublic
    bank: BankPublic


@router.get("/lookup", response_model=UserLookupResponse)
async def lookup_user_by_upi(
    upi_id: str = Query(..., min_length=3, max_length=128),
    current_user: UserPublic = Depends(get_current_user),
):
    """Resolve a UPI ID to a display name + bank before money moves.

    Used by the Send Money recipient-verification step and the QR
    privacy-verification flow. Deliberately returns only public-safe
    fields — no balance, no PIN, no account number.
    """
    db = get_db()
    upi_id = upi_id.strip().lower()

    user = await db.users.find_one({"upi_id": upi_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    account = await db.accounts.find_one({"user_id": user["user_id"]})
    bank = await db.banks.find_one({"bank_id": account["bank_id"]}) if account else None

    return UserLookupResponse(
        user=UserPublic(
            user_id=user["user_id"], username=user["username"], name=user["name"], upi_id=user["upi_id"]
        ),
        bank=BankPublic(
            bank_id=bank["bank_id"], name=bank["name"], code=bank["code"], ifsc=bank["ifsc"]
        )
        if bank
        else BankPublic(bank_id="", name="Unknown Bank", code="", ifsc=""),
    )
