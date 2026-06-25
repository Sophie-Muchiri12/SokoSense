"""
SokoSense — Neo4j Market Graph
Lucy Kamau · Data Layer Owner

Schema:
  (:Market {name, lat, lng, county})
  (:Crop   {name, swahili_name, unit})
  (:PricePoint {price_kes, trend, pct_change, date})

  (m:Market)-[:NEAR_TO {distance_km}]->(m2:Market)
  (m:Market)-[:HAS_PRICE]->(p:PricePoint)-[:FOR_CROP]->(c:Crop)
"""

import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# CONNECTION
# ---------------------------------------------------------------------------

def get_driver():
    uri      = os.getenv("NEO4J_URI")
    user     = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")
    if not uri or not password:
        raise RuntimeError("NEO4J_URI and NEO4J_PASSWORD must be set in .env")
    return GraphDatabase.driver(uri, auth=(user, password))


# ---------------------------------------------------------------------------
# SEED DATA
# ---------------------------------------------------------------------------

MARKETS = [
    {"name": "Nairobi",  "lat": -1.2864, "lng": 36.8172, "county": "Nairobi"},
    {"name": "Nakuru",   "lat": -0.3031, "lng": 36.0800, "county": "Nakuru"},
    {"name": "Eldoret",  "lat":  0.5143, "lng": 35.2698, "county": "Uasin Gishu"},
    {"name": "Kisumu",   "lat": -0.1022, "lng": 34.7617, "county": "Kisumu"},
    {"name": "Mombasa",  "lat": -4.0435, "lng": 39.6682, "county": "Mombasa"},
    {"name": "Kitale",   "lat":  1.0167, "lng": 35.0000, "county": "Trans Nzoia"},
    {"name": "Nyeri",    "lat": -0.4197, "lng": 36.9475, "county": "Nyeri"},
]

CROPS = [
    {"name": "maize",    "swahili_name": "mahindi",    "unit": "90kg bag"},
    {"name": "beans",    "swahili_name": "maharagwe",  "unit": "90kg bag"},
    {"name": "sorghum",  "swahili_name": "mtama",      "unit": "90kg bag"},
    {"name": "millet",   "swahili_name": "uwele",      "unit": "90kg bag"},
    {"name": "potatoes", "swahili_name": "viazi",      "unit": "110kg bag"},
    {"name": "tomatoes", "swahili_name": "nyanya",     "unit": "crate"},
]

# Distances in km between markets (key = frozenset of two market names)
DISTANCES = {
    ("Nairobi",  "Nakuru"):  157,
    ("Nairobi",  "Eldoret"): 313,
    ("Nairobi",  "Kisumu"):  349,
    ("Nairobi",  "Mombasa"): 480,
    ("Nairobi",  "Kitale"):  360,
    ("Nairobi",  "Nyeri"):    155,
    ("Nakuru",   "Eldoret"):  157,
    ("Nakuru",   "Kisumu"):   195,
    ("Nakuru",   "Kitale"):   196,
    ("Nakuru",   "Nyeri"):    115,
    ("Eldoret",  "Kitale"):    55,
    ("Eldoret",  "Kisumu"):   213,
    ("Kisumu",   "Kitale"):   190,
    ("Mombasa",  "Nairobi"):  480,
}

# Mock prices per market per crop (KSh)
PRICES = {
    "maize":    {"Nairobi": 3200, "Nakuru": 2900, "Eldoret": 3500,
                 "Kisumu":  3100, "Mombasa": 3300, "Kitale": 3400, "Nyeri": 3000},
    "beans":    {"Nairobi": 8500, "Nakuru": 8200, "Eldoret": 9100,
                 "Kisumu":  8400, "Mombasa": 8600, "Kitale": 9000, "Nyeri": 8300},
    "sorghum":  {"Nairobi": 4500, "Nakuru": 4300, "Eldoret": 4800,
                 "Kisumu":  4400, "Mombasa": 4600, "Kitale": 4700, "Nyeri": 4350},
    "millet":   {"Nairobi": 5200, "Nakuru": 5000, "Eldoret": 5500,
                 "Kisumu":  5100, "Mombasa": 5300, "Kitale": 5450, "Nyeri": 5050},
    "potatoes": {"Nairobi": 2800, "Nakuru": 2600, "Eldoret": 3100,
                 "Kisumu":  2700, "Mombasa": 2900, "Kitale": 3000, "Nyeri": 2650},
    "tomatoes": {"Nairobi": 6500, "Nakuru": 6200, "Eldoret": 7000,
                 "Kisumu":  6400, "Mombasa": 6600, "Kitale": 6800, "Nyeri": 6300},
}

