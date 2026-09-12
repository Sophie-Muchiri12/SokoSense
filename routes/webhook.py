"""
SokoSense — Africa's Talking SMS + USSD Webhook
Lucy Kamau · Data Layer Owner

Parses incoming SMS text, routes to the correct engine, returns SMS-ready reply.
Matches contract.json: POST /webhook/sms
"""

import os
import re
import africastalking
from fastapi import APIRouter, Request, Form
from fastapi.responses import PlainTextResponse

from engines import market, timing, loaning
from models.market import MarketDecisionRequest
from models.timing import TimingRequest
from models.loan import LoanRequest
from models.common import truncate_ussd, truncate_sms

# --- Africa's Talking SMS client (for sending replies to inbound SMS) ---
AT_USERNAME = os.getenv("AT_USERNAME")
AT_API_KEY = os.getenv("AT_API_KEY")

sms_client = None
if AT_USERNAME and AT_API_KEY:
    try:
        africastalking.initialize(AT_USERNAME, AT_API_KEY)
        sms_client = africastalking.SMS
    except Exception as e:
        print(f"[AT] Failed to initialize Africa's Talking SDK: {e}")
from masumi_hook import charge_query
from routes.ussd_i18n import (
    CROP_SW,
    HELP_TEXT_SW,
    is_swahili_sms,
    loan_reply_sw,
    market_reply_sw,
    normalize_sms_text,
    timing_reply_sw,
)

router = APIRouter(tags=["webhook"])

# ---------------------------------------------------------------------------
# PARSER — rule-based, matches contract markets/crops
# ---------------------------------------------------------------------------

KNOWN_CROPS = {"maize", "beans", "sorghum", "millet", "potatoes", "tomatoes"}
KNOWN_MARKETS = {"nairobi", "nakuru", "eldoret", "kisumu", "mombasa", "kitale", "nyeri"}

CROP_ALIASES = {
    "mahindi": "maize", "corn": "maize",
    "maharagwe": "beans",
    "mtama": "sorghum",
    "uwele": "millet",
    "viazi": "potatoes",
    "nyanya": "tomatoes",
}

TIMING_KEYWORDS = {"TIMING", "WHEN", "SHOULD I SELL", "WAIT", "LINI", "KUUZA", "WAKATI"}
LOAN_KEYWORDS   = {"LOAN", "INTEREST", "MKOPO", "BORROW", "%"}
HELP_KEYWORDS   = {"HELP", "MSAADA", "START", "HI", "HELLO"}


def parse_sms(text: str) -> dict:
    clean  = text.strip().upper()
    tokens = clean.split()

    if len(tokens) <= 2 and {t.upper() for t in tokens} & HELP_KEYWORDS:
        return {"intent": "help"}

    if any(kw in clean for kw in LOAN_KEYWORDS):
        match = re.search(r"(\d+\.?\d*)", clean)
        if match:
            return {"intent": "loan", "monthly_rate_percent": float(match.group(1))}

    for crop_raw in KNOWN_CROPS | set(CROP_ALIASES.keys()):
        if crop_raw.upper() in clean and any(kw in clean for kw in TIMING_KEYWORDS):
            crop = CROP_ALIASES.get(crop_raw.lower(), crop_raw.lower())
            market_found = next((m for m in KNOWN_MARKETS if m.upper() in clean), "nairobi")
            return {"intent": "timing", "crop": crop, "market": market_found}

    found_crop, found_market = None, None
    for token in tokens:
        t = token.lower()
        if t in KNOWN_CROPS or t in CROP_ALIASES:
            found_crop = CROP_ALIASES.get(t, t)
        if t in KNOWN_MARKETS:
            found_market = t

    if found_crop and found_market:
        return {"intent": "market", "crop": found_crop, "location": found_market}
    if found_crop:
        return {"intent": "market", "crop": found_crop, "location": "nairobi"}

    return {"intent": "unknown"}


HELP_TEXT = (
    "SokoSense:\n"
    "PRICE: MAIZE NAKURU\n"
    "TIMING: BEANS TIMING\n"
    "LOAN: LOAN 5\n"
    "Free. No app needed."
)


def route_sms(text: str) -> str:
    """Pure routing function — testable without HTTP, reusable by USSD handler."""
    text, forced_lang = normalize_sms_text(text)
    parsed = parse_sms(text)
    intent = parsed.get("intent")
    is_sw = forced_lang == "sw" or (forced_lang is None and is_swahili_sms(text))

    if intent == "help":
        return HELP_TEXT_SW if is_sw else HELP_TEXT

    if intent == "market":
        req = MarketDecisionRequest(crop=parsed["crop"], location=parsed["location"])
        result = market.decide_market(req)
        return market_reply_sw(result) if is_sw else result.short_reply

    if intent == "timing":
        req = TimingRequest(crop=parsed["crop"], market=parsed["market"])
        result = timing.decide_timing(req)
        return timing_reply_sw(result) if is_sw else result.short_reply

    if intent == "loan":
        req = LoanRequest(monthly_rate_percent=parsed["monthly_rate_percent"])
        result = loaning.decide_loan(req)
        charge_query("loan", payer="demo-sacco")
        return loan_reply_sw(result) if is_sw else result.short_reply

    return HELP_TEXT_SW if is_sw else HELP_TEXT


# ---------------------------------------------------------------------------
# SMS WEBHOOK  (matches contract.json: POST /webhook/sms)
# ---------------------------------------------------------------------------

