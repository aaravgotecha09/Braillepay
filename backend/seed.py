"""
BraillePay demo data seeder.

Usage:
    cd backend
    python seed.py

Running this repeatedly is safe: it upserts by deterministic demo IDs
instead of creating duplicates, and never overwrites an existing
account's balance (use POST /api/demo/reset for that). Nothing here
touches real banking infrastructure - everything is written to your own
MongoDB instance.

The actual demo data (banks, users, balances, sample transactions) lives
in app/services/seed_service.py so the CLI script and the
POST /api/demo/reset endpoint can never drift apart.
"""
import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.database import ensure_indexes
from app.services import seed_service

settings = get_settings()


async def seed():
    client = AsyncIOMotorClient(settings.mongo_url)
    db = client[settings.db_name]

    print(f"Connecting to {settings.mongo_url} / db '{settings.db_name}' ...")

    result = await seed_service.seed_all(db)
    print(f"Seeded {result['banks']} banks.")
    print(f"Seeded {result['users']} demo users, accounts and QR identities.")
    print(f"Seeded {result['sample_transactions_created']} new sample transactions "
          f"(already-present ones were left untouched).")

    await ensure_indexes()
    print("Indexes ensured.")

    print("\n=== Demo login credentials (PIN is the same for all: 1234) ===")
    for username, name, upi_id, balance, bank_id in seed_service.USERS:
        print(f"  {username:10s}  PIN: {seed_service.DEMO_PIN}   ({name}, {upi_id})")
    print("\nDone.")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
