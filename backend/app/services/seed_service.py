"""
Single source of truth for BraillePay's demo data (2 banks, 6 users,
starting balances, sample transactions) plus the seed / reset routines
that both `seed.py` (CLI) and `/api/demo/reset` (API) call into, so the
numbers never drift between the two.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from bson.decimal128 import Decimal128
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.security import hash_pin
from app.services import notification_service

BANKS = [
    {"bank_id": "bank_bnb", "name": "Braille National Bank", "code": "BNB", "ifsc": "BRLP000001"},
    {"bank_id": "bank_adb", "name": "Accessible Digital Bank", "code": "ADB", "ifsc": "BRLP000002"},
]

# username, full name, pin, upi id, starting balance, bank_id
USERS = [
    ("aarav", "Aarav Gotecha", "0109", "aarav@braillepay", 25000.00, "bank_bnb"),
    ("anushka", "Anushka Pawar", "1611", "anushka@braillepay", 25000.00, "bank_adb"),
    ("shreya", "Shreya Bhuia", "0604", "shreya@braillepay", 25000.00, "bank_bnb"),
    ("diva", "Diva Bafna", "1009", "diva@braillepay", 25000.00, "bank_adb"),
    ("archi", "Archi Salaot", "2601", "archi@braillepay", 25000.00, "bank_bnb"),
    ("nitin", "Nitin Gupta", "2010", "nitin@braillepay", 25000.00, "bank_adb"),
]

# sender_username, receiver_username, amount, note, days_ago
SAMPLE_TRANSACTIONS = [
    ("aarav", "anushka", 500.00, "Lunch split", 3),
    ("shreya", "aarav", 750.00, "Movie tickets", 2),
    ("diva", "aarav", 250.00, "Book refund", 2),
    ("aarav", "archi", 1000.00, "Rent share", 1),
    ("nitin", "aarav", 300.00, "Coffee", 0),
]


def d128(amount) -> Decimal128:
    return Decimal128(Decimal(str(amount)))


def user_id_for(username: str) -> str:
    return f"user_{username}"


def account_id_for(username: str) -> str:
    return f"acct_{username}"


def qr_id_for(username: str) -> str:
    return f"qr_{username}"


async def seed_banks(db: AsyncIOMotorDatabase) -> None:
    for bank in BANKS:
        await db.banks.update_one(
            {"bank_id": bank["bank_id"]}, {"$set": {**bank, "demo": True}}, upsert=True
        )


async def seed_users_accounts_qr(db: AsyncIOMotorDatabase, *, reset_balances: bool = False) -> None:
    now = datetime.now(timezone.utc)
    bank_seq = {"bank_bnb": 0, "bank_adb": 0}
    bank_code = {b["bank_id"]: b["code"] for b in BANKS}

    for username, name, pin, upi_id, balance, bank_id in USERS:
        uid = user_id_for(username)

        await db.users.update_one(
            {"user_id": uid},
            {
                "$set": {
                    "user_id": uid,
                    "username": username,
                    "name": name,
                    "upi_id": upi_id,
                    "pin_hash": hash_pin(pin),
                    "demo": True,
                    "created_at": now,
                }
            },
            upsert=True,
        )

        bank_seq[bank_id] += 1
        account_number = f"{bank_code[bank_id]}{str(bank_seq[bank_id]).zfill(9)}"
        acct_id = account_id_for(username)

        existing = await db.accounts.find_one({"account_id": acct_id})
        if not existing:
            await db.accounts.insert_one(
                {
                    "account_id": acct_id,
                    "user_id": uid,
                    "bank_id": bank_id,
                    "account_number": account_number,
                    "account_type": "SAVINGS",
                    "balance": d128(balance),
                    "currency": "INR",
                    "status": "ACTIVE",
                    "created_at": now,
                }
            )
        elif reset_balances:
            await db.accounts.update_one(
                {"account_id": acct_id}, {"$set": {"balance": d128(balance)}}
            )

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


async def seed_sample_transactions(db: AsyncIOMotorDatabase, *, with_notifications: bool = False) -> int:
    now = datetime.now(timezone.utc)
    users_by_name = {u[0]: u for u in USERS}
    seq = 1
    created = 0
    for sender, receiver, amount, note, days_ago in SAMPLE_TRANSACTIONS:
        created_at = now - timedelta(days=days_ago)
        tx_id = f"TXN-DEMO-{seq:04d}"
        ref_id = f"BP{created_at.strftime('%Y%m%d')}{seq:04d}"
        sender_row = users_by_name[sender]
        receiver_row = users_by_name[receiver]

        existing = await db.transactions.find_one({"transaction_id": tx_id})
        if not existing:
            await db.transactions.insert_one(
                {
                    "transaction_id": tx_id,
                    "reference_id": ref_id,
                    "sender_user_id": user_id_for(sender),
                    "receiver_user_id": user_id_for(receiver),
                    "sender_upi": sender_row[3],
                    "receiver_upi": receiver_row[3],
                    "sender_account_id": account_id_for(sender),
                    "receiver_account_id": account_id_for(receiver),
                    "sender_bank_id": sender_row[5],
                    "receiver_bank_id": receiver_row[5],
                    "amount": d128(amount),
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
            created += 1
            if with_notifications:
                await notification_service.create_notification(
                    user_id=user_id_for(receiver),
                    type="PAYMENT_RECEIVED",
                    title="Money received",
                    message=f"You received ₹{amount:,.2f} from {sender_row[1]}.",
                    data={"transaction_id": tx_id, "reference_id": ref_id},
                )
        seq += 1
    return created


async def seed_all(db: AsyncIOMotorDatabase) -> dict:
    """Used by seed.py. Idempotent — safe to run repeatedly."""
    await seed_banks(db)
    await seed_users_accounts_qr(db, reset_balances=False)
    created = await seed_sample_transactions(db, with_notifications=True)
    return {"banks": len(BANKS), "users": len(USERS), "sample_transactions_created": created}


async def reset_demo(db: AsyncIOMotorDatabase) -> dict:
    """Used by POST /api/demo/reset. Wipes demo-generated transactions,
    payment requests and notifications, restores every account to its
    seeded starting balance, then recreates the sample data so the app
    doesn't look empty.
    """
    await seed_banks(db)
    await seed_users_accounts_qr(db, reset_balances=True)

    await db.transactions.delete_many({"simulated": True})
    await db.payment_requests.delete_many({})
    await db.notifications.delete_many({})

    created = await seed_sample_transactions(db, with_notifications=True)

    return {
        "message": "Demo data has been reset to its starting state.",
        "users_reset": len(USERS),
        "transactions_recreated": created,
    }
