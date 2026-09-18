from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_token_payload, get_current_user
from app.models import (
    DemoUserSummary,
    LoginRequest,
    LoginResponse,
    UserPublic,
)
from app.security import (
    create_access_token,
    raise_if_locked,
    register_failed_attempt,
    reset_failed_attempts,
    revoke_token,
    verify_pin,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
settings = get_settings()


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"description": "Invalid username or PIN"},
        423: {"description": "Account temporarily locked"},
    },
)
async def login(body: LoginRequest):
    """Authenticate a demo user with username + PIN and issue a JWT.

    PINs are never stored or compared in plaintext (bcrypt), and repeated
    failed attempts lock the account for a cooldown period.
    """
    await raise_if_locked(body.username)

    db = get_db()
    user = await db.users.find_one({"username": body.username})

    if not user or not verify_pin(body.pin, user["pin_hash"]):
        await register_failed_attempt(body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or PIN",
        )

    await reset_failed_attempts(body.username)

    token, _jti, expires_at = create_access_token(user["user_id"], user["username"])

    return LoginResponse(
        access_token=token,
        expires_at=expires_at,
        user=UserPublic(
            user_id=user["user_id"],
            username=user["username"],
            name=user["name"],
            upi_id=user["upi_id"],
        ),
    )


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: UserPublic = Depends(get_current_user)):
    """Return the authenticated user's public profile. Never includes pin_hash."""
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: dict = Depends(get_current_token_payload)):
    """Revoke the current JWT so it can no longer be used."""
    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        await revoke_token(jti, expires_at)


@router.get("/demo-users", response_model=list[DemoUserSummary])
async def list_demo_users():
    """Quick-login shortcuts for the demo UI.

    Only exposed when DEMO_MODE=true — production deployments should not
    let visitors enumerate account usernames.
    """
    if not settings.demo_mode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    db = get_db()
    users = await db.users.find({"demo": True}).sort("username", 1).to_list(length=50)
    return [
        DemoUserSummary(username=u["username"], name=u["name"], upi_id=u["upi_id"])
        for u in users
    ]
