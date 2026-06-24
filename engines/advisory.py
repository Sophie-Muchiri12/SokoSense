"""Advisory RAG engine — ties Neo4j knowledge graph + Weather API + LLM.

Pipeline:
  1. Parse farmer's question → extract crop, disease, location keywords
  2. Query Neo4j knowledge graph for relevant (crop, disease, remedy, practice)
  3. Fetch weather for location (if present)
  4. Build a prompt with retrieved context + weather context
  5. Call Featherless LLM → generate final answer

Usage:
    from engines.advisory import answer_farmer_question
    result = answer_farmer_question("What causes maize rust in Nakuru?")
"""

import os
import re
import logging
from typing import Any

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from engines.neo4j_client import Neo4jClient
from engines.weather import get_farmer_weather, _geocode_location, _fetch_weather, _weatheradvice

load_dotenv()

logger = logging.getLogger(__name__)

# ── keyword extraction (lightweight — no extra model call) ─────────────────

# Kenyan crops the system knows about
KNOWN_CROPS = [
    "maize", "beans", "tomatoes", "potatoes", "kale", "sukuma wiki",
    "cabbage", "carrots", "onions", "spinach", "cassava", "sweet potatoes",
    "irish potatoes", "rice", "wheat", "sorghum", "millet", "green grams",
    "ground nuts", "cowpeas", "pigeon peas", "french beans", "capsicum",
    "cucumber", "lettuce", "pumpkin", "watermelon", "mangoes", "avocado",
    "oranges", "banana", "pineapples", "pawpaw", "passion", "tree tomato",
    "coffee", "tea", "cotton", "macadamia", "coconut", "ginger", "garlic",
    "chillies", "brinjals", "egg plant", "kales", "managu", "terere",
    "murenda", "saga", "nderema", "kunde", "mito",
]

KNOWN_LOCATIONS = [
    "nairobi", "nakuru", "eldoret", "kisumu", "mombasa", "kitale",
    "nyeri", "meru", "naivasha", "thika", "machakos", "malindi",
    "marsabit", "garissa", "kakamega", "baringo", "nanyuki", "kericho",
    "homa bay", "busia", "kiambu", "muranga", "embu", "makueni",
    "kitui", "kwale", "lamu", "isiolo", "wajir", "mandera",
    "turkana", "nandi", "bomet", "nyamira", "migori", "siaya",
    "vihiga", "kilifi", "taita", "taveta",
]

KNOWN_DISEASE_KW = [
    "rust", "blight", "wilt", "mosaic", "streak", "smut", "mildew",
    "rot", "leaf spot", "blight", "canker", "gall", "scab", "curl",
    "yellow", "necrosis", "armyworm", "borer", "aphid", "thrips",
    "whitefly", "nematode", "weevil", "mite", "fungal", "bacterial",
    "virus", "disease", "pest", "infection",
]


def _extract_keywords(query: str) -> dict[str, str | None]:
    """Extract crop, disease, and location from a farmer's question."""
    q = query.lower().strip()

    crop = None
    for c in sorted(KNOWN_CROPS, key=len, reverse=True):
        if c in q:
            crop = c
            break

    location = None
    for loc in sorted(KNOWN_LOCATIONS, key=len, reverse=True):
        if loc in q:
            location = loc
            break

    disease = None
    for dk in KNOWN_DISEASE_KW:
        if dk in q:
            # Try to grab a few words around the keyword
            match = re.search(
                r"(\w+\s+){0,3}" + re.escape(dk) + r"(\s+\w+){0,3}",
                q,
                re.IGNORECASE,
            )
            disease = match.group(0).strip() if match else dk
            break

    return {"crop": crop, "disease": disease, "location": location}


def _format_graph_context(rows: list[dict[str, Any]]) -> str:
    """Format Neo4j graph results into a readable context block."""
    if not rows:
        return "No specific crop/disease knowledge found in the database."

    parts = []
    seen = set()
    for r in rows:
        key = (r.get("crop", ""), r.get("disease", ""))
        if key in seen:
            continue
        seen.add(key)

        block = [f"Crop: {r.get('crop', 'N/A')}"]
        block.append(f"Disease: {r.get('disease', 'N/A')}")
        if r.get("symptom"):
            block.append(f"  Symptoms: {r['symptom']}")
        if r.get("remedy"):
            block.append(f"  Remedy/Control: {r['remedy']}")
        if r.get("practice"):
            block.append(f"  Best Practice: {r['practice']}")
        parts.append("\n".join(block))

    return "\n\n".join(parts)


def _format_vector_context(chunks: list[dict[str, Any]]) -> str:
    """Format Neo4j vector search results into a readable context block."""
    if not chunks:
        return ""

    parts = []
    for c in chunks:
        source = c.get("pdf_name", "Unknown PDF")
        page = c.get("page_num", "?")
        score = c.get("score", 0)
        text = c.get("text", "")
        parts.append(
            f"[From: {source} (Page {page}), relevance: {score:.2f}]\n{text}"
        )

    return "\n\n".join(parts)


