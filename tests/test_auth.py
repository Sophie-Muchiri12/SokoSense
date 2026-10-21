"""Auth tests — hashing, JWTs, phone normalisation, PIN, API guards.

DB-backed flows (register/login against Postgres) are covered by the
local-Postgres smoke test in the auth PR; these tests need no database.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from auth.security import create_token, decode_token, hash_password, verify_password
from db.users import normalize_phone
from main import app

client = TestClient(app)


def test_password_hash_roundtrip():
    stored = hash_password("soko1234")
    assert stored.startswith("pbkdf2$")
    assert verify_password("soko1234", stored)
    assert not verify_password("wrong", stored)


def test_jwt_roundtrip_and_tamper():
    token = create_token("42", "farmer", phone="+254712345678")
    payload = decode_token(token)
    assert payload["sub"] == "42" and payload["role"] == "farmer"
    assert decode_token(token + "x") is None
    assert decode_token("not-a-token") is None


@pytest.mark.parametrize(
    "raw", ["0712 345 678", "+254712345678", "254712345678", "712345678"]
)
def test_normalize_phone(raw):
    # 712345678 (9 digits starting 7) is also accepted by the normaliser.
    assert normalize_phone(raw) == "+254712345678"


def test_normalize_phone_rejects_garbage():
    with pytest.raises(ValueError):
        normalize_phone("12345")


def test_protected_endpoints_require_auth():
    assert client.get("/api/market-prices?crop=maize").status_code == 401
    assert client.post("/api/loan", json={"monthly_rate_percent": 10}).status_code == 401
    assert client.get("/api/logs").status_code == 401
    assert client.get("/api/admin/market-refresh").status_code == 401
    # Public endpoints stay public: health + Africa's Talking webhooks.
    assert client.get("/health").status_code == 200


def test_admin_pin_login(monkeypatch):
    monkeypatch.setenv("ADMIN_PIN", "1234567")
    bad = client.post("/api/auth/admin-login", json={"pin": "0000000"})
    assert bad.status_code == 401

    ok = client.post("/api/auth/admin-login", json={"pin": "1234567"})
    assert ok.status_code == 200
    token = ok.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/logs", headers=headers).status_code == 200
    assert client.get("/api/admin/market-refresh", headers=headers).status_code == 200
    # …but an admin token is not a user account for /me-as-farmer semantics:
    me = client.get("/api/auth/me", headers=headers)
    assert me.json()["role"] == "admin"


def test_farmer_token_cannot_reach_admin(monkeypatch):
    token = create_token("7", "farmer")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/logs", headers=headers).status_code == 403
    assert client.post("/api/admin/market-refresh", headers=headers).status_code == 403


def test_register_without_database_is_503(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    r = client.post(
        "/api/auth/register",
        json={"name": "Test User", "phone": "0712345678", "password": "soko1234", "role": "farmer"},
    )
    assert r.status_code == 503
    assert "DATABASE_URL" in r.json()["detail"]