@router.post("/webhook/sms")
async def sms_webhook(request: Request):
    """
    Africa's Talking inbound SMS webhook.
    AT POSTs form-encoded: from, to, text, date, id, linkId
    """
    form   = await request.form()
    text   = form.get("text", "").strip()
    sender = form.get("from", "unknown")

    reply = truncate_sms(route_sms(text))

    if sms_client and sender != "unknown":
        try:
            at_response = sms_client.send(reply, [sender])
            print(f"[AT] SMS sent to {sender}: {at_response}")
        except Exception as e:
            print(f"[AT] Failed to send SMS reply to {sender}: {e}")
    else:
        print(f"[AT] SMS client not configured — reply NOT sent to {sender}: {reply}")

    return {"short_reply": reply}


# ---------------------------------------------------------------------------
# USSD HANDLER
# ---------------------------------------------------------------------------
@router.post("/ussd", response_class=PlainTextResponse)
async def ussd_handler(
    sessionId: str = Form(...),
    serviceCode: str = Form(...),
    phoneNumber: str = Form(...),
    text: str = Form(default=""),
):
    parts = [p for p in text.split("*")] if text else []
    depth = len(parts)

    CROPS    = {"1": "maize", "2": "beans", "3": "potatoes", "4": "tomatoes"}
    LOCS     = {"1": "nairobi", "2": "nakuru", "3": "eldoret", "4": "kisumu"}

    # Level 0: Language selection
    if depth == 0 or text == "":
        return "CON Welcome to SokoSense!\n1. English\n2. Kiswahili"

    lang  = parts[0]
    is_sw = lang == "2"

    # Level 1: Main menu
    if depth == 1:
        if lang == "1":
            return "CON Select service:\n1. Market Price\n2. When to Sell\n3. Loan Check"
        if lang == "2":
            return "CON Chagua huduma:\n1. Bei ya Soko\n2. Wakati wa Kuuza\n3. Mkopo"
        return "END Invalid input."

    service = parts[1]

    # Option 1: Market Price / Bei ya Soko
    if service == "1":
        if depth == 2:
            if is_sw:
                return "CON Chagua zao:\n1.Mahindi 2.Maharagwe\n3.Viazi 4.Nyanya"
            return "CON Select crop:\n1.Maize 2.Beans\n3.Potatoes 4.Tomatoes"
        if depth == 3:
            crop = CROPS.get(parts[2], "maize")
            if is_sw:
                label = CROP_SW.get(crop, crop).upper()
                return f"CON Soko la {label}:\n1.Nairobi 2.Nakuru\n3.Eldoret 4.Kisumu"
            return f"CON {crop.upper()} market:\n1.Nairobi 2.Nakuru\n3.Eldoret 4.Kisumu"
        if depth == 4:
            req = MarketDecisionRequest(
                crop=CROPS.get(parts[2], "maize"),
                location=LOCS.get(parts[3], "nairobi"),
            )
            result = market.decide_market(req)
            reply = market_reply_sw(result) if is_sw else result.short_reply
            return f"END {truncate_ussd(reply)}"

    # Option 2: When to Sell / Wakati wa Kuuza
    if service == "2":
        if depth == 2:
            if is_sw:
                return "CON Chagua zao:\n1.Mahindi 2.Maharagwe\n3.Viazi 4.Nyanya"
            return "CON Select crop:\n1.Maize 2.Beans\n3.Potatoes 4.Tomatoes"
        if depth == 3:
            req = TimingRequest(
                crop=CROPS.get(parts[2], "maize"),
                market="nairobi",
            )
            result = timing.decide_timing(req)
            reply = timing_reply_sw(result) if is_sw else result.short_reply
            return f"END {truncate_ussd(reply)}"

    # Option 3: Loan Check / Mkopo
    if service == "3":
        if depth == 2:
            if is_sw:
                return (
                    "CON Chagua kiasi cha mkopo:\n"
                    "1.KSh 5,000 2.KSh 20,000\n"
                    "3.KSh 50,000 4.KSh 100,000\n"
                    "5.KSh 200,000+"
                )
            return (
                "CON Select loan amount:\n"
                "1.KSh 5,000 2.KSh 20,000\n"
                "3.KSh 50,000 4.KSh 100,000\n"
                "5.KSh 200,000+"
            )
        if depth == 3:
            result = loaning.decide_loan_by_amount_band(parts[2])
            reply = loan_reply_sw(result) if is_sw else result.short_reply

            if sms_client:
                try:
                    sms_text = loaning.build_loan_sms_followup(parts[2])
                    sms_client.send(sms_text, [phoneNumber])
                    print(f"[AT] USSD loan follow-up SMS sent to {phoneNumber}")
                except Exception as e:
                    print(f"[AT] Failed to send USSD loan follow-up SMS to {phoneNumber}: {e}")

            return f"END {truncate_ussd(reply)}"

    if is_sw:
        return "END Ingizo batili. Tuma HELP kwa maagizo."
    return "END Invalid input. Text HELP for commands."

# MASUMI REVENUE CHECK  (for demo — shows live billing activity)
# ---------------------------------------------------------------------------

from masumi_hook import get_revenue_summary, get_transaction_log

@router.get("/webhook/revenue")
def revenue_summary():
    """Live revenue dashboard data — shows judges automated billing in action."""
    return {
        "summary": get_revenue_summary(),
        "recent_transactions": get_transaction_log(limit=10),
    }
