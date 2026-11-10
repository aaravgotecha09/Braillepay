"""
Regression tests for reference-number collisions and misleading payment errors.

Runs without a MongoDB server (in-memory stand-in plus mongomock_compat for Decimal128).
Bug covered: seeded sample transactions used BPYYYYMMDDNNNN references that the daily counter
did not know about, so the Nth same-day payment collided with a sample row and was reported
as "Payment already processed" (HTTP 409) even though nothing was processed.
"""
import asyncio
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import app.database as database
from app.config import get_settings
from app.main import app
from app.services import payment_service
from app.services import seed_service

import mongomock_compat  # noqa: F401  (test-only Decimal128 support for the stand-in)

settings = get_settings()
client = TestClient(app)


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def seeded(monkeypatch):
    mock = AsyncMongoMockClient()
    monkeypatch.setattr(database, "_client", mock)
    monkeypatch.setattr(database, "_db", None)
    d = mock[settings.db_name]
    run(database.ensure_indexes())
    run(seed_service.seed_all(d))
    return d


def _login(username="aarav"):
    r = client.post("/api/auth/login", json={"username": username, "pin": "1234"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _send(token, n, amount=5):
    return client.post(
        "/api/payments/send",
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"ref-test-{n}-{amount}"},
        json={"receiver_upi": "shivani@braillepay", "amount": amount, "note": f"test {n}"},
    )


def test_payments_after_seed_never_collide(seeded):
    token = _login()
    refs = []
    for n in range(1, 9):  # seeded sample rows sit on today's sequence numbers, so 8 payments cross them
        r = _send(token, n)
        assert r.status_code == 200, f"payment {n}: {r.status_code} {r.text[:160]}"
        refs.append(r.json()["transaction"]["reference_id"])
    assert len(set(refs)) == len(refs)


def test_allocator_skips_a_reference_that_already_exists(seeded):
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    # Force the counter to point at a reference that is already stored.
    run(seeded.counters.update_one({"name": f"reference:{today}"}, {"$set": {"value": 0}}, upsert=True))
    run(seeded.transactions.insert_one({
        "transaction_id": "TXN-PREEXISTING", "reference_id": f"BP{today}0001", "type": "PAYMENT",
        "status": "SUCCESS", "simulated": True,
    }))
    ref = run(payment_service._next_reference_id(seeded))
    assert ref != f"BP{today}0001"


def test_row_insert_failure_is_not_reported_as_duplicate_and_moves_no_money(seeded, monkeypatch):
    token = _login()
    real_db = seeded

    class _FailingInserts:
        def __init__(self, coll):
            self._coll = coll

        async def insert_one(self, *a, **k):
            raise RuntimeError("simulated write failure")

        def __getattr__(self, name):
            return getattr(self._coll, name)

    class _Wrapped:
        def __getattr__(self, name):
            coll = getattr(real_db, name)
            return _FailingInserts(coll) if name == "transactions" else coll

    monkeypatch.setattr(payment_service, "get_db", lambda: _Wrapped())
    before = run(real_db.accounts.find_one({"account_id": "acct_aarav"}))["balance"]
    r = _send(token, 99, amount=7)
    monkeypatch.undo()
    after = run(real_db.accounts.find_one({"account_id": "acct_aarav"}))["balance"]

    assert r.status_code == 503, r.text
    assert "no money was moved" in r.json()["detail"].lower()
    assert "already processed" not in r.text.lower()
    assert before == after
