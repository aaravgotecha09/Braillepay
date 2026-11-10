"""
Phase-1 auth tests.

Requires a MongoDB instance reachable at MONGO_URL (see .env.example) and
the demo data seeded via `python seed.py`. Run with:

    pytest tests/test_auth.py -v

More test modules (payments, QR, transactions, refunds, idempotency,
demo-reset) land in later phases alongside those features.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["simulation"] is True


@pytest.mark.asyncio
async def test_login_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login", json={"username": "aarav", "pin": "1234"}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["user"]["upi_id"] == "aarav@braillepay"


@pytest.mark.asyncio
async def test_login_wrong_pin():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login", json={"username": "aarav", "pin": "0000"}
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_then_me():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/auth/login", json={"username": "shivani", "pin": "1234"}
        )
        token = login.json()["access_token"]
        me = await client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert me.status_code == 200
    assert me.json()["username"] == "shivani"
