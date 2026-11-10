"""
Tests for the security fixes and the Razorpay test-mode integration.

These run WITHOUT a MongoDB server: the app's database handle is swapped for an in-memory
mongomock-motor client. They exercise the real FastAPI routes over HTTP (TestClient).
They do NOT replace the existing integration tests, which need a live MongoDB (see docs/TESTING.md).
"""
import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

import pytest
from bson.decimal128 import Decimal128
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import app.database as database
from app.config import get_settings
from app.main import app
from app.security import hash_pin
from app.services import razorpay_service as rzp

settings = get_settings()
client = TestClient(app)


def run(coro):
    """mongomock-motor exposes async methods; tests are synchronous, so run each call to completion."""
    return asyncio.run(coro)
  # no `with` block: the startup hook (index creation) is not needed here


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def db(monkeypatch):
    mock = AsyncMongoMockClient()
    monkeypatch.setattr(database, "_client", mock)
    monkeypatch.setattr(database, "_db", None)
    d = mock[settings.db_name]
    now = datetime.now(timezone.utc)

    async def seed():
        await d.banks.insert_one({"bank_id": "b1", "name": "Test Bank", "code": "TB", "ifsc": "TEST0000001"})
        for uid, username, upi in [("u-alice", "alice", "alice@test"), ("u-bob", "bob", "bob@test"), ("u-carol", "carol", "carol@test")]:
            await d.users.insert_one({
                "user_id": uid, "username": username, "name": username.title(), "upi_id": upi,
                "pin_hash": hash_pin("1234"), "demo": True,
            })
            await d.accounts.insert_one({
                "account_id": f"acc-{uid}", "account_number": f"NO-{uid}", "user_id": uid, "bank_id": "b1",
                "balance": Decimal128("1000.00"), "created_at": now,
            })

    run(seed())
    # Same unique indexes the app creates at startup (needed for duplicate-event detection).
    run(database.ensure_indexes())
    return d


def login(username, pin="1234"):
    return client.post("/api/auth/login", json={"username": username, "pin": pin})


def auth_header(username):
    return {"Authorization": "Bearer " + login(username).json()["access_token"]}


# ---------------------------------------------------------------------------
# 1. Login lockout (was defined but never enforced)
# ---------------------------------------------------------------------------
def test_login_locks_account_after_repeated_wrong_pins(db):
    for _ in range(settings.login_max_attempts):
        assert login("alice", "0000").status_code == 401
    # Now even the CORRECT PIN is refused while the lock is active.
    resp = login("alice", "1234")
    assert resp.status_code == 423
    assert "temporarily locked" in resp.json()["detail"]


def test_successful_login_resets_the_failure_counter(db):
    for _ in range(settings.login_max_attempts - 1):
        assert login("bob", "0000").status_code == 401
    assert login("bob", "1234").status_code == 200       # resets the counter
    for _ in range(settings.login_max_attempts - 1):
        assert login("bob", "0000").status_code == 401   # still below the limit: 401, not 423
    assert login("bob", "1234").status_code == 200


def test_lockout_expires(db):
    for _ in range(settings.login_max_attempts):
        login("carol", "0000")
    assert login("carol", "1234").status_code == 423
    run(db.login_attempts.update_one(
        {"username": "carol"},
        {"$set": {"locked_until": datetime.now(timezone.utc) - timedelta(minutes=1)}},
    ))
    assert login("carol", "1234").status_code == 200


def test_unknown_username_gets_the_same_401_as_a_wrong_pin(db):
    unknown = login("nobody", "1234")
    wrong = login("alice", "0000")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


# ---------------------------------------------------------------------------
# 2. /api/demo/stats: authentication required; recent transactions limited to the caller
# ---------------------------------------------------------------------------
def _txn(db, tx_id, sender, receiver, amount):
    now = datetime.now(timezone.utc)
    run(db.transactions.insert_one({
        "transaction_id": tx_id, "reference_id": "REF" + tx_id, "type": "PAYMENT", "status": "SUCCESS",
        "sender_user_id": sender, "receiver_user_id": receiver,
        "sender_upi": sender.replace("u-", "") + "@test", "receiver_upi": receiver.replace("u-", "") + "@test",
        "sender_account_id": "acc-" + sender, "receiver_account_id": "acc-" + receiver,
        "sender_bank_id": "b1", "receiver_bank_id": "b1", "amount": Decimal128(amount),
        "currency": "INR", "created_at": now, "simulated": True,
        "description": "DEMO payment", "refunded": False,
    }))


def test_demo_stats_requires_authentication(db):
    assert client.get("/api/demo/stats").status_code == 401


