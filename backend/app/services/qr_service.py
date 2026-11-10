"""
QR identity service.

Each user has exactly one permanent BraillePay QR identity. We store the
*payload* (safe, non-sensitive JSON) and generate the PNG image on the
fly rather than persisting binary image blobs — cheaper to store and
trivially reproducible.

The payload deliberately excludes anything sensitive: no PIN, no
balance, no bank account number, no auth token.
"""
import base64
import io
import json
import uuid
from datetime import datetime, timezone

import qrcode

from app.database import get_db


def build_payload(*, user_id: str, upi_id: str, name: str) -> dict:
    return {
        "type": "braillepay_payment",
        "version": 1,
        "upi_id": upi_id,
        "name": name,
        "user_id": user_id,
    }


def render_qr_image_base64(payload: dict) -> str:
    """Render the payload as a PNG QR code, returned as base64 (no data-URI
    prefix — the frontend can decide `data:image/png;base64,` vs download).
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(json.dumps(payload, separators=(",", ":")))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


async def get_or_create_qr_for_user(user: dict) -> dict:
    """Idempotent: returns the user's existing QR doc, creating one if the
    demo user somehow doesn't have one yet (all seeded users already do).
    """
    db = get_db()
    existing = await db.qr_codes.find_one({"user_id": user["user_id"]})
    if existing:
        return existing

    payload = build_payload(
        user_id=user["user_id"], upi_id=user["upi_id"], name=user["name"]
    )
    doc = {
        "qr_id": f"qr_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "upi_id": user["upi_id"],
        "name": user["name"],
        "payload": payload,
        "created_at": datetime.now(timezone.utc),
    }
    await db.qr_codes.insert_one(doc)
    return doc


def to_public(doc: dict, *, with_image: bool = True) -> dict:
    out = {
        "qr_id": doc["qr_id"],
        "upi_id": doc["upi_id"],
        "name": doc["name"],
        "payload": doc["payload"],
        "image_base64": None,
    }
    if with_image:
        out["image_base64"] = render_qr_image_base64(doc["payload"])
    return out
