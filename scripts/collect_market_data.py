#!/usr/bin/env python3
"""Manually collect KAMIS market data into the SokoSense market CSV.

The CSV this builds (default ``data/market_prices.csv``) is the single
source of truth for every market-price read in the system — engines, the
market map, and the agent all read it, and nothing queries KAMIS live.

Usage:
    # Every commodity KAMIS lists → rebuild the whole CSV
    python scripts/collect_market_data.py

    # One commodity → refresh just its rows (top 10 most recent per
    # market/county) and merge them into the existing CSV
    python scripts/collect_market_data.py --commodity maize
    python scripts/collect_market_data.py --commodity "Dry Maize"

    # See what KAMIS offers without fetching anything
    python scripts/collect_market_data.py --list

The new CSV is written to a staging file and atomically swapped over the
old one only after it validates — the old file is removed from the
serving path at that moment. If KAMIS returns nothing, the command exits
non-zero and the old CSV keeps serving.

The admin portal's "Refresh market data" button runs this exact pipeline
(full mode) via POST /api/admin/market-refresh.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data.kamis_collect import discover_products, run_pipeline  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--commodity",
        help="Only collect this commodity (e.g. maize, 'Dry Maize', tomatoes). Default: all KAMIS commodities.",
    )
    parser.add_argument("--per-page", type=int, default=1500, help="KAMIS rows requested per product (default 1500).")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds between KAMIS requests (default 0.5).")
    parser.add_argument("--list", action="store_true", help="List the commodities KAMIS offers, then exit.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if args.list:
        for product in discover_products():
            print(f"{product['product_id']:>4}  {product['commodity']}")
        return 0

    def progress(info: dict) -> None:
        print(f"[{info['current']}/{info['total']}] {info['commodity']}…", flush=True)

    try:
        stats = run_pipeline(
            commodity=args.commodity,
            per_page=args.per_page,
            delay_seconds=args.delay,
            on_progress=progress,
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
