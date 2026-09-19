"""
Motor (async MongoDB) client + database handle, and index creation.

This is the single source of truth for DB access. All money-related state
(users, accounts, transactions, ...) lives here — never in the frontend.
"""
import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

logger = logging.getLogger("braillepay.db")

settings = get_settings()

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_url)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[settings.db_name]
    return _db


async def ensure_indexes() -> None:
    """Create indexes needed for correctness and lookup performance.

    Safe to call on every startup — create_index is idempotent.
    """
    db = get_db()

    await db.users.create_index("username", unique=True)
    await db.users.create_index("upi_id", unique=True)

    await db.banks.create_index("code", unique=True)

    await db.accounts.create_index("user_id")
    await db.accounts.create_index("account_number", unique=True)

    await db.qr_codes.create_index("qr_id", unique=True)
    await db.qr_codes.create_index("user_id")
    await db.qr_codes.create_index("upi_id")

    await db.transactions.create_index("transaction_id", unique=True)
    await db.transactions.create_index("reference_id", unique=True)
    await db.transactions.create_index("sender_user_id")
    await db.transactions.create_index("receiver_user_id")
    await db.transactions.create_index("created_at")
    await db.transactions.create_index(
        "idempotency_key",
        unique=True,
        partialFilterExpression={"idempotency_key": {"$exists": True}},
    )

    await db.counters.create_index("name", unique=True)

    await db.notifications.create_index("notification_id", unique=True)
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])

    await db.payment_requests.create_index("request_id", unique=True)
    await db.payment_requests.create_index("payer_user_id")
    await db.payment_requests.create_index("requester_user_id")

    await db.webauthn_challenges.create_index("user_id")
    await db.webauthn_challenges.create_index([("user_id", 1), ("purpose", 1)], unique=True)
    await db.webauthn_challenges.create_index(
        "expires_at", expireAfterSeconds=0
    )

    await db.webauthn_credentials.create_index("credential_id", unique=True)
    await db.webauthn_credentials.create_index("user_id")

    await db.revoked_tokens.create_index("jti", unique=True)
    await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)

    await db.login_attempts.create_index("username")

    logger.info("MongoDB indexes ensured.")


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
