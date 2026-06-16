SMS_MAX_CHARS = 320


def truncate_sms(value: str) -> str:
    """Enforce SMS reply length limit."""
    return value[:SMS_MAX_CHARS]
