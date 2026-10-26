"""Regression tests for the SMS/USSD fixes (loan parsing, follow-up SMS, async send)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import webhook


@pytest.fixture()
def client(monkeypatch):
    sent = []

    class FakeSMS:
        def send(self, message, recipients):
            sent.append((message, recipients))
            return {"ok": True}

    monkeypatch.setattr(webhook, "sms_client", FakeSMS())
    app = FastAPI()
    app.include_router(webhook.router)
    c = TestClient(app)
    c.sent = sent
    return c


def ussd(client, text, phone="%2B254700000099"):
    return client.post(
        "/ussd",
        content=f"sessionId=s&serviceCode=*384*543%23&phoneNumber={phone}&text={text}",
        headers={"content-type": "application/x-www-form-urlencoded"},
    ).text


# --- loan parsing -----------------------------------------------------------

@pytest.mark.parametrize("text,rate", [
    ("LOAN 5", 5.0),
    ("loan 2.5", 2.5),
    ("MKOPO 8", 8.0),
    ("I want to borrow 20000 at 10%", 10.0),
    ("LOAN 20000 12 MONTHS 5%", 5.0),
    ("LOAN 20000 5", 5.0),
])
def test_loan_rate_is_extracted(text, rate):
    assert webhook.parse_sms(text) == {"intent": "loan", "monthly_rate_percent": rate}


@pytest.mark.parametrize("text", ["LOAN 35000 BEANS 6 MONTHS", "LOAN 35000", "LOAN 50K", "LOAN"])
def test_loan_without_rate_asks_for_one(text):
    assert webhook.parse_sms(text) == {"intent": "loan_missing_rate"}
    reply = webhook.route_sms(text)
    assert "LOAN 5" in reply and "e+" not in reply


def test_swahili_loan_without_rate_asks_in_swahili():
    assert "MKOPO 5" in webhook.route_sms("MKOPO 35000 MIEZI 6")


# --- USSD loan follow-up ----------------------------------------------------

def test_valid_band_sends_one_follow_up_sms(client):
    body = ussd(client, "1*3*2")
    assert body.startswith("END ")
    assert len(client.sent) == 1
    message, recipients = client.sent[0]
    assert recipients == ["+254700000099"]
    assert "BETTER OPTIONS" in message


def test_invalid_band_sends_no_sms(client):
    body = ussd(client, "1*3*9")
    assert body.startswith("END ")
    assert client.sent == []


def test_swahili_session_gets_swahili_follow_up(client):
    ussd(client, "2*3*1")
    assert len(client.sent) == 1
    message = client.sent[0][0]
    assert "USICHUKUE MKOPO" in message and "Jaribu:" in message
    assert len(message) <= 320


def test_no_sms_client_does_not_break_ussd(monkeypatch, client):
    monkeypatch.setattr(webhook, "sms_client", None)
    assert ussd(client, "1*3*2").startswith("END ")


def test_sms_failure_does_not_break_ussd(monkeypatch, client):
    class Boom:
        def send(self, *a, **k):
            raise RuntimeError("AT down")

    monkeypatch.setattr(webhook, "sms_client", Boom())
    assert ussd(client, "1*3*2").startswith("END ")


# --- inbound SMS webhook ----------------------------------------------------

def test_inbound_sms_replies_to_normalized_sender(client):
    # a bare '+' in a form body decodes to a space; the sender must still be E.164
    r = client.post(
        "/webhook/sms",
        content="from=+254700000099&text=LOAN 5",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200 and "short_reply" in r.json()
    assert client.sent[0][1] == ["+254700000099"]
