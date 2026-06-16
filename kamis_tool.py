import os
import io
import urllib3
import requests
import pandas as pd
from typing import Optional
from langchain_core.tools import tool
from tavily import TavilyClient
from rate_limiter import kamis_http_limiter

# Suppress SSL certificate warning from urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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

@tool
def scrape_kamis_prices(
    crop_name: Optional[str] = None,
    market_name: Optional[str] = None,
    county_name: Optional[str] = None,
    limit: int = 10
) -> str:
    """
    Directly queries the KAMIS market price website and returns the 10 most recent price entries.
    IMPORTANT: Always use the default limit of 10. Do NOT pass a higher limit value.
    
    Args:
        crop_name: The name of the crop to filter by (e.g. 'Tomatoes', 'Maize', 'Beans'). Case-insensitive.
        market_name: Optional name of the market location to filter by (e.g. 'Maua', 'Kibuye'). Case-insensitive.
        county_name: Optional name of the county to filter by (e.g. 'Meru', 'Kakamega', 'Nairobi'). Case-insensitive.
        limit: Number of records to return. Maximum is 10. Do NOT change this value.
    """
    url = "https://kamis.kilimo.go.ke/site/market"
    limit = min(limit, 10)  # Hard cap — never return more than 10 rows

    clean_crop_name = crop_name.strip() if crop_name else None
    clean_market_name = market_name.strip() if market_name else None
    clean_county_name = county_name.strip() if county_name else None

    # If a location filter is set, fetch more rows from the server so the local
    # filter has enough data to find matches. Without a filter, 10 is enough.
    has_location = bool(clean_market_name or clean_county_name)
    server_per_page = 100 if has_location else 10

    product_ids = resolve_crop_ids(clean_crop_name)
    dfs = []

    if product_ids:
        for pid in product_ids:
            params = {
                "product": pid,
                "per_page": server_per_page
            }
            try:
                kamis_http_limiter.acquire()  # ← rate-limit each outgoing HTTP call
                response = requests.get(url, params=params, verify=False, timeout=15)
                if response.status_code == 200:
                    sub_dfs = pd.read_html(io.StringIO(response.text))
                    if sub_dfs:
                        dfs.append(sub_dfs[0])
            except Exception:
                pass
    else:
        params = {"per_page": server_per_page}
        try:
            kamis_http_limiter.acquire()  # ← rate-limit the fallback HTTP call
            response = requests.get(url, params=params, verify=False, timeout=20)
            if response.status_code == 200:
                sub_dfs = pd.read_html(io.StringIO(response.text))
                if sub_dfs:
                    dfs.append(sub_dfs[0])
        except Exception as e:
            return f"An error occurred while fetching KAMIS data: {str(e)}"

    if not dfs:
        return "No price data could be retrieved from the KAMIS website."

    # Combine and clean
    df = pd.concat(dfs, ignore_index=True)
    df.columns = [c.strip() for c in df.columns]
    df = df.drop_duplicates()

    # Filter in pandas (Case-Insensitive)
    if clean_crop_name:
        df = df[df['Commodity'].str.contains(clean_crop_name, case=False, na=False)]

    if clean_market_name and clean_county_name:
        # Match either market OR county
        df = df[
            df['Market'].str.contains(clean_market_name, case=False, na=False) |
            df['County'].str.contains(clean_county_name, case=False, na=False)
        ]
    else:
        if clean_market_name:
            df = df[df['Market'].str.contains(clean_market_name, case=False, na=False)]
        if clean_county_name:
            df = df[df['County'].str.contains(clean_county_name, case=False, na=False)]

    total_rows = len(df)
    if total_rows == 0:
        msg = "No price data found matching your query."
        if crop_name:
            msg += f" Crop: '{crop_name}' (Resolved IDs: {product_ids})."
        if market_name:
            msg += f" Market: '{market_name}'."
        if county_name:
            msg += f" County: '{county_name}'."
        return msg

    # Sort newest first
    if 'Date' in df.columns:
        df = df.sort_values(by='Date', ascending=False)

    # Keep only essential columns
    essential_cols = ['Commodity', 'Market', 'County', 'Wholesale', 'Retail', 'Date']
    cols_to_keep = [c for c in essential_cols if c in df.columns]
    df = df[cols_to_keep]

    df_limited = df.head(limit)
    return df_limited.to_json(orient="records", indent=2)

@tool
def search_kamis_via_tavily(query: str) -> str:
    """
    Searches the KAMIS website (https://kamis.kilimo.go.ke/site/market) using Tavily Search API
    to find relevant crop prices, reports, and location data.
    
    Args:
        query: Search query containing the crop name, market, and locations (e.g. 'Tomatoes price in Meru county').
    """
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        return "Error: TAVILY_API_KEY is not set in the environment variables."
        
    client = TavilyClient(api_key=tavily_key)
    
    # Force search to focus on the KAMIS website
    modified_query = f"{query} site:kamis.kilimo.go.ke"
    
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
