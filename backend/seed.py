"""
BraillePay demo data seeder.

Usage:
    cd backend
    python seed.py

Running this repeatedly is safe: it upserts by deterministic demo IDs
instead of creating duplicates. Nothing here touches real banking
infrastructure — everything is written to your own MongoDB instance.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.security import hash_pin

settings = get_settings()

# ---------------------------------------------------------------------------
# Deterministic demo data
# ---------------------------------------------------------------------------
BANKS = [
    {"bank_id": "bank_bnb", "name": "Braille National Bank", "code": "BNB", "ifsc": "BRLP000001"},
    {"bank_id": "bank_adb", "name": "Accessible Digital Bank", "code": "ADB", "ifsc": "BRLP000002"},
]

# username, full name, upi id, starting balance, bank_id
USERS = [
    ("aarav", "Aarav Gotecha", "aarav@braillepay", 25000.00, "bank_bnb"),
    ("shivani", "Shivani Mehta", "shivani@braillepay", 18500.00, "bank_bnb"),
    ("rahul", "Rahul Shah", "rahul@braillepay", 32000.00, "bank_bnb"),
    ("priya", "Priya Desai", "priya@braillepay", 21750.00, "bank_adb"),
    ("rohan", "Rohan Patel", "rohan@braillepay", 15200.00, "bank_adb"),
    ("ananya", "Ananya Kapoor", "ananya@braillepay", 28400.00, "bank_adb"),
]

DEMO_PIN = "1234"

# Sample historical transactions: (sender_username, receiver_username, amount, note, days_ago)
SAMPLE_TRANSACTIONS = [
    ("aarav", "shivani", 500.00, "Lunch split", 3),
    ("rahul", "aarav", 750.00, "Movie tickets", 2),
    ("priya", "aarav", 250.00, "Book refund", 2),
    ("aarav", "rohan", 1000.00, "Rent share", 1),
    ("ananya", "aarav", 300.00, "Coffee", 0),
]


def user_id_for(username: str) -> str:
    return f"user_{username}"


def account_id_for(username: str) -> str:
    return f"acct_{username}"


def qr_id_for(username: str) -> str:
    return f"qr_{username}"


async def seed():
    client = AsyncIOMotorClient(settings.mongo_url)
    db = client[settings.db_name]
    now = datetime.now(timezone.utc)

    print(f"Connecting to {settings.mongo_url} / db '{settings.db_name}' ...")

    # --- Banks ---------------------------------------------------------
    for bank in BANKS:
        await db.banks.update_one(
            {"bank_id": bank["bank_id"]},
            {"$set": {**bank, "demo": True}},
            upsert=True,
        )
    print(f"Seeded {len(BANKS)} banks.")

    # --- Users, accounts, QR codes --------------------------------------
    bank_seq = {"bank_bnb": 0, "bank_adb": 0}
    bank_code = {b["bank_id"]: b["code"] for b in BANKS}

    for username, name, upi_id, balance, bank_id in USERS:
        uid = user_id_for(username)

        await db.users.update_one(
            {"user_id": uid},
            {
                "$set": {
                    "user_id": uid,
                    "username": username,
                    "name": name,
                    "upi_id": upi_id,
                    "pin_hash": hash_pin(DEMO_PIN),
                    "demo": True,
                    "created_at": now,
                }
            },
            upsert=True,
        )

        bank_seq[bank_id] += 1
        account_number = f"{bank_code[bank_id]}{str(bank_seq[bank_id]).zfill(9)}"
        acct_id = account_id_for(username)

        # Preserve existing balance if the account already exists (so
        # re-running seed.py doesn't clobber an in-progress demo) — use
        # `python seed.py --reset` semantics via demo/reset endpoint instead.
        existing = await db.accounts.find_one({"account_id": acct_id})
        if not existing:
            await db.accounts.insert_one(
                {
                    "account_id": acct_id,
                    "user_id": uid,
                    "bank_id": bank_id,
                    "account_number": account_number,
                    "account_type": "SAVINGS",
                    "balance": balance,
                    "currency": "INR",
                    "status": "ACTIVE",
                    "created_at": now,
                }
            )
        else:
            print(f"  (account for {username} already exists, balance left untouched)")

        qr_payload = {
            "type": "braillepay_payment",
            "version": 1,
            "upi_id": upi_id,
            "name": name,
            "user_id": uid,
        }
        await db.qr_codes.update_one(
            {"qr_id": qr_id_for(username)},
            {
                "$set": {
                    "qr_id": qr_id_for(username),
                    "user_id": uid,
                    "upi_id": upi_id,
                    "name": name,
                    "payload": qr_payload,
                    "created_at": now,
                }
            },
            upsert=True,
        )

    print(f"Seeded {len(USERS)} demo users, accounts and QR identities.")

    # --- Sample historical transactions ---------------------------------
    existing_count = await db.transactions.count_documents({"simulated": True})
    if existing_count == 0:
        users_by_name = {u[0]: u for u in USERS}
        seq = 1
        for sender, receiver, amount, note, days_ago in SAMPLE_TRANSACTIONS:
            created_at = now - timedelta(days=days_ago)
            tx_id = f"TXN-DEMO-{seq:04d}"
            ref_id = f"BP{created_at.strftime('%Y%m%d')}{seq:04d}"
            sender_row = users_by_name[sender]
            receiver_row = users_by_name[receiver]
            await db.transactions.insert_one(
                {
                    "transaction_id": tx_id,
                    "reference_id": ref_id,
                    "sender_user_id": user_id_for(sender),
                    "receiver_user_id": user_id_for(receiver),
                    "sender_upi": sender_row[2],
                    "receiver_upi": receiver_row[2],
                    "sender_account_id": account_id_for(sender),
                    "receiver_account_id": account_id_for(receiver),
                    "sender_bank_id": sender_row[4],
                    "receiver_bank_id": receiver_row[4],
                    "amount": amount,
                    "currency": "INR",
                    "note": note,
                    "type": "PAYMENT",
                    "status": "SUCCESS",
                    "created_at": created_at,
                    "completed_at": created_at,
                    "simulated": True,
                    "description": f"{sender_row[1]} paid {receiver_row[1]}",
                    "idempotency_key": f"seed-{tx_id}",
                    "refunded": False,
                }
            )
            seq += 1
        print(f"Seeded {len(SAMPLE_TRANSACTIONS)} sample transactions.")
    else:
        print("Sample transactions already present, skipping.")

    # --- Indexes ---------------------------------------------------------
    from app.database import ensure_indexes  # local import: needs a running loop
    await ensure_indexes()

    print("\n=== Demo login credentials (PIN is the same for all: 1234) ===")
    for username, name, upi_id, balance, bank_id in USERS:
        print(f"  {username:10s}  PIN: {DEMO_PIN}   ({name}, {upi_id})")
    print("\nDone.")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
