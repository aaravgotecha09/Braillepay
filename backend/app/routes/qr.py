from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import QRCodePublic, UserPublic
from app.services import qr_service

router = APIRouter(prefix="/api/qr", tags=["QR Codes"])
settings = get_settings()


@router.post("/generate", response_model=QRCodePublic)
async def generate_my_qr(current_user: UserPublic = Depends(get_current_user)):
    """Idempotent: every demo user already has a permanent QR from seeding;
    this creates one on the fly if it's somehow missing.
    """
    db = get_db()
    user = await db.users.find_one({"user_id": current_user.user_id})
    doc = await qr_service.get_or_create_qr_for_user(user)
    return qr_service.to_public(doc)


@router.get("/my", response_model=QRCodePublic)
async def get_my_qr(current_user: UserPublic = Depends(get_current_user)):
    db = get_db()
    doc = await db.qr_codes.find_one({"user_id": current_user.user_id})
    if not doc:
        user = await db.users.find_one({"user_id": current_user.user_id})
        doc = await qr_service.get_or_create_qr_for_user(user)
    return qr_service.to_public(doc)


@router.get("/demo-list", response_model=list[QRCodePublic])
async def list_demo_qr_codes():
    """Powers the 'Demo QR' picker (Part 11 / Part 12's 'Use Demo QR'
    fallback when no camera is available). Only meaningful in demo mode.
    """
    if not settings.demo_mode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    db = get_db()
    docs = await db.qr_codes.find({}).sort("name", 1).to_list(length=50)
    return [qr_service.to_public(d) for d in docs]


@router.get("/user/{user_id}", response_model=QRCodePublic)
async def get_qr_by_user(
    user_id: str, current_user: UserPublic = Depends(get_current_user)
):
    db = get_db()
    doc = await db.qr_codes.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")
    return qr_service.to_public(doc)


@router.get("/{qr_id}", response_model=QRCodePublic)
async def get_qr_by_id(qr_id: str, current_user: UserPublic = Depends(get_current_user)):
    """Used by the scanner: decode a QR's `qr_id` (or look up by payload
    client-side and hit /user/{user_id} instead) to identify the
    recipient before showing the Braille/haptic verification step.
    """
    db = get_db()
    doc = await db.qr_codes.find_one({"qr_id": qr_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid BraillePay QR code"
        )
    return qr_service.to_public(doc)
