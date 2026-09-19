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
import certifi

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.database import ensure_indexes
from app.services import seed_service

settings = get_settings()


async def seed():
    # Pass certifi.where() to allow secure SSL connections to MongoDB Atlas
    client = AsyncIOMotorClient(settings.mongo_url, tlsCAFile=certifi.where())
    db = client[settings.db_name]

    print(f"Connecting to {settings.mongo_url} / db '{settings.db_name}' ...")

    await ensure_indexes()
    result = await seed_service.seed_all(db)
    print(f"Seeded successfully: {result}")


if __name__ == "__main__":
    asyncio.run(seed())
