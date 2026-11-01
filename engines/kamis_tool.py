import os
import io
import logging
import urllib3
from typing import Optional
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Suppress SSL certificate warning from urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Max number of KAMIS product IDs to fetch for a single query. Broad crop names
# (e.g. "beans") resolve to ~10 IDs; fetching all of them — each a deep
# per_page=1500 request — blows past the 5-calls/60s rate limiter and makes the
# query hang for ~85s. 4 keeps us under the limit while still covering the
# common varieties of a crop.
_MAX_PRODUCT_FETCHES = 4

# Full crop name to product ID mapping as extracted from the select2 dropdown options of the website
CROP_MAPPING = {
    "dry maize": 1,
    "maize": 1,
    "red sorghum": 2,
    "sorghum": 2,
    "wheat": 3,
    "rice": 4,
    "green grams": 10,
    "grams": 10,
    "ground nuts": 12,
    "groundnuts": 12,
    "beans red haricot": 29,
    "wairimu": 29,
    "beans yellow green": 30,
    "yellow-green beans": 30,
    "beans (yellow-green)": 30,
    "njahi": 50,
    "dolichos lablab": 50,
    "pearl rush millet": 51,
    "finger millet": 54,
    "millet": 54,
    "white sorghum": 56,
    "red irish potato": 57,
    "cabbages": 58,
    "cabbage": 58,
    "sweet potatoes": 59,
    "sweet potato": 59,
    "carrots": 60,
    "carrot": 60,
    "tomatoes": 61,
    "tomato": 61,
    "beans rosecoco": 64,
    "rosecoco": 64,
    "beans (mwitemania)": 65,
    "beans mwitemania": 65,
    "mwitemania": 65,
    "beans (mwezi moja)": 66,
    "beans mwezi moja": 66,
    "mwezi moja": 66,
    "beans (canadian wonder)": 67,
    "beans canadian wonder": 67,
    "canadian wonder": 67,
    "tilapia": 68,
    "goat milk": 70,
    "eggs": 72,
    "egg": 72,
    "meat beef": 73,
    "beef": 73,
    "meat mutton": 74,
    "mutton": 74,
    "meat indigenous chicken": 75,
    "indigenous chicken": 75,
    "meat broiler": 76,
    "broiler": 76,
    "omena": 77,
    "cat fish": 78,
    "haplochromis": 79,
    "trout": 80,
    "common carp": 81,
    "protopterus": 82,
    "black bass": 83,
    "labeo": 84,
    "mormyrus": 85,
    "eel": 86,
    "african butter catfish": 87,
    "synodontis": 89,
    "alestes": 90,
    "barbus": 91,
    "snappers": 93,
    "rabbitfish": 94,
    "mixed demersal": 95,
    "barracuda": 96,
    "tuna": 97,
    "mackerel": 98,
    "kingfish": 99,
    "sharks": 100,
    "sardines": 101,
    "swordfishes": 102,
    "lobster": 103,
    "prawns": 104,
    "mud crabs": 107,
    "golden crabs": 108,
    "shrimp": 109,
    "octopus": 110,
    "cuttlefish": 111,
    "squid": 112,
    "oysters": 113,
    "fish oil": 114,
    "fish maws": 115,
    "nile perch skins": 117,
    "black nightshade": 121,
    "managu": 121,
    "osuga": 121,
    "spider flower": 122,
    "saga": 122,
    "amaranthus": 123,
    "terere": 123,
    "jute plant": 124,
    "murenda": 124,
    "passion fruits": 125,
    "oranges": 127,
    "tree tomato": 128,
    "pepino melon": 129,
    "thorn melon": 130,
    "yam": 131,
    "cow milk": 133,
    "camel milk": 134,
    "cattle": 140,
    "pork": 141,
    "avocado": 142,
    "arrow root": 143,
    "lemons": 145,
    "mangoes": 147,
    "limes": 148,
    "green maize": 149,
    "water melon": 150,
    "pineapples": 151,
    "pawpaw": 152,
    "kales": 154,
    "sukuma wiki": 154,
    "dry onions": 158,
    "spring onions": 159,
    "fresh peas": 160,
    "spinach": 161,
    "cassava fresh": 162,
    "white irish potatoes": 163,
    "irish potatoes": 163,
    "cassava chips": 164,
    "chillies": 165,
    "lettuce": 166,
    "sheep": 167,
    "goat": 168,
    "donkey": 169,
    "pumpkin": 170,
    "butternuts": 171,
    "capsicums": 172,
    "cucumber": 173,
    "egg plant": 174,
    "brinjals": 174,
    "cauliflower": 175,
    "french beans": 177,
    "ginger": 178,
    "garlic": 180,
    "njugu mawe": 182,
    "beans rosecoco (nyayo)": 183,
    "nyayo": 183,
    "nile perch": 184,
    "camel": 186,
    "rabbit": 187,
    "pigeon peas": 188,
    "cowpeas": 189,
    "scavengers": 190,
    "parrotfishes": 191,
    "groupers": 192,
    "grunt": 193,
    "mullets": 194,
    "surgeonfishes": 195,
    "threadfin breams": 196,
    "goatfishes": 197,
    "rayfish": 198,
    "needlefishes": 199,
    "jacks": 200,
    "halfbeaks": 201,
    "anchovies": 202,
    "sailfishes": 203,
    "wolf herrings": 204,
    "marlins": 205,
    "jobfish": 206,
    "mixed pelagics": 207,
    "camel meat": 208,
    "meat chevon": 209,
    "chevon": 209,
    "rabbit meat": 210,
    "pigs": 211,
    "honey": 212,
    "cattle hide": 213,
    "camel hide": 214,
    "goat skin": 215,
    "sheep skin": 216,
    "fertilizer": 217,
    "tea": 218,
    "coffee": 219,
    "wheat bran": 220,
    "maize bran": 221,
    "sunflower cake": 222,
    "cotton seed": 223,
    "cotton": 224,
    "banana (ripending)": 226,
    "banana": 226,
    "chicken": 227,
    "macadamia seed": 228,
    "cashewnuts": 229,
    "cowpea leaves": 230,
    "kunde": 230,
    "nderema": 231,
    "pumpkin leaves": 233,
    "ethiopian kales": 234,
    "kanzira": 234,
    "indigenous crotolaria": 235,
    "mito": 235,
    "miro": 235,
    "soybean oil": 237,
    "coconut oil": 238,
    "sunflower seeds": 239,
    "sunflower oil": 240,
    "walnut seed": 241,
    "coriander": 242,
    "dhania": 242,
    "grapes": 243,
    "apples": 244,
    "dry peas": 245,
    "mixed beans": 246,
    "rockcode": 247,
    "queenfish": 248,
    "maize flour": 249,
    "duck": 251,
    "banana (cooking)": 255,
    "banana (plantain)": 256,
    "courgette": 257,
    "broccoli": 258,
    "lentils": 259,
    "fish scales": 261,
    "tangerine": 262,
    "sandara": 262,
    "wheat flour": 265,
    "paddy rice": 267,
    "beans (yellow)": 269,
    "beans yellow": 269,
    "coconut": 270,
    "okra": 272,
    "dragon fruit": 273
}

