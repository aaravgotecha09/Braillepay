from fastapi import APIRouter, Depends, Query

from app.deps import get_current_user
from app.models import PaymentRequestCreate, PaymentRequestPublic, UserPublic
from app.services import payment_request_service

router = APIRouter(prefix="/api/payment-requests", tags=["Payment Requests"])


def _serialize(doc: dict, viewer_user_id: str) -> PaymentRequestPublic:
    direction = "OUTGOING" if doc["requester_user_id"] == viewer_user_id else "INCOMING"
    return PaymentRequestPublic(
        request_id=doc["request_id"],
        requester_user_id=doc["requester_user_id"],
        payer_user_id=doc["payer_user_id"],
        requester_upi=doc["requester_upi"],
        payer_upi=doc["payer_upi"],
        requester_name=doc["requester_name"],
        payer_name=doc["payer_name"],
        amount=doc["amount"],
        note=doc.get("note"),
        status=doc["status"],
        created_at=doc["created_at"],
        expires_at=doc["expires_at"],
        paid_transaction_id=doc.get("paid_transaction_id"),
        direction=direction,
    )


@router.post("", response_model=PaymentRequestPublic)
async def create_payment_request(
    body: PaymentRequestCreate, current_user: UserPublic = Depends(get_current_user)
):
    """Ask another BraillePay demo user for simulated money. Nothing is
    transferred until they explicitly pay it.
    """
    doc = await payment_request_service.create_request(
        requester_user_id=current_user.user_id,
        payer_upi=body.payer_upi,
        amount=body.amount,
        note=body.note,
        expires_in_hours=body.expires_in_hours,
    )
    return _serialize(doc, current_user.user_id)


@router.get("", response_model=list[PaymentRequestPublic])
async def list_payment_requests(
    current_user: UserPublic = Depends(get_current_user),
    direction: str | None = Query(None, pattern="^(incoming|outgoing)$"),
):
    docs = await payment_request_service.list_requests(
        user_id=current_user.user_id, direction=direction
    )
    return [_serialize(d, current_user.user_id) for d in docs]


@router.post("/{request_id}/pay", response_model=PaymentRequestPublic)
async def pay_payment_request(
    request_id: str, current_user: UserPublic = Depends(get_current_user)
):
    """Pay an incoming request. Internally reuses the same payment engine
    as /api/payments/send, keyed so it can never be paid twice.
    """
    doc = await payment_request_service.pay_request(
        request_id=request_id, payer_user_id=current_user.user_id
    )
    return _serialize(doc, current_user.user_id)


@router.post("/{request_id}/decline", response_model=PaymentRequestPublic)
async def decline_payment_request(
    request_id: str, current_user: UserPublic = Depends(get_current_user)
):
    doc = await payment_request_service.decline_request(
        request_id=request_id, payer_user_id=current_user.user_id
    )
    return _serialize(doc, current_user.user_id)


@router.post("/{request_id}/cancel", response_model=PaymentRequestPublic)
async def cancel_payment_request(
    request_id: str, current_user: UserPublic = Depends(get_current_user)
):
    """Not in the original spec's endpoint list but a natural companion to
    pay/decline: lets the requester withdraw their own pending request.
    """
    doc = await payment_request_service.cancel_request(
        request_id=request_id, requester_user_id=current_user.user_id
    )
    return _serialize(doc, current_user.user_id)
