"""
Server-side WebAuthn support (Part 25 of the spec): registering a real
platform authenticator (Face ID, Windows Hello, a security key, ...)
against a BraillePay account, and logging in with it afterwards.

This is layered ON TOP of username+PIN login, not a replacement for it —
a demo user always has the PIN as a fallback. It is also a different
thing from the frontend's pre-existing local device lock, which never
talks to a server at all.

Challenges are single-use and short-lived, stored in the
`webauthn_challenges` collection (TTL-indexed in app/database.py so they
self-expire). Credentials are stored in `webauthn_credentials`.
"""
import uuid
from datetime import datetime, timedelta, timezone

from app.database import get_db

CHALLENGE_TTL_SECONDS = 300


async def store_challenge(*, user_id: str | None, challenge: bytes, purpose: str) -> None:
    """purpose is 'registration' or 'authentication'. For authentication,
    user_id may be None if the caller only knows a username (we still key
    by a synthetic id derived from that) — but here we always resolve to
    a real user_id before calling this, since the login flow needs a
    known account to fetch allowCredentials for anyway.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    await db.webauthn_challenges.update_one(
        {"user_id": user_id, "purpose": purpose},
        {
            "$set": {
                "user_id": user_id,
                "purpose": purpose,
                "challenge": challenge,
                "created_at": now,
                "expires_at": now + timedelta(seconds=CHALLENGE_TTL_SECONDS),
            }
        },
        upsert=True,
    )


async def pop_challenge(*, user_id: str, purpose: str) -> bytes | None:
    """Fetch-and-delete: a challenge is used at most once."""
    db = get_db()
    doc = await db.webauthn_challenges.find_one_and_delete(
        {"user_id": user_id, "purpose": purpose}
    )
    if not doc:
        return None
    if doc["expires_at"] < datetime.now(timezone.utc):
        return None
    return doc["challenge"]


async def save_credential(
    *, user_id: str, credential_id: bytes, public_key: bytes, sign_count: int, transports: list[str]
) -> None:
    db = get_db()
    await db.webauthn_credentials.update_one(
        {"credential_id": credential_id},
        {
            "$set": {
                "credential_id": credential_id,
                "user_id": user_id,
                "public_key": public_key,
                "sign_count": sign_count,
                "transports": transports,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


async def list_credentials_for_user(user_id: str) -> list[dict]:
    db = get_db()
    return await db.webauthn_credentials.find({"user_id": user_id}).to_list(length=20)


async def get_credential(credential_id: bytes) -> dict | None:
    db = get_db()
    return await db.webauthn_credentials.find_one({"credential_id": credential_id})


async def update_sign_count(credential_id: bytes, new_count: int) -> None:
    db = get_db()
    await db.webauthn_credentials.update_one(
        {"credential_id": credential_id}, {"$set": {"sign_count": new_count}}
    )


async def delete_credential(*, user_id: str, credential_id: bytes) -> bool:
    db = get_db()
    result = await db.webauthn_credentials.delete_one(
        {"credential_id": credential_id, "user_id": user_id}
    )
    return result.deleted_count > 0


def new_user_handle() -> bytes:
    """WebAuthn wants an opaque per-account 'user handle' (<=64 bytes).
    We don't need it to mean anything, just to be stable and unique.
    """
    return uuid.uuid4().bytes