def resolve_crop_ids(crop_name: str) -> list[int]:
    """Resolves a crop name to a list of matching KAMIS product IDs (case-insensitive)."""
    if not crop_name:
        return []
    
    crop_clean = crop_name.lower().strip()
    matched_ids = []
    
    # 1. Exact Match first
    if crop_clean in CROP_MAPPING:
        matched_ids.append(CROP_MAPPING[crop_clean])
    
    # 2. Singular/Plural conversion helper
    elif crop_clean.endswith("s") and crop_clean[:-1] in CROP_MAPPING:
        matched_ids.append(CROP_MAPPING[crop_clean[:-1]])
    elif not crop_clean.endswith("s") and (crop_clean + "s") in CROP_MAPPING:
        matched_ids.append(CROP_MAPPING[crop_clean + "s"])
        
    # 3. Substring Match (e.g. "maize" matching "dry maize", "green maize", "maize bran", "maize flour")
    for k, v in CROP_MAPPING.items():
        if (crop_clean in k or k in crop_clean) and v not in matched_ids:
            matched_ids.append(v)
            
    return matched_ids

def _build_tavily_query(
    crop_name: Optional[str],
    market_name: Optional[str],
    county_name: Optional[str],
) -> str:
    """Builds a natural-language KAMIS price query for the Tavily fallback."""
    parts = []
    if crop_name:
        parts.append(crop_name)
    parts.append("market price")
    if market_name:
        parts.append(f"in {market_name}")
    if county_name:
        parts.append(f"{county_name} county")
    return " ".join(parts).strip() or "latest market prices"


