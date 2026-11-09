"""
These tests check that the WebAuthn endpoints are wired up, return
well-formed options, and don't leak account existence. They do NOT
simulate a real authenticator (that requires a browser or a WebAuthn
virtual-authenticator test harness), so they don't cover the actual
register/verify or login/verify cryptographic path end-to-end. See the
README for the honest status of this feature.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient, username: str, pin: str = "1234") -> str:
    resp = await client.post("/api/auth/login", json={"username": username, "pin": pin})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_registration_options_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/webauthn/register/options")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_registration_options_shape():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, "aarav")
        resp = await client.post(
            "/api/webauthn/register/options", headers={"Authorization": f"Bearer {token}"}
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "challenge" in body
    assert body["rp"]["id"] is not None
    assert body["user"]["name"] == "aarav"


@pytest.mark.asyncio
async def test_login_options_does_not_leak_user_existence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        real = await client.post("/api/webauthn/login/options", json={"username": "aarav"})
        fake = await client.post("/api/webauthn/login/options", json={"username": "definitely-not-a-user"})
    assert real.status_code == 200
    assert fake.status_code == 200
    # Both return a well-formed challenge regardless of whether the account exists.
    assert "challenge" in real.json()
    assert "challenge" in fake.json()


@pytest.mark.asyncio
async def test_login_verify_rejects_unknown_credential():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/webauthn/login/verify",
            json={"credential": {"id": "bm90LWEtcmVhbC1jcmVk", "rawId": "bm90LWEtcmVhbC1jcmVk", "type": "public-key", "response": {}}},
        )
    assert resp.status_code in (400, 401)
