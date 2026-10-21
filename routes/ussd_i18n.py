"""Swahili reply formatters for USSD and SMS — engines stay English."""

from models.common import truncate_sms
from models.loan import LoanResponse, RiskVerdict
from models.market import MarketDecisionResponse
from models.timing import TimingResponse

CROP_SW = {
    "maize": "mahindi",
    "beans": "maharagwe",
    "potatoes": "viazi",
    "tomatoes": "nyanya",
    "sorghum": "mtama",
    "millet": "uwele",
}

SW_CROP_TOKENS = frozenset(CROP_SW.values())
SW_KEYWORDS = frozenset({
    "MKOPO", "MSAADA", "LINI", "KUUZA", "BEI", "WAKATI", "NUNUA", "HATARI",
})

HELP_TEXT_SW = (
    "SokoSense:\n"
    "BEI: MAHINDI NAKURU\n"
    "WAKATI: MAHINDI LINI\n"
    "MKOPO: MKOPO 5\n"
    "Bure. Hakuna programu."
)


def normalize_sms_text(text: str) -> tuple[str, str | None]:
    """Strip optional SW:/EN: prefix; return (body, forced_lang or None)."""
    stripped = text.strip()
    upper = stripped.upper()
    if upper.startswith("SW:") or upper.startswith("SW "):
        body = stripped[3:].lstrip(": ").strip()
        return body, "sw"
    if upper.startswith("EN:") or upper.startswith("EN "):
        body = stripped[3:].lstrip(": ").strip()
        return body, "en"
    return stripped, None


def is_swahili_sms(text: str) -> bool:
    """Heuristic: Swahili crop names or keywords in the message."""
    clean = text.strip().upper()
    tokens = {t.lower() for t in clean.split()}
    if tokens & SW_CROP_TOKENS:
        return True
    return any(kw in clean for kw in SW_KEYWORDS)


def market_reply_sw(result: MarketDecisionResponse) -> str:
    loc = result.location
    if result.recommendation == "SELL_HERE":
        price = result.local_price_kes or 0
        return truncate_sms(
            f"UZA HAPA. {loc} ina bei bora ya KSh {price:,.0f}/gunia leo."
        )
    if result.recommendation == "SELL_IN_MARKET":
        best = (result.best_market or loc).upper()
        diff = result.price_diff_kes or 0
        return truncate_sms(
            f"UZA {best}. KSh {diff:,.0f} zaidi kwa gunia. Inafaa safari."
        )
    price = result.local_price_kes or 0
    return truncate_sms(
        f"SUBIRI. Bei ya {loc} ni shindani kwa KSh {price:,.0f}/gunia. "
        f"Hakuna soko bora leo."
    )


def timing_reply_sw(result: TimingResponse) -> str:
    crop = CROP_SW.get(result.crop, result.crop)
    market = result.market.title()
    if result.recommendation == "WAIT":
        days = result.wait_days or 3
        return truncate_sms(
            f"SHIKILIA. Bei ya {crop} inaongezeka. "
            f"Subiri siku {days} kama unaweza. Wanunuzi: nunua leo."
        )
    return truncate_sms(
        f"UZA LEO. Bei ya {crop} katika {market} ni shindani sasa. "
        f"Wanunuzi: nunua au subiri kulingana na mahitaji."
    )


def loan_reply_sw(result: LoanResponse) -> str:
    apr = result.apr_percent
    ratio = round(apr / result.cbk_rate_percent, 1) if result.cbk_rate_percent else 0

    if result.risk_verdict == RiskVerdict.AVOID:
        return truncate_sms(
            f"USICHUKUE MKOPO HUU. {apr}% APR. {ratio}x kiwango cha CBK. "
            f"Angalia AFC, Hustler Fund au DigiFarm."
        )
    if result.risk_verdict == RiskVerdict.HIGH_RISK:
        return truncate_sms(
            f"HATARI KUBWA. {apr}% APR. {ratio}x kiwango cha CBK. "
            f"Angalia chaguo bora."
        )
    if result.risk_verdict == RiskVerdict.CAUTION:
        return truncate_sms(
            f"ANGALIA. {apr}% APR. Juu ya kiwango cha CBK. "
            f"Linganisha na mkopo wa kilimo."
        )
    return truncate_sms(
        f"SALAMA. {apr}% APR. Karibu na kiwango cha CBK. Soma masharti yote."
    )
