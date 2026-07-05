SMS_MAX_CHARS = 320


def truncate_sms(value: str) -> str:
    """Enforce SMS reply length limit."""
    return value[:SMS_MAX_CHARS]


def unwrap_llm_json_answer(text: str) -> str:
    """Return plain answer text when the LLM wrapped it in JSON."""
    import json

    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`").strip()
        if stripped.lower().startswith("json"):
            stripped = stripped[4:].strip()

    try:
        parsed = json.loads(stripped)
    except (json.JSONDecodeError, TypeError):
        return text

    if isinstance(parsed, dict):
        reply = parsed.get("response")
        if isinstance(reply, str) and reply.strip():
            return reply.strip()

    return text
