"""Seed the advisory knowledge tables in Postgres from ``db.seed_data``."""

from __future__ import annotations

import logging

from db import postgres
from db.seed_data import SEED_KNOWLEDGE

logger = logging.getLogger(__name__)


def seed_knowledge() -> str:
    """Upsert crops/diseases/crop_diseases seed rows. Idempotent."""
    if not postgres.database_url():
        return "DATABASE_URL not configured — seed data not written."
    postgres.init_db()
    try:
        with postgres.get_conn() as conn:
            for row in SEED_KNOWLEDGE:
                conn.execute(
                    """
                    INSERT INTO crops (name, sci_name, type) VALUES (%s, %s, %s)
                    ON CONFLICT (name) DO UPDATE
                        SET sci_name = EXCLUDED.sci_name, type = EXCLUDED.type
                    """,
                    (row["crop"], row["sci_name"], row["type"]),
                )
                conn.execute(
                    """
                    INSERT INTO diseases (name, severity) VALUES (%s, %s)
                    ON CONFLICT (name) DO UPDATE SET severity = EXCLUDED.severity
                    """,
                    (row["disease"], row["severity"]),
                )
                conn.execute(
                    """
                    INSERT INTO crop_diseases (crop_id, disease_id, symptom, remedy, practice)
                    SELECT c.id, d.id, %s, %s, %s FROM crops c, diseases d
                    WHERE c.name = %s AND d.name = %s
                    ON CONFLICT (crop_id, disease_id) DO UPDATE
                        SET symptom = EXCLUDED.symptom,
                            remedy = EXCLUDED.remedy,
                            practice = EXCLUDED.practice
                    """,
                    (row["symptom"], row["remedy"], row["practice"],
                     row["crop"], row["disease"]),
                )
        return f"Seeded {len(SEED_KNOWLEDGE)} crop/disease entries into Postgres."
    except Exception as exc:  # pragma: no cover - network dependent
        logger.error("Seeding failed: %s", exc)
        return f"Seeding failed: {exc}"
