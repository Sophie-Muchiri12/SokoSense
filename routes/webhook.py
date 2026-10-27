"""
SokoSense — Africa's Talking SMS + USSD Webhook
Lucy Kamau · Data Layer Owner

Parses incoming SMS text, routes to the correct engine, returns SMS-ready reply.
Matches contract.json: POST /webhook/sms
"""

import os
import re
import africastalking
from fastapi import APIRouter, BackgroundTasks, Request, Form
from fastapi.responses import PlainTextResponse

from engines import market, loaning
from models.market import MarketDecisionRequest
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
        print(f"[AT] Failed to initialize Africa's Talking SDK: {e}", flush=True)


def _send_sms(message: str, recipient: str, label: str = "SMS") -> None:
    """Send one SMS via Africa's Talking. Safe to run as a background task.

    Runs outside the request so a slow AT response can never delay a USSD
    reply (USSD sessions time out within seconds). flush=True makes the log
    lines appear immediately on hosts that buffer stdout (e.g. Render).
    """
    if not sms_client:
        print(f"[AT] SMS client not configured — {label} NOT sent to {recipient}", flush=True)
        return
    try:
        response = sms_client.send(message, [recipient])
        print(f"[AT] {label} sent to {recipient}: {response}", flush=True)
    except Exception as e:
        print(f"[AT] Failed to send {label} to {recipient}: {e}", flush=True)


def _normalize_phone(raw: str) -> str:
    """Form-decoding turns a bare '+' into a space; restore E.164."""
    phone = (raw or "").strip().replace(" ", "")
    if phone and phone != "unknown" and not phone.startswith("+") and phone.isdigit():
        phone = "+" + phone
    return phone or "unknown"


from routes.ussd_i18n import (
    CROP_SW,
    HELP_TEXT_SW,
    is_swahili_sms,
    loan_reply_sw,
    market_reply_sw,
    normalize_sms_text,
)

router = APIRouter(tags=["webhook"])

# ---------------------------------------------------------------------------
# PARSER — rule-based, matches contract markets/crops
# ---------------------------------------------------------------------------

KNOWN_CROPS = {"maize", "beans", "sorghum", "millet", "potatoes", "tomatoes"}
KNOWN_MARKETS = {"nairobi", "nakuru", "eldoret", "kisumu", "mombasa", "kitale", "nyeri", "meru"}

CROP_ALIASES = {
    "mahindi": "maize", "corn": "maize",
    "maharagwe": "beans",
    "mtama": "sorghum",
    "uwele": "millet",
    "viazi": "potatoes",
    "nyanya": "tomatoes",
}

LOAN_KEYWORDS   = {"LOAN", "INTEREST", "MKOPO", "BORROW", "%"}
HELP_KEYWORDS   = {"HELP", "MSAADA", "START", "HI", "HELLO"}

# Words that follow a number when it is a loan TERM or an AMOUNT, not a rate.
_NOT_A_RATE_UNIT = re.compile(
    r"^\s*(MONTHS?|MOS?|YEARS?|YRS?|WEEKS?|DAYS?|MIEZI|MWEZI|MIAKA|MWAKA|WIKI|SIKU|ELFU|K\b|KSH|KES|SHILLINGS?)", re.IGNORECASE
)
# Swahili puts the unit first: "miezi 6" (6 months).
_UNIT_BEFORE = re.compile(r"(MIEZI|MWEZI|MIAKA|MWAKA|WIKI|SIKU)\s*$", re.IGNORECASE)
MAX_MONTHLY_RATE = 100.0  # a monthly rate above 100% is an amount, not a rate


def extract_monthly_rate(clean: str) -> float | None:
    """Pull the monthly interest rate out of a loan SMS.

    Prefers an explicit percentage ("10%"). Otherwise takes the first number
    that is not followed by a term/amount unit and is a plausible rate.
    "LOAN 35000 BEANS 6 MONTHS" has no rate -> None (caller asks for one).
    """
    pct = re.search(r"(?<![\d.])(\d+(?:\.\d+)?)\s*%", clean)
    if pct:
        value = float(pct.group(1))
        return value if 0 <= value <= MAX_MONTHLY_RATE else None
    for m in re.finditer(r"(?<![\d.])(\d+(?:\.\d+)?)(?![\d.])", clean):
        if _NOT_A_RATE_UNIT.match(clean[m.end():]) or _UNIT_BEFORE.search(clean[:m.start()]):
            continue
        value = float(m.group(1))
        if 0 <= value <= MAX_MONTHLY_RATE:
            return value
    return None


