import urllib3
from typing import Optional
from langchain_core.tools import tool

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
    Queries the local KAMIS SQLite cache and returns the most recent price entries.
    IMPORTANT: Always use the default limit of 10. Do NOT pass a higher limit value.
    
    Args:
        crop_name: The name of the crop to filter by (e.g. 'Tomatoes', 'Maize', 'Beans'). Case-insensitive.
        market_name: Optional name of the market location to filter by (e.g. 'Maua', 'Kibuye'). Case-insensitive.
        county_name: Optional name of the county to filter by (e.g. 'Meru', 'Kakamega', 'Nairobi'). Case-insensitive.
        limit: Number of records to return. Maximum is 10. Do NOT change this value.
    """
    limit = min(limit, 10)

    try:
        from data.market_db import init_db, query_prices

        init_db()
        rows = query_prices(
            crop_name=crop_name,
            market_name=market_name,
            county_name=county_name,
            limit=limit,
        )
    except Exception as e:
        return f"An error occurred while reading cached KAMIS data: {str(e)}"

    if not rows:
        if market_name or county_name:
            return "There is no market found in that area."
        msg = "No cached price data found matching your query."
        if crop_name:
            msg += f" Crop: '{crop_name}'."
        return msg

    import json
    return json.dumps(rows, indent=2)
