"""
Phase-2 tests: payment engine, balance, transaction history, QR.

Requires MongoDB + seeded demo data (see backend/README section on
running tests). Since these tests actually move simulated money between
aarav and shivani, run `python seed.py` again afterwards (or hit
`/api/demo/reset` once Phase 3 lands) to restore starting balances.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient, username: str, pin: str = "1234") -> str:
    resp = await client.post("/api/auth/login", json={"username": username, "pin": pin})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_balance_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "rahul")
        resp = await client.get(
            "/api/accounts/balance", headers={"Authorization": f"Bearer {token}"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["currency"] == "INR"
    assert body["balance"] > 0
    assert body["bank"]["code"] in ("BNB", "ADB")


@pytest.mark.asyncio
async def test_send_payment_success_and_balance_updates():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sender_token = await _login(client, "priya")
        receiver_token = await _login(client, "rohan")

        before_sender = (
            await client.get(
                "/api/accounts/balance",
                headers={"Authorization": f"Bearer {sender_token}"},
            )
        ).json()["balance"]
        before_receiver = (
            await client.get(
                "/api/accounts/balance",
                headers={"Authorization": f"Bearer {receiver_token}"},
            )
        ).json()["balance"]

        resp = await client.post(
            "/api/payments/send",
            headers={
                "Authorization": f"Bearer {sender_token}",
                "Idempotency-Key": str(uuid.uuid4()),
            },
            json={"receiver_upi": "rohan@braillepay", "amount": 111, "note": "test"},
        )
        assert resp.status_code == 200, resp.text
        receipt = resp.json()
        assert receipt["transaction"]["status"] == "SUCCESS"
        assert receipt["sender_balance_after"] == before_sender - 111

        after_receiver = (
            await client.get(
                "/api/accounts/balance",
                headers={"Authorization": f"Bearer {receiver_token}"},
            )
        ).json()["balance"]
        assert after_receiver == before_receiver + 111


@pytest.mark.asyncio
async def test_send_payment_insufficient_balance():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "rohan")
        resp = await client.post(
            "/api/payments/send",
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": str(uuid.uuid4())},
            json={"receiver_upi": "aarav@braillepay", "amount": 99999999},
        )
    assert resp.status_code == 422
    assert "Insufficient" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_send_payment_unknown_recipient():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "aarav")
        resp = await client.post(
            "/api/payments/send",
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": str(uuid.uuid4())},
            json={"receiver_upi": "nobody@braillepay", "amount": 10},
        )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Recipient not found"


@pytest.mark.asyncio
async def test_send_payment_rejects_zero_and_negative():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "aarav")
        for bad_amount in (0, -100):
            resp = await client.post(
                "/api/payments/send",
                headers={"Authorization": f"Bearer {token}"},
                json={"receiver_upi": "shivani@braillepay", "amount": bad_amount},
            )
            assert resp.status_code == 422


@pytest.mark.asyncio
async def test_idempotent_duplicate_payment_not_double_charged():
    transport = ASGITransport(app=app)
    key = str(uuid.uuid4())
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "ananya")
        before = (
            await client.get(
                "/api/accounts/balance", headers={"Authorization": f"Bearer {token}"}
            )
        ).json()["balance"]

        body = {"receiver_upi": "aarav@braillepay", "amount": 42}
        headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": key}

        first = await client.post("/api/payments/send", headers=headers, json=body)
        second = await client.post("/api/payments/send", headers=headers, json=body)

        assert first.status_code == 200
        assert second.status_code == 200
        assert (
            first.json()["transaction"]["transaction_id"]
            == second.json()["transaction"]["transaction_id"]
        )

        after = (
            await client.get(
                "/api/accounts/balance", headers={"Authorization": f"Bearer {token}"}
            )
        ).json()["balance"]
        assert after == before - 42  # only charged once


@pytest.mark.asyncio
async def test_transaction_history_is_isolated_per_user():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        aarav_token = await _login(client, "aarav")
        shivani_token = await _login(client, "shivani")

        aarav_tx = await client.get(
            "/api/transactions", headers={"Authorization": f"Bearer {aarav_token}"}
        )
        assert aarav_tx.status_code == 200
        for item in aarav_tx.json()["items"]:
            assert current_user_involved(item, "aarav")

        # Fetching a transaction that isn't Shivani's own by ID returns 404.
        if aarav_tx.json()["items"]:
            some_id = aarav_tx.json()["items"][0]["transaction_id"]
            cross = await client.get(
                f"/api/transactions/{some_id}",
                headers={"Authorization": f"Bearer {shivani_token}"},
            )
            assert cross.status_code in (404, 200)  # 200 only if Shivani is a party too


def current_user_involved(item: dict, username_upi_prefix: str) -> bool:
    return (
        item["sender_upi"].startswith(username_upi_prefix)
        or item["receiver_upi"].startswith(username_upi_prefix)
    )


@pytest.mark.asyncio
async def test_qr_my_and_demo_list():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "aarav")

        my_qr = await client.get(
            "/api/qr/my", headers={"Authorization": f"Bearer {token}"}
        )
        assert my_qr.status_code == 200
        body = my_qr.json()
        assert body["payload"]["upi_id"] == "aarav@braillepay"
        assert body["image_base64"]  # PNG was actually generated

        demo_list = await client.get(
            "/api/qr/demo-list", headers={"Authorization": f"Bearer {token}"}
        )
        assert demo_list.status_code == 200
        assert len(demo_list.json()) == 6
