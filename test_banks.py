import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_list_banks():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/banks")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    codes = {b["bank"]["code"] for b in body}
    assert codes == {"BNB", "ADB"}
    for b in body:
        assert b["demo"] is True
        assert b["account_count"] >= 1