def test_demo_stats_recent_list_only_contains_the_callers_transactions(db):
    _txn(db, "T-AB", "u-alice", "u-bob", "10.00")
    _txn(db, "T-BC", "u-bob", "u-carol", "20.00")
    resp = client.get("/api/demo/stats", headers=auth_header("alice"))
    assert resp.status_code == 200
    ids = [t["transaction_id"] for t in resp.json()["recent_transactions"]]
    assert ids == ["T-AB"], ids   # Carol-to-Bob is not visible to Alice


# ---------------------------------------------------------------------------
# 3. Razorpay: signatures and mode guard (pure functions)
# ---------------------------------------------------------------------------
def test_payment_signature_matches_documented_hmac_construction():
    secret, order, pay = "key_secret_example", "order_ABC", "pay_XYZ"
    sig = hmac.new(secret.encode(), f"{order}|{pay}".encode(), hashlib.sha256).hexdigest()
    assert rzp.verify_payment_signature(order, pay, sig, secret) is True
    assert rzp.verify_payment_signature(order, "pay_OTHER", sig, secret) is False
    assert rzp.verify_payment_signature(order, pay, sig, "wrong_secret") is False
    assert rzp.verify_payment_signature(order, pay, "", secret) is False
    assert rzp.verify_payment_signature(order, pay, sig, "") is False


def test_webhook_signature_is_over_the_raw_body():
    whsec = "whsec_example"
    body = b'{"event":"payment.captured"}'
    sig = hmac.new(whsec.encode(), body, hashlib.sha256).hexdigest()
    assert rzp.verify_webhook_signature(body, sig, whsec) is True
    assert rzp.verify_webhook_signature(body + b" ", sig, whsec) is False   # any byte change fails
    assert rzp.verify_webhook_signature(body, None, whsec) is False
    assert rzp.verify_webhook_signature(body, sig, "") is False


class _S:
    def __init__(self, mode, key, approved=False):
        self.razorpay_mode, self.razorpay_key_id, self.razorpay_live_approved = mode, key, approved


def test_mode_guard_fails_closed():
    rzp.check_mode(_S("test", "rzp_test_abc"))                       # fine
    with pytest.raises(rzp.RazorpayConfigError):
        rzp.check_mode(_S("test", "rzp_live_abc"))                   # live key in test mode
    with pytest.raises(rzp.RazorpayConfigError):
        rzp.check_mode(_S("live", "rzp_live_abc", approved=False))   # live without approval
    with pytest.raises(rzp.RazorpayConfigError):
        rzp.check_mode(_S("live", "rzp_test_abc", approved=True))    # test key in live mode
    rzp.check_mode(_S("live", "rzp_live_abc", approved=True))        # only with explicit approval
    with pytest.raises(rzp.RazorpayConfigError):
        rzp.check_mode(_S("staging", "rzp_test_abc"))                # unknown mode


# ---------------------------------------------------------------------------
# 4. Razorpay HTTP flow (Razorpay's API is faked; the signature and state logic is real)
# ---------------------------------------------------------------------------
@pytest.fixture
def razorpay_on(monkeypatch):
    monkeypatch.setattr(settings, "razorpay_enabled", True)
    monkeypatch.setattr(settings, "razorpay_mode", "test")
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_test_publishable")
    monkeypatch.setattr(settings, "razorpay_key_secret", "secret_test_value")
    monkeypatch.setattr(settings, "razorpay_webhook_secret", "whsec_test_value")
    created = []

    async def fake_create_order(*, settings, amount_paise, currency, receipt, notes):
        created.append({"amount_paise": amount_paise, "currency": currency, "receipt": receipt})
        return {"id": f"order_FAKE{len(created):03d}", "amount": amount_paise, "currency": currency}

    monkeypatch.setattr(rzp, "create_order", fake_create_order)
    return created


def _create(username, amount):
    return client.post("/api/razorpay/orders", json={"amount": amount}, headers=auth_header(username))


def test_razorpay_is_off_by_default(db, monkeypatch):
    monkeypatch.setattr(settings, "razorpay_enabled", False)
    resp = _create("alice", 10)
    assert resp.status_code == 503
    assert "No payment was taken" in resp.json()["detail"]


def test_create_order_validates_amount_and_hides_the_secret(db, razorpay_on):
    ok = _create("alice", 250.5)
    assert ok.status_code == 201, ok.text
    body = ok.json()
    assert body["amount"] == 250.5 and body["amount_paise"] == 25050
    assert body["status"] == "CREATED" and body["mode"] == "test"
    assert body["key_id"] == "rzp_test_publishable"
    assert "secret" not in ok.text.lower()
    assert razorpay_on[-1]["currency"] == "INR"
    for bad in [0, -5, "10.123", "abc"]:
        assert _create("alice", bad).status_code == 422, bad


