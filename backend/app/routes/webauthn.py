"""
Server-side WebAuthn (Part 25). Two flows:

1. Registration (must already be logged in via PIN): the browser asks
   the authenticator to create a new credential, and we store its
   public key against the account.
2. Authentication (login): given a username, the browser asks the
   authenticator for an assertion using one of that account's stored
   credentials, and a valid one issues a JWT exactly like PIN login does.

NOTE ON TESTING: this endpoint set is written against py_webauthn 2.x's
documented API and syntax-checked, but WebAuthn is inherently hard to
exercise without a real browser + authenticator + matching RP ID/origin
configuration, and I have not been able to run it end-to-end in this
sandbox (no network/browser here). Treat this as a solid first draft to
validate against a real device before relying on it.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticationCredential,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    RegistrationCredential,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import UserPublic
from app.security import create_access_token
from app.services import webauthn_service

router = APIRouter(prefix="/api/webauthn", tags=["WebAuthn"])
settings = get_settings()


class WebAuthnCredentialBody(BaseModel):
    """The JSON that `navigator.credentials.create()` /
    `navigator.credentials.get()` produces, forwarded as-is by the
    frontend. Left loosely typed here — py_webauthn parses the real
    shape from the raw JSON string.
    """

    credential: dict


class WebAuthnLoginOptionsRequest(BaseModel):
    username: str


class WebAuthnCredentialSummary(BaseModel):
    credential_id: str
    transports: list[str] = []


@router.post("/register/options")
async def registration_options(current_user: UserPublic = Depends(get_current_user)):
    """Step 1 of registering a passkey/authenticator for the already
    logged-in demo account. Existing credentials are excluded so the
    same authenticator can't be registered twice.
    """
    existing = await webauthn_service.list_credentials_for_user(current_user.user_id)
    exclude = [
        PublicKeyCredentialDescriptor(id=c["credential_id"]) for c in existing
    ]

    options = generate_registration_options(
        rp_id=settings.webauthn_rp_id,
        rp_name=settings.webauthn_rp_name,
        user_id=current_user.user_id.encode("utf-8"),
        user_name=current_user.username,
        user_display_name=current_user.name,
        exclude_credentials=exclude,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )

    await webauthn_service.store_challenge(
        user_id=current_user.user_id, challenge=options.challenge, purpose="registration"
    )

    return json.loads(options_to_json(options))


@router.post("/register/verify")
async def registration_verify(
    body: WebAuthnCredentialBody, current_user: UserPublic = Depends(get_current_user)
):
    challenge = await webauthn_service.pop_challenge(
        user_id=current_user.user_id, purpose="registration"
    )
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration challenge expired or not found — please try again.",
        )

    try:
        credential = RegistrationCredential.parse_raw(json.dumps(body.credential))
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenge,
            expected_origin=settings.webauthn_origin_list,
            expected_rp_id=settings.webauthn_rp_id,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not verify this authenticator. Please try again.",
        )

    await webauthn_service.save_credential(
        user_id=current_user.user_id,
        credential_id=verification.credential_id,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        transports=body.credential.get("response", {}).get("transports", []) or [],
    )

    return {"status": "registered"}


@router.post("/login/options")
async def login_options(body: WebAuthnLoginOptionsRequest):
    """Step 1 of logging in with a previously registered authenticator.
    Deliberately returns the same generic response whether or not the
    username exists / has credentials, so this can't be used to enumerate
    accounts.
    """
    db = get_db()
    user = await db.users.find_one({"username": body.username})
    allow = []
    user_id = None
    if user:
        user_id = user["user_id"]
        creds = await webauthn_service.list_credentials_for_user(user_id)
        allow = [
            PublicKeyCredentialDescriptor(id=c["credential_id"], transports=c.get("transports") or None)
            for c in creds
        ]

    options = generate_authentication_options(
        rp_id=settings.webauthn_rp_id,
        allow_credentials=allow or None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    if user_id:
        await webauthn_service.store_challenge(
            user_id=user_id, challenge=options.challenge, purpose="authentication"
        )
    # If the user doesn't exist, we still return well-formed (but
    # unusable) options rather than a 404, to avoid username enumeration.

    return json.loads(options_to_json(options))


@router.post("/login/verify")
async def login_verify(body: WebAuthnCredentialBody):
    """Step 2: verify the assertion and, if valid, issue a JWT exactly
    like PIN login does.
    """
    try:
        credential = AuthenticationCredential.parse_raw(json.dumps(body.credential))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed credential")

    raw_id = base64url_to_bytes(body.credential.get("rawId", body.credential.get("id", "")))
    stored = await webauthn_service.get_credential(raw_id)
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown authenticator")

    challenge = await webauthn_service.pop_challenge(
        user_id=stored["user_id"], purpose="authentication"
    )
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Login challenge expired or not found — please try again.",
        )

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=challenge,
            expected_origin=settings.webauthn_origin_list,
            expected_rp_id=settings.webauthn_rp_id,
            credential_public_key=stored["public_key"],
            credential_current_sign_count=stored["sign_count"],
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

    await webauthn_service.update_sign_count(raw_id, verification.new_sign_count)

    db = get_db()
    user = await db.users.find_one({"user_id": stored["user_id"]})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")

    token, _jti, expires_at = create_access_token(user["user_id"], user["username"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "user": UserPublic(
            user_id=user["user_id"], username=user["username"], name=user["name"], upi_id=user["upi_id"]
        ),
    }


@router.get("/credentials", response_model=list[WebAuthnCredentialSummary])
async def list_my_credentials(current_user: UserPublic = Depends(get_current_user)):
    creds = await webauthn_service.list_credentials_for_user(current_user.user_id)
    return [
        WebAuthnCredentialSummary(
            credential_id=c["credential_id"].hex(),
            transports=c.get("transports") or [],
        )
        for c in creds
    ]


@router.delete("/credentials/{credential_id_hex}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_credential(
    credential_id_hex: str, current_user: UserPublic = Depends(get_current_user)
):
    try:
        raw_id = bytes.fromhex(credential_id_hex)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credential id")
    deleted = await webauthn_service.delete_credential(
        user_id=current_user.user_id, credential_id=raw_id
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