# Weekly trend per market per crop
TRENDS = {
    "maize":    {"Nairobi": ("up", 5.2),    "Nakuru": ("up", 3.8),
                 "Eldoret": ("up", 6.1),    "Kisumu": ("flat", 0.5),
                 "Mombasa": ("up", 4.4),    "Kitale": ("down", -2.1), "Nyeri": ("up", 4.0)},
    "beans":    {"Nairobi": ("up", 8.5),    "Nakuru": ("up", 6.2),
                 "Eldoret": ("flat", 1.1),  "Kisumu": ("down", -3.2),
                 "Mombasa": ("up", 9.0),    "Kitale": ("down", -4.5), "Nyeri": ("up", 7.0)},
    "sorghum":  {"Nairobi": ("up", 4.5),    "Nakuru": ("flat", 0.8),
                 "Eldoret": ("up", 3.1),    "Kisumu": ("up", 5.0),
                 "Mombasa": ("up", 6.2),    "Kitale": ("up", 2.0),    "Nyeri": ("flat", 0.5)},
    "millet":   {"Nairobi": ("flat", 1.0),  "Nakuru": ("up", 2.5),
                 "Eldoret": ("up", 3.0),    "Kisumu": ("flat", 0.8),
                 "Mombasa": ("up", 1.5),    "Kitale": ("up", 2.8),    "Nyeri": ("down", -1.0)},
    "potatoes": {"Nairobi": ("down", -5.0), "Nakuru": ("down", -6.3),
                 "Eldoret": ("flat", 0.3),  "Kisumu": ("up", 3.2),
                 "Mombasa": ("up", 5.5),    "Kitale": ("down", -7.0), "Nyeri": ("down", -4.0)},
    "tomatoes": {"Nairobi": ("up", 12.0),   "Nakuru": ("up", 9.5),
                 "Eldoret": ("flat", 1.0),  "Kisumu": ("up", 6.0),
                 "Mombasa": ("up", 14.0),   "Kitale": ("flat", -0.5), "Nyeri": ("up", 10.0)},
}


# ---------------------------------------------------------------------------
# SCHEMA + CONSTRAINTS
# ---------------------------------------------------------------------------

def create_schema(tx):
    tx.run("CREATE CONSTRAINT market_name IF NOT EXISTS FOR (m:Market) REQUIRE m.name IS UNIQUE")
    tx.run("CREATE CONSTRAINT crop_name IF NOT EXISTS FOR (c:Crop) REQUIRE c.name IS UNIQUE")
    tx.run("CREATE INDEX market_name_idx IF NOT EXISTS FOR (m:Market) ON (m.name)")
    tx.run("CREATE INDEX crop_name_idx IF NOT EXISTS FOR (c:Crop) ON (c.name)")


# ---------------------------------------------------------------------------
# LOADERS
# ---------------------------------------------------------------------------

def load_markets(tx):
    for m in MARKETS:
        tx.run(
            """
            MERGE (m:Market {name: $name})
            SET m.lat = $lat, m.lng = $lng, m.county = $county
            """,
            **m
        )


def load_crops(tx):
    for c in CROPS:
        tx.run(
            """
            MERGE (c:Crop {name: $name})
            SET c.swahili_name = $swahili_name, c.unit = $unit
            """,
            **c
        )


def load_distances(tx):
    for (a, b), km in DISTANCES.items():
        tx.run(
            """
            MATCH (a:Market {name: $a}), (b:Market {name: $b})
            MERGE (a)-[r:NEAR_TO {distance_km: $km}]->(b)
            MERGE (b)-[r2:NEAR_TO {distance_km: $km}]->(a)
            """,
            a=a, b=b, km=km
        )


def load_prices(tx):
    from datetime import date
    today = date.today().isoformat()
    for crop_name, market_prices in PRICES.items():
        for market_name, price in market_prices.items():
            trend, pct = TRENDS.get(crop_name, {}).get(market_name, ("flat", 0.0))
            tx.run(
                """
                MATCH (m:Market {name: $market}), (c:Crop {name: $crop})
                MERGE (p:PricePoint {market: $market, crop: $crop})
                SET p.price_kes    = $price,
                    p.trend        = $trend,
                    p.pct_change   = $pct,
                    p.date         = $today
                MERGE (m)-[:HAS_PRICE]->(p)
                MERGE (p)-[:FOR_CROP]->(c)
                """,
                market=market_name, crop=crop_name,
                price=price, trend=trend, pct=pct, today=today
            )


# ---------------------------------------------------------------------------
# MAIN LOAD FUNCTION
# ---------------------------------------------------------------------------

def load_all():
    """Load entire graph — safe to run multiple times (uses MERGE)."""
    driver = get_driver()
    with driver.session() as session:
        print("Creating schema + indexes...")
        session.execute_write(create_schema)
        print("Loading markets...")
        session.execute_write(load_markets)
        print("Loading crops...")
        session.execute_write(load_crops)
        print("Loading NEAR_TO distances...")
        session.execute_write(load_distances)
        print("Loading price points...")
        session.execute_write(load_prices)
        print("Done. Graph loaded.")
    driver.close()


# ---------------------------------------------------------------------------
# VERIFY
# ---------------------------------------------------------------------------

def verify():
    """Quick sanity check — prints node counts."""
    driver = get_driver()
    with driver.session() as session:
        markets  = session.run("MATCH (m:Market) RETURN count(m) AS n").single()["n"]
        crops    = session.run("MATCH (c:Crop) RETURN count(c) AS n").single()["n"]
        prices   = session.run("MATCH (p:PricePoint) RETURN count(p) AS n").single()["n"]
        near_to  = session.run("MATCH ()-[r:NEAR_TO]->() RETURN count(r) AS n").single()["n"]
        print(f"Markets:      {markets}  (expected 7)")
        print(f"Crops:        {crops}    (expected 6)")
        print(f"PricePoints:  {prices}  (expected 42)")
        print(f"NEAR_TO rels: {near_to}")
    driver.close()


if __name__ == "__main__":
    load_all()
    verify()
