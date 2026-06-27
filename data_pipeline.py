"""
SokoSense — Data Pipeline
Lucy Kamau · Data Layer Owner

Provides get_trend() and get_best_market() — called by Job's engines.
Reads live from Neo4j graph instead of hardcoded mock dicts.
"""

from neo4j_graph import get_driver


def get_trend(crop: str, market: str) -> dict:
    """
    Returns price trend for a crop at a specific market.
    Called by engines/timing.py to replace the stub.

    Returns:
        {
            "crop": str,
            "market": str,
            "price_kes": float,
            "trend": "up" | "down" | "flat",
            "pct_change": float,
            "wait_days": int,        # derived from trend strength
        }
    """
    crop   = crop.strip().lower()
    market = market.strip().title()

    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (m:Market {name: $market})-[:HAS_PRICE]->(p:PricePoint)-[:FOR_CROP]->(c:Crop {name: $crop})
            RETURN p.price_kes AS price, p.trend AS trend, p.pct_change AS pct_change
            """,
            market=market, crop=crop
        ).single()
    driver.close()

    if not result:
        return {
            "crop": crop, "market": market,
            "price_kes": None, "trend": "flat",
            "pct_change": 0.0, "wait_days": 0,
        }

    trend      = result["trend"]
    pct_change = result["pct_change"]

    # Derive wait_days from trend strength — stronger rise = longer worth waiting
    if trend == "up" and pct_change >= 8:
        wait_days = 4
    elif trend == "up" and pct_change >= 4:
        wait_days = 3
    elif trend == "up":
        wait_days = 2
    else:
        wait_days = 0

    return {
        "crop": crop, "market": market,
        "price_kes": result["price"],
        "trend": trend, "pct_change": pct_change,
        "wait_days": wait_days,
    }


def get_best_market(crop: str, current_market: str) -> dict:
    """
    Finds the highest-paying nearby market for a crop, using NEAR_TO graph relationships.
    Called by engines/market.py to replace the stub mock prices.

    Returns:
        {
            "crop": str,
            "current_market": str,
            "current_price": float,
            "best_market": str,
            "best_price": float,
            "price_diff_kes": float,
            "distance_km": float,
        }
    """
    crop           = crop.strip().lower()
    current_market = current_market.strip().title()

    driver = get_driver()
    with driver.session() as session:
        # Get current market's price
        current = session.run(
            """
            MATCH (m:Market {name: $market})-[:HAS_PRICE]->(p:PricePoint)-[:FOR_CROP]->(c:Crop {name: $crop})
            RETURN p.price_kes AS price
            """,
            market=current_market, crop=crop
        ).single()

        # Walk NEAR_TO relationships to find best nearby price
        nearby = session.run(
            """
            MATCH (m:Market {name: $market})-[n:NEAR_TO]->(other:Market)
                  -[:HAS_PRICE]->(p:PricePoint)-[:FOR_CROP]->(c:Crop {name: $crop})
            RETURN other.name AS market, p.price_kes AS price, n.distance_km AS distance
            ORDER BY p.price_kes DESC
            LIMIT 1
            """,
            market=current_market, crop=crop
        ).single()
    driver.close()

    current_price = current["price"] if current else None

    if not nearby or not current_price:
        return {
            "crop": crop, "current_market": current_market,
            "current_price": current_price,
            "best_market": current_market, "best_price": current_price,
            "price_diff_kes": 0, "distance_km": 0,
        }

    best_price = nearby["price"]
    diff       = best_price - current_price

    return {
        "crop": crop, "current_market": current_market,
        "current_price": current_price,
        "best_market": nearby["market"] if diff > 0 else current_market,
        "best_price": best_price if diff > 0 else current_price,
        "price_diff_kes": max(diff, 0),
        "distance_km": nearby["distance"] if diff > 0 else 0,
    }


if __name__ == "__main__":
    # Quick manual test
    print("get_trend test:")
    print(get_trend("maize", "nakuru"))
    print()
    print("get_best_market test:")
    print(get_best_market("maize", "nakuru"))
