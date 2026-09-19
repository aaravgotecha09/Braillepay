"""
Phase-3 tests: payment requests, refunds, notifications, demo reset.

Run `python seed.py` (or hit POST /api/demo/reset once these tests have
run) to restore starting balances afterwards, since this suite moves
simulated money around.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient, username: str, pin: str = "1234") -> str:
    resp = await client.post("/api/auth/login", json={"username": username, "pin": pin})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_payment_request_full_lifecycle_pay():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        requester_token = await _login(client, "rahul")
        payer_token = await _login(client, "priya")

        create = await client.post(
            "/api/payment-requests",
            headers={"Authorization": f"Bearer {requester_token}"},
            json={"payer_upi": "priya@braillepay", "amount": 77, "note": "test request"},
        )
        assert create.status_code == 200, create.text
        req = create.json()
        assert req["status"] == "PENDING"

        incoming = await client.get(
            "/api/payment-requests?direction=incoming",
            headers={"Authorization": f"Bearer {payer_token}"},
        )
        assert any(r["request_id"] == req["request_id"] for r in incoming.json())

        pay = await client.post(
            f"/api/payment-requests/{req['request_id']}/pay",
            headers={"Authorization": f"Bearer {payer_token}"},
        )
        assert pay.status_code == 200, pay.text
        assert pay.json()["status"] == "PAID"
        assert pay.json()["paid_transaction_id"]

        # Paying again must fail — already resolved.
        pay_again = await client.post(
            f"/api/payment-requests/{req['request_id']}/pay",
            headers={"Authorization": f"Bearer {payer_token}"},
        )
        assert pay_again.status_code == 409


@pytest.mark.asyncio
async def test_payment_request_decline():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        requester_token = await _login(client, "aarav")
        payer_token = await _login(client, "ananya")

        create = await client.post(
            "/api/payment-requests",
            headers={"Authorization": f"Bearer {requester_token}"},
            json={"payer_upi": "ananya@braillepay", "amount": 15},
        )
        req = create.json()

        decline = await client.post(
            f"/api/payment-requests/{req['request_id']}/decline",
            headers={"Authorization": f"Bearer {payer_token}"},
        )
        assert decline.status_code == 200
        assert decline.json()["status"] == "DECLINED"


@pytest.mark.asyncio
async def test_refund_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sender_token = await _login(client, "shivani")
        receiver_token = await _login(client, "rohan")

        send = await client.post(
            "/api/payments/send",
            headers={"Authorization": f"Bearer {sender_token}"},
            json={"receiver_upi": "rohan@braillepay", "amount": 60, "note": "to be refunded"},
        )
        assert send.status_code == 200
        tx_id = send.json()["transaction"]["transaction_id"]

        # Sender cannot refund their own outgoing payment.
        bad_refund = await client.post(
            f"/api/payments/{tx_id}/refund",
            headers={"Authorization": f"Bearer {sender_token}"},
        )
        assert bad_refund.status_code == 403

        refund = await client.post(
            f"/api/payments/{tx_id}/refund",
            headers={"Authorization": f"Bearer {receiver_token}"},
        )
        assert refund.status_code == 200, refund.text
        assert refund.json()["transaction"]["type"] == "REFUND"

        # Second refund attempt must be rejected.
        refund_again = await client.post(
            f"/api/payments/{tx_id}/refund",
            headers={"Authorization": f"Bearer {receiver_token}"},
        )
        assert refund_again.status_code == 409


@pytest.mark.asyncio
async def test_notifications_created_on_payment():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sender_token = await _login(client, "aarav")
        receiver_token = await _login(client, "shivani")

        await client.post(
            "/api/payments/send",
            headers={"Authorization": f"Bearer {sender_token}"},
            json={"receiver_upi": "shivani@braillepay", "amount": 5},
        )

        notifs = await client.get(
            "/api/notifications", headers={"Authorization": f"Bearer {receiver_token}"}
        )
        assert notifs.status_code == 200
        body = notifs.json()
        assert body["unread_count"] >= 1
        assert any(n["type"] == "PAYMENT_RECEIVED" for n in body["items"])

        first_id = body["items"][0]["notification_id"]
        mark = await client.post(
            f"/api/notifications/{first_id}/read",
            headers={"Authorization": f"Bearer {receiver_token}"},
        )
        assert mark.status_code == 204


@pytest.mark.asyncio
async def test_demo_reset_restores_balances():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reset = await client.post("/api/demo/reset")
        assert reset.status_code == 200
        body = reset.json()
        assert body["users_reset"] == 6

        token = await _login(client, "aarav")
        balance = await client.get(
            "/api/accounts/balance", headers={"Authorization": f"Bearer {token}"}
        )
        assert balance.json()["balance"] == 25000.00


@pytest.mark.asyncio
async def test_demo_stats():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/demo/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_users"] == 6
    assert body["total_banks"] == 2
