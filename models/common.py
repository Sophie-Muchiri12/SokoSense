SMS_MAX_CHARS = 320
USSD_MAX_CHARS = 182


def truncate_sms(value: str) -> str:
    """Enforce SMS reply length limit."""
    return value[:SMS_MAX_CHARS]


def truncate_ussd(value: str) -> str:
    """Enforce single-screen USSD reply length limit (stricter than SMS)."""
    return value[:USSD_MAX_CHARS]
