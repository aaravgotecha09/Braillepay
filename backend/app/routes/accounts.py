from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.deps import get_current_user
from app.models import AccountPublic, BalanceResponse, BankPublic, UserPublic
from app.money import from_decimal128, to_float

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(current_user: UserPublic = Depends(get_current_user)):
    """Authoritative balance for the logged-in user, read straight from
    the database. The frontend must call this after login and after
    every transaction rather than trusting any locally cached number.
    """
    db = get_db()
    account = await db.accounts.find_one({"user_id": current_user.user_id})
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )
    bank = await db.banks.find_one({"bank_id": account["bank_id"]})

    account_public = AccountPublic(
        account_id=account["account_id"],
        bank_id=account["bank_id"],
        account_number=account["account_number"],
        account_type=account["account_type"],
        balance=to_float(from_decimal128(account["balance"])),
        currency=account["currency"],
        status=account["status"],
    )
    bank_public = BankPublic(
        bank_id=bank["bank_id"], name=bank["name"], code=bank["code"], ifsc=bank["ifsc"]
    )

    return BalanceResponse(
        balance=account_public.balance,
        currency=account_public.currency,
        account=account_public,
        bank=bank_public,
    )