def test_create_order_requires_login(db, razorpay_on):
    assert client.post("/api/razorpay/orders", json={"amount": 10}).status_code == 401


def test_full_flow_callback_alone_is_not_final_webhook_makes_it_final(db, razorpay_on):
    order = _create("alice", 100).json()
    rz_order = order["razorpay_order_id"]
    pay = "pay_TEST_1"
    sig = hmac.new(b"secret_test_value", f"{rz_order}|{pay}".encode(), hashlib.sha256).hexdigest()

    # forged signature: rejected, order untouched
    bad = client.post("/api/razorpay/verify", headers=auth_header("alice"),
                      json={"razorpay_order_id": rz_order, "razorpay_payment_id": pay, "razorpay_signature": "0" * 64})
    assert bad.status_code == 400
    assert run(db.payment_orders.find_one({"razorpay_order_id": rz_order}))["status"] == "CREATED"

    # genuine browser callback: verified, but still NOT final
    good = client.post("/api/razorpay/verify", headers=auth_header("alice"),
                       json={"razorpay_order_id": rz_order, "razorpay_payment_id": pay, "razorpay_signature": sig})
    assert good.status_code == 200
    assert good.json()["status"] == "VERIFIED_AWAITING_WEBHOOK"

    # webhook: the authoritative confirmation
    event = {"event": "payment.captured", "payload": {"payment": {"entity": {
        "id": pay, "order_id": rz_order, "amount": 10000, "status": "captured"}}}}
    raw = json.dumps(event).encode()
    wsig = hmac.new(b"whsec_test_value", raw, hashlib.sha256).hexdigest()
    hook = client.post("/api/razorpay/webhook", content=raw,
                       headers={"X-Razorpay-Signature": wsig, "X-Razorpay-Event-Id": "evt_1",
                                "Content-Type": "application/json"})
    assert hook.status_code == 200 and hook.json()["status"] == "captured"
    final = client.get(f"/api/razorpay/orders/{order['order_id']}", headers=auth_header("alice")).json()
    assert final["status"] == "CAPTURED"

    # the demo ledger was never touched by the merchant flow
    assert float(run(db.accounts.find_one({"user_id": "u-alice"}))["balance"].to_decimal()) == 1000.00


def test_webhook_rejects_bad_signature_and_replays(db, razorpay_on):
    raw = json.dumps({"event": "payment.failed", "payload": {"payment": {"entity": {"order_id": "order_X"}}}}).encode()
    bad = client.post("/api/razorpay/webhook", content=raw,
                      headers={"X-Razorpay-Signature": "f" * 64, "X-Razorpay-Event-Id": "evt_bad"})
    assert bad.status_code == 400

    wsig = hmac.new(b"whsec_test_value", raw, hashlib.sha256).hexdigest()
    headers = {"X-Razorpay-Signature": wsig, "X-Razorpay-Event-Id": "evt_replay"}
    assert client.post("/api/razorpay/webhook", content=raw, headers=headers).status_code == 200
    again = client.post("/api/razorpay/webhook", content=raw, headers=headers)
    assert again.json()["status"] == "duplicate"


def test_captured_amount_mismatch_is_flagged_not_accepted(db, razorpay_on):
    order = _create("bob", 50).json()
    event = {"event": "payment.captured", "payload": {"payment": {"entity": {
        "id": "pay_MISMATCH", "order_id": order["razorpay_order_id"], "amount": 4900}}}}
    raw = json.dumps(event).encode()
    wsig = hmac.new(b"whsec_test_value", raw, hashlib.sha256).hexdigest()
    resp = client.post("/api/razorpay/webhook", content=raw,
                       headers={"X-Razorpay-Signature": wsig, "X-Razorpay-Event-Id": "evt_mismatch"})
    assert resp.json()["status"] == "amount_mismatch"
    assert client.get(f"/api/razorpay/orders/{order['order_id']}", headers=auth_header("bob")).json()["status"] == "AMOUNT_MISMATCH"


def test_another_user_cannot_read_or_verify_someone_elses_order(db, razorpay_on):
    order = _create("alice", 30).json()
    assert client.get(f"/api/razorpay/orders/{order['order_id']}", headers=auth_header("bob")).status_code == 404
    sig = hmac.new(b"secret_test_value", f"{order['razorpay_order_id']}|pay_X".encode(), hashlib.sha256).hexdigest()
    resp = client.post("/api/razorpay/verify", headers=auth_header("bob"),
                       json={"razorpay_order_id": order["razorpay_order_id"], "razorpay_payment_id": "pay_X", "razorpay_signature": sig})
    assert resp.status_code == 404