def _fallback_chain_kwargs() -> dict:
    """Shared Tavily helpers for the structured fallback chain."""
    return {
        "build_tavily_query": _build_tavily_query,
        "search_kamis_via_tavily": _search_kamis_via_tavily,
        "open_web_fallback": _open_web_fallback,
    }


def _open_web_fallback(
    crop_name: Optional[str],
    market_name: Optional[str],
    county_name: Optional[str],
) -> Optional[str]:
    """Last-resort open-web price search via Tavily (no KAMIS-site restriction).

    Only call this once KAMIS, WFP, and the KAMIS-site Tavily search have all
    come up empty. Returns flagged, caveated text on success, or None on miss.
    Open-web prices are the least reliable source (possibly stale, different
    units, or national averages), so the disclaimer is baked into the result.
    """
    query = _build_tavily_query(crop_name, market_name, county_name)
    text = _search_kamis_via_tavily(query, restrict_to_kamis=False)
    if text and not text.startswith(("Error:", "An error occurred")):
        return (
            "No official KAMIS or WFP market data was found for this query. The "
            "estimate below comes from a general web search and may be outdated, "
            "use a different unit (e.g. per bag vs per kg), or reflect a national "
            "average rather than this specific market — treat it as a rough guide, "
            "not an official price.\n\n"
            + text
        )
    return None


def fetch_csv_prices(
    crop_name: Optional[str] = None,
    market_name: Optional[str] = None,
    county_name: Optional[str] = None,
    limit: int = 10,
) -> str:
    """Plain (non-tool) price lookup used by the agent.

    Default: market CSV (``data/market_prices.csv``).
    When ``USE_LIVE=true``, prefers a live KAMIS portal pull for the crop,
    then falls back to the CSV if the portal returns nothing.
    """
    import json

    from data.market_csv import query_prices

    limit = min(limit, 10)
    clean_crop_name = crop_name.strip() if crop_name else None
    clean_market_name = market_name.strip() if market_name else None
    clean_county_name = county_name.strip() if county_name else None

    rows: list = []
    try:
        from data.kamis_collect import fetch_live_crop_rows, use_live_kamis
        from data.price_pipeline import _live_rows_get, _live_rows_set

        if use_live_kamis() and clean_crop_name:
            cached = _live_rows_get(clean_crop_name)
            if cached is not None:
                rows = cached
            else:
                live = fetch_live_crop_rows(clean_crop_name)
                if live:
                    _live_rows_set(clean_crop_name, live)
                    rows = live
    except Exception as exc:
        logger.warning("USE_LIVE price path failed: %s", exc)
        rows = []

    if not rows:
        rows = query_prices(crop_name=clean_crop_name, limit=100_000)

    if not rows:
        return (
            "No price data available. With USE_LIVE=false, run "
            "`python scripts/collect_market_data.py` (or the admin portal's "
            "Refresh market data button). With USE_LIVE=true, check KAMIS "
            "portal reachability."
        )

    # Location filtering — market-first, then county, so a missing market
    # never silently returns some other market in the same county.
    substitution_note = ""
    if clean_market_name:
        needle = clean_market_name.lower()
        market_rows = [r for r in rows if needle in str(r.get("Market", "")).lower()]
        county_rows = [r for r in rows if needle in str(r.get("County", "")).lower()]
        if market_rows:
            rows = market_rows
        elif county_rows and not clean_county_name:
            # The "market" is really a town/county ("Nairobi") — what the farmer meant.
            rows = county_rows
        else:
            county_hint = clean_county_name or clean_market_name
            hint_rows = [
                r for r in rows if county_hint.lower() in str(r.get("County", "")).lower()
            ]
            rows = hint_rows
            if hint_rows:
                substitution_note = (
                    f"Note: '{clean_market_name}' has no recent KAMIS price reports, "
                    f"so the prices below are from other markets in "
                    f"{county_hint.title()} county.\n\n"
                )
    elif clean_county_name:
        needle = clean_county_name.lower()
        rows = [r for r in rows if needle in str(r.get("County", "")).lower()]

    if not rows:
        msg = "No price data found matching your query in the market CSV."
        if crop_name:
            msg += f" Crop: '{crop_name}'."
        return msg

    rows = sorted(rows, key=lambda r: str(r.get("Date") or ""), reverse=True)
    essential = ["Commodity", "Market", "County", "Wholesale", "Retail", "Date"]
    trimmed = [{c: r.get(c) for c in essential} for r in rows[:limit]]
    return substitution_note + json.dumps(trimmed, indent=2)


