import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient, username: str, pin: str = "1234") -> str:
    resp = await client.post("/api/auth/login", json={"username": username, "pin": pin})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_lookup_known_user():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "aarav")
        resp = await client.get(
            "/api/users/lookup?upi_id=shivani@braillepay",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["name"] == "Shivani Mehta"
    assert body["bank"]["code"] in ("BNB", "ADB")


@pytest.mark.asyncio
async def test_lookup_unknown_user():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "aarav")
        resp = await client.get(
            "/api/users/lookup?upi_id=nobody@braillepay",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404
