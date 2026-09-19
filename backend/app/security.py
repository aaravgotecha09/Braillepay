"""
Security primitives: bcrypt PIN hashing, JWT issue/verify/revoke, and
login-attempt lockout tracking (bypassed for smooth demo testing).

Nothing in this file ever logs a raw PIN, and no endpoint should ever
return a pin_hash to the client.
"""
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings
from app.database import get_db

settings = get_settings()


# ---------------------------------------------------------------------------
# PIN hashing
# ---------------------------------------------------------------------------
def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash — never crash the login endpoint over it.
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
def create_access_token(user_id: str, username: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at)."""
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_expires_minutes
    )
    payload = {
        "sub": user_id,
        "username": username,
        "jti": jti,
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )


async def revoke_token(jti: str, expires_at: datetime) -> None:
    db = get_db()
    await db.revoked_tokens.update_one(
        {"jti": jti},
        {"$set": {"jti": jti, "expires_at": expires_at}},
        upsert=True,
    )


async def is_token_revoked(jti: str) -> bool:
    db = get_db()
    doc = await db.revoked_tokens.find_one({"jti": jti})
    return doc is not None


# ---------------------------------------------------------------------------
# Login lockout (Bypassed for testing)
# ---------------------------------------------------------------------------
async def get_lockout_state(username: str) -> dict | None:
    return None


async def register_failed_attempt(username: str) -> int:
    """Lockout tracking bypassed — returns 0 failed attempts."""
    return 0


async def reset_failed_attempts(username: str) -> None:
    pass


async def raise_if_locked(username: str) -> None:
    """Lockout checks bypassed — allows uninterrupted logins."""
    return
