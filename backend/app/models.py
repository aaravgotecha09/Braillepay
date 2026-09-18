"""
Pydantic schemas.

Naming convention:
- `*InDB`  -> the full document as stored in MongoDB (may include secrets)
- `*Public` / plain name -> what is safe to return to the client
- `*Request` -> request bodies
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class UserInDB(BaseModel):
    user_id: str
    username: str
    name: str
    upi_id: str
    pin_hash: str
    demo: bool = True
    created_at: datetime


class UserPublic(BaseModel):
    user_id: str
    username: str
    name: str
    upi_id: str


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    pin: str = Field(..., min_length=4, max_length=12)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserPublic


class DemoUserSummary(BaseModel):
    username: str
    name: str
    upi_id: str


# ---------------------------------------------------------------------------
# Banks
# ---------------------------------------------------------------------------
class BankInDB(BaseModel):
    bank_id: str
    name: str
    code: str
    ifsc: str
    demo: bool = True


class BankPublic(BaseModel):
    bank_id: str
    name: str
    code: str
    ifsc: str
    demo: bool = True


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
class AccountInDB(BaseModel):
    account_id: str
    user_id: str
    bank_id: str
    account_number: str
    account_type: str = "SAVINGS"
    balance: float
    currency: str = "INR"
    status: str = "ACTIVE"
    created_at: datetime


class AccountPublic(BaseModel):
    account_id: str
    bank_id: str
    account_number: str
    account_type: str
    balance: float
    currency: str
    status: str


class BalanceResponse(BaseModel):
    balance: float
    currency: str
    account: AccountPublic
    bank: BankPublic


# ---------------------------------------------------------------------------
# QR codes
# ---------------------------------------------------------------------------
class QRCodeInDB(BaseModel):
    qr_id: str
    user_id: str
    upi_id: str
    name: str
    payload: dict
    created_at: datetime


class QRCodePublic(BaseModel):
    qr_id: str
    upi_id: str
    name: str
    payload: dict
    image_base64: Optional[str] = None
