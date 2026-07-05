"""Shared Groq LLM factory for agent and advisory pipelines."""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "1"))
DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def get_groq_llm(*, temperature: float = 0.0):
    """Return a ChatGroq instance, or None if GROQ_API_KEY is missing."""
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return None
    try:
        from langchain_groq import ChatGroq
    except ImportError:
        logger.warning("GROQ_API_KEY set but langchain-groq is not installed.")
        return None

    return ChatGroq(
        model=DEFAULT_GROQ_MODEL,
        temperature=temperature,
        api_key=groq_api_key,
        timeout=LLM_TIMEOUT_SECONDS,
        max_retries=LLM_MAX_RETRIES,
    )
