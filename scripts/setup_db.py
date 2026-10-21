"""Set up the SokoSense Postgres (Supabase) database.

Usage (with DATABASE_URL set in .env — see .env.example):
    python scripts/setup_db.py              # schema + seed knowledge
        python scripts/setup_db.py --ingest     # + ingest engines/data/*.pdf (pgvector)

Equivalent to running db/schema.sql in the Supabase SQL Editor, then
seeding. Safe to re-run (idempotent).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ingest", action="store_true",
                        help="Also ingest engines/data/*.pdf into document_chunks (pgvector)")
    args = parser.parse_args()

    from db import postgres

    if not postgres.database_url():
        print("DATABASE_URL is not set. For local dev: `docker compose up -d db` "
              "then copy .env.example → .env (it already points at the local "
              "container). In production set the Supabase connection string.")
        return 1

    print("Creating schema (pgvector + tables)…")
    if not postgres.init_db():
        print("Schema init failed — check DATABASE_URL / network.")
        return 1

    from db.seed import seed_knowledge

    print(seed_knowledge())

    if args.ingest:
        from engines.ingest_pdfs import main as ingest_main

        sys.argv = [sys.argv[0]]
        ingest_main()

    print(postgres.health())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