def answer_farmer_question(
    query: str,
    include_weather: bool = True,
) -> dict[str, Any]:
    """Main RAG pipeline entry point.

    Args:
        query: Farmer's natural language question.
        include_weather: Whether to fetch weather data for the detected location.

    Returns:
        dict with keys: query, answer, location, weather, sources
    """
    # 1. Extract keywords
    kw = _extract_keywords(query)
    crop = kw["crop"]
    disease = kw["disease"]
    location = kw["location"]

    # 2. Query Neo4j knowledge graph AND vector store
    neo4j = Neo4jClient()

    # 2a. Graph knowledge (structured crop-disease-remedy)
    graph_rows = neo4j.query_knowledge_graph(crop=crop, disease=disease)
    graph_context = _format_graph_context(graph_rows)

    # 2b. Vector search (semantic search over PDF document chunks)
    vector_chunks = neo4j.vector_search(query_text=query, top_k=5)
    vector_context = _format_vector_context(vector_chunks)

    # 3. Fetch weather if location detected
    weather_context = ""
    weather_data: dict | None = None
    if location and include_weather:
        try:
            coords = _geocode_location(location)
            if coords:
                wd = _fetch_weather(*coords)
                if "error" not in wd:
                    weather_data = wd
                    weather_context = (
                        f"--- Current Weather for {location.title()} ---\n"
                        f"Condition: {wd['current'].get('condition', 'N/A')}\n"
                        f"Temperature: {wd['current'].get('temperature_c', 'N/A')}°C\n"
                        f"Humidity: {wd['current'].get('humidity_pct', 'N/A')}%\n"
                        f"Precipitation: {wd['current'].get('precipitation_mm', 0)}mm\n"
                        f"Wind: {wd['current'].get('wind_speed_kmh', 'N/A')} km/h\n"
                    )
                    if wd.get("forecast"):
                        weather_context += "\n3-Day Forecast:\n"
                        for day in wd["forecast"]:
                            weather_context += (
                                f"  {day['date']}: {day['condition']}, "
                                f"{day['temp_min_c']}–{day['temp_max_c']}°C, "
                                f"Rain: {day['precipitation_mm']}mm\n"
                            )
                    # Add farming advice derived from weather
                    weather_context += f"\nWeather-based farming advice:\n{_weatheradvice(wd)}\n"
        except Exception as exc:
            logger.warning("Weather fetch failed: %s", exc)
            weather_context = ""

    # 4. Build sources list
    sources = []
    if graph_rows:
        for r in graph_rows[:3]:
            if r.get("crop") and r.get("disease"):
                sources.append(f"Agricultural knowledge base: {r['crop']} - {r['disease']}")
    if vector_chunks:
        for c in vector_chunks[:3]:
            pdf = c.get("pdf_name", "PDF document")
            sources.append(f"PDF reference: {pdf} (page {c.get('page_num', '?')})")
    if weather_data:
        sources.append(f"Weather data (Open-Meteo) for {location.title()}")

    # 5. Call LLM
    system_prompt = SystemMessage(
        content=(
            "You are SokoSense, an expert agricultural AI assistant for Kenyan smallholder farmers. "
            "You provide practical, actionable advice in clear, simple language (Swahili or English). "
            "Your responses must be under 320 characters when possible (SMS-ready).\n"
            "DO NOT use any emojis in your response under any circumstances.\n\n"
            "Use the context below to answer the farmer's question. If the context doesn't contain "
            "enough information, still try to give helpful general advice based on your training.\n\n"
            "Always structure your answer with:\n"
            "1. Direct answer to the question\n"
            "2. Practical steps the farmer can take today\n"
            "3. If weather data is provided, relate your advice to current conditions\n\n"
            "Be concise, specific, and actionable. Mention specific crop varieties, chemical names, "
            "and local practices where relevant."
        )
    )

    context_parts = [
        "=== RELEVANT AGRICULTURAL KNOWLEDGE (Graph) ===",
        graph_context,
    ]
    if vector_context:
        context_parts.append("")
        context_parts.append("=== RELEVANT DOCUMENT EXTRACTS (Vector Search) ===")
        context_parts.append(vector_context)
    if weather_context:
        context_parts.append("")
        context_parts.append(weather_context)

    context_block = "\n".join(context_parts)

    user_message = HumanMessage(
        content=(
            f"Farmer's question: {query}\n\n"
            f"{context_block}\n\n"
            f"Provide a helpful answer for this Kenyan farmer. "
            f"Respond in JSON format: {{\"response\": \"your answer\", \"type\": \"advisory\"}}"
        )
    )

    # Initialize the LLM (Featherless API)
    featherless_api_key = os.getenv("FEATHERLSS_API_KEY")
    featherless_model = os.getenv("LLM_MODEL_FEATHERLESS", "MiniMaxAI/MiniMax-M3")

    if not featherless_api_key:
        return {
            "query": query,
            "answer": "FEATHERLSS_API_KEY is not set in .env.",
            "location": location,
            "weather": weather_data,
            "sources": sources,
        }

    llm = ChatOpenAI(
        model=featherless_model,
        temperature=0.3,
        openai_api_key=featherless_api_key,
        openai_api_base="https://api.featherless.ai/v1",
    )

    try:
        response = llm.invoke([system_prompt, user_message])
        answer = response.content.strip()
    except Exception as exc:
        logger.error("LLM call failed: %s", exc)
        answer = (
            f"I'm sorry, I couldn't generate a complete answer right now. "
            f"Based on my records: {graph_context[:300]}"
        )

    return {
        "query": query,
        "answer": answer,
        "location": location,
        "weather": weather_data,
        "sources": sources,
    }
