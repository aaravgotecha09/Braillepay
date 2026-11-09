"""
Pydantic schemas.

Naming convention:
- `*InDB`  -> the full document as stored in MongoDB (may include secrets)
- `*Public` / plain name -> what is safe to return to the client
- `*Request` -> request bodies
"""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


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


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
class PaymentSendRequest(BaseModel):
    receiver_upi: str = Field(..., min_length=3, max_length=128)
    amount: float = Field(..., gt=0)
    note: Optional[str] = Field(None, max_length=280)

    @field_validator("receiver_upi")
    @classmethod
    def normalize_upi(cls, v: str) -> str:
        return v.strip().lower()


TransactionType = Literal["PAYMENT", "RECEIVED", "REFUND", "PAYMENT_REQUEST"]
TransactionStatus = Literal["SUCCESS", "FAILED", "PENDING", "CANCELLED"]


class TransactionPublic(BaseModel):
    transaction_id: str
    reference_id: str
    sender_user_id: str
    receiver_user_id: str
    sender_upi: str
    receiver_upi: str
    sender_account_id: str
    receiver_account_id: str
    sender_bank_id: str
    receiver_bank_id: str
    amount: float
    currency: str = "INR"
    note: Optional[str] = None
    type: TransactionType
    status: TransactionStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    simulated: bool = True
    description: Optional[str] = None
    refunded: bool = False

    # Convenience field the frontend can use to know "did I send or
    # receive this one", filled in per-request relative to the viewer.
    direction: Optional[Literal["SENT", "RECEIVED"]] = None


class PaymentReceipt(BaseModel):
    transaction: TransactionPublic
    sender_balance_after: float
    message: str


class TransactionListResponse(BaseModel):
    items: list[TransactionPublic]
    total: int
    limit: int
    skip: int


class RefundRequest(BaseModel):
    pass  # no body needed; transaction_id comes from the path
# ---------------------------------------------------------------------------
# Payment requests
# ---------------------------------------------------------------------------
PaymentRequestStatus = Literal["PENDING", "PAID", "DECLINED", "CANCELLED", "EXPIRED"]


class PaymentRequestCreate(BaseModel):
    payer_upi: str = Field(..., min_length=3, max_length=128)
    amount: float = Field(..., gt=0)
    note: Optional[str] = Field(None, max_length=280)
    expires_in_hours: int = Field(48, ge=1, le=24 * 14)

    @field_validator("payer_upi")
    @classmethod
    def normalize_upi(cls, v: str) -> str:
        return v.strip().lower()


class PaymentRequestPublic(BaseModel):
    request_id: str
    requester_user_id: str
    payer_user_id: str
    requester_upi: str
    payer_upi: str
    requester_name: str
    payer_name: str
    amount: float
    note: Optional[str] = None
    status: PaymentRequestStatus
    created_at: datetime
    expires_at: datetime
    paid_transaction_id: Optional[str] = None
    direction: Optional[Literal["INCOMING", "OUTGOING"]] = None


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationPublic(BaseModel):
    notification_id: str
    type: str
    title: str
    message: str
    data: dict = {}
    read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationPublic]
    unread_count: int


# ---------------------------------------------------------------------------
# Demo / admin
# ---------------------------------------------------------------------------
class DemoResetResponse(BaseModel):
    message: str
    users_reset: int
    transactions_recreated: int


class DemoStatsResponse(BaseModel):
    total_users: int
    total_banks: int
    total_demo_balance: float
    total_transactions: int
    successful_payments: int
    failed_payments: int
    total_money_sent: float
    total_money_received: float
    users: list[UserPublic]
    banks: list[BankPublic]
    recent_transactions: list[TransactionPublic]