def parse_sms(text: str) -> dict:
    clean  = text.strip().upper()
    tokens = clean.split()

    if len(tokens) <= 2 and {t.upper() for t in tokens} & HELP_KEYWORDS:
        return {"intent": "help"}

    if any(kw in clean for kw in LOAN_KEYWORDS):
        rate = extract_monthly_rate(clean)
        if rate is not None:
            return {"intent": "loan", "monthly_rate_percent": rate}
        return {"intent": "loan_missing_rate"}

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


LOAN_NEEDS_RATE_TEXT = "To check a loan, text LOAN and the monthly interest rate. Example: LOAN 5 (for 5% a month)."
LOAN_NEEDS_RATE_TEXT_SW = "Kukagua mkopo, tuma MKOPO na riba ya mwezi. Mfano: MKOPO 5 (riba 5% kwa mwezi)."

HELP_TEXT = (
    "SokoSense:\n"
    "PRICE: MAIZE NAKURU\n"
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

    if intent == "loan_missing_rate":
        return LOAN_NEEDS_RATE_TEXT_SW if is_sw else LOAN_NEEDS_RATE_TEXT

    if intent == "loan":
        req = LoanRequest(monthly_rate_percent=parsed["monthly_rate_percent"])
        result = loaning.decide_loan(req)
        return loan_reply_sw(result) if is_sw else result.short_reply

    return HELP_TEXT_SW if is_sw else HELP_TEXT


# ---------------------------------------------------------------------------
# SMS WEBHOOK  (matches contract.json: POST /webhook/sms)
# ---------------------------------------------------------------------------

@router.post("/webhook/sms")
async def sms_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Africa's Talking inbound SMS webhook.
    AT POSTs form-encoded: from, to, text, date, id, linkId
    """
    form   = await request.form()
    text   = form.get("text", "").strip()
    sender = _normalize_phone(form.get("from", "unknown"))

    reply = truncate_sms(route_sms(text))

    if sender != "unknown":
        background_tasks.add_task(_send_sms, reply, sender, "SMS reply")
    else:
        print("[AT] Inbound SMS had no sender — reply NOT sent", flush=True)

    return {"short_reply": reply}


# ---------------------------------------------------------------------------
# USSD HANDLER
# ---------------------------------------------------------------------------
def _loan_followup_sms(band_key: str, is_sw: bool, result) -> str:
    """Follow-up SMS after a USSD Loan Check, in the session's language."""
    if not is_sw:
        return loaning.build_loan_sms_followup(band_key)
    alternatives = loaning._get_alternatives_list()
    return truncate_sms(f"{loan_reply_sw(result)} Jaribu: {alternatives}")


@router.post("/ussd", response_class=PlainTextResponse)
async def ussd_handler(
    background_tasks: BackgroundTasks,
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
            return "CON Select service:\n1. Market Price\n2. Loan Check"
        if lang == "2":
            return "CON Chagua huduma:\n1. Bei ya Soko\n2. Mkopo"
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

    # Option 2: Loan Check / Mkopo
    if service == "2":
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

            # Only text a valid choice (an invalid band must not cost an SMS),
            # in the farmer's language, and never block the USSD reply on it.
            if parts[2] in loaning.LOAN_AMOUNT_BANDS:
                background_tasks.add_task(
                    _send_sms,
                    _loan_followup_sms(parts[2], is_sw, result),
                    _normalize_phone(phoneNumber),
                    "USSD loan follow-up SMS",
                )

            return f"END {truncate_ussd(reply)}"

    if is_sw:
        return "END Ingizo batili. Tuma HELP kwa maagizo."
    return "END Invalid input. Text HELP for commands."