@tool
def scrape_kamis_prices(
    crop_name: Optional[str] = None,
    market_name: Optional[str] = None,
    county_name: Optional[str] = None,
    limit: int = 10,
) -> str:
    """
    Returns the most recent price entries for a crop. Reads the market CSV by
    default; when USE_LIVE=true, pulls from the KAMIS portal first.
    IMPORTANT: Always use the default limit of 10. Do NOT pass a higher limit value.

    Args:
        crop_name: The name of the crop to filter by (e.g. 'Tomatoes', 'Maize', 'Beans'). Case-insensitive.
        market_name: Optional name of the market location to filter by (e.g. 'Maua', 'Kibuye'). Case-insensitive.
        county_name: Optional name of the county to filter by (e.g. 'Meru', 'Kakamega', 'Nairobi'). Case-insensitive.
        limit: Number of records to return. Maximum is 10. Do NOT change this value.
    """
    return fetch_csv_prices(crop_name, market_name, county_name, limit)


def _search_kamis_via_tavily(query: str, restrict_to_kamis: bool = True) -> str:
    """
    Plain (non-tool) implementation of the Tavily search so it can be reused as a
    fallback by other code paths (e.g. when direct KAMIS scraping is blocked).

    When ``restrict_to_kamis`` is True (default) the search is scoped to the
    KAMIS website, which is more trustworthy. When False it searches the open
    web — used only as the very last resort, when KAMIS and WFP have no data and
    the KAMIS-site search also came up empty.
    """
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        return "Error: TAVILY_API_KEY is not set in the environment variables."

    from tavily import TavilyClient

    client = TavilyClient(api_key=tavily_key)

    # Scope to the KAMIS site for trustworthy results; drop the filter for the
    # open-web last-resort tier.
    modified_query = f"{query} site:kamis.kilimo.go.ke" if restrict_to_kamis else query

    try:
        # Perform advanced search
        search_result = client.search(
            query=modified_query,
            search_depth="advanced",
            max_results=5,
            include_answer=True
        )

        answer = search_result.get("answer")
        results = search_result.get("results", [])

        response_text = ""
        if answer:
            response_text += f"**Direct Answer from Tavily Search:**\n{answer}\n\n"

        response_text += "**Search Results from KAMIS Site:**\n"
        for idx, res in enumerate(results, 1):
            title = res.get("title", "No Title")
            url = res.get("url", "No URL")
            content = res.get("content", "No Content")
            response_text += f"{idx}. **[{title}]({url})**\n   {content}\n\n"

        return response_text
    except Exception as e:
        return f"An error occurred during Tavily Search: {str(e)}"


@tool
def search_kamis_via_tavily(query: str) -> str:
    """
    Searches the KAMIS website (https://kamis.kilimo.go.ke/site/market) using Tavily Search API
    to find relevant crop prices, reports, and location data.
    
    Args:
        query: Search query containing the crop name, market, and locations (e.g. 'Tomatoes price in Meru county').
    """
    return _search_kamis_via_tavily(query)
