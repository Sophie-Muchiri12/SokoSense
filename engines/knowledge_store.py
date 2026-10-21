"""Postgres + pgvector knowledge store for the advisory RAG pipeline.

The advisory knowledge — crops, the diseases that affect them, their
symptoms, remedies and best practices, plus embedded PDF document
chunks — lives in plain Postgres (Supabase):

    crops / diseases / crop_diseases   (see db/schema.sql)
    document_chunks.embedding vector(1536) with an HNSW cosine index

Usage:
    from engines.knowledge_store import KnowledgeStore
    store = KnowledgeStore()
    rows   = store.query_knowledge_graph("maize", "rust")
    chunks = store.vector_search("what causes leaf spots on tomatoes", top_k=5)

When ``DATABASE_URL`` is not configured (local dev / tests) the store
degrades gracefully: structured queries fall back to the in-code seed
knowledge in ``db.seed_data`` and vector search returns no chunks.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

import numpy as np
from dotenv import load_dotenv

from db import postgres
from db.seed_data import SEED_KNOWLEDGE

load_dotenv()

logger = logging.getLogger(__name__)

# Dimension of embeddings (1536). Production would use a real embedding API;
# development uses a deterministic hash-based fallback. Must match
# `embedding vector(1536)` in db/schema.sql.
VECTOR_DIMENSION = 1536


def get_embedding(text: str) -> list[float]:
    """Generate embedding vector for a text string.

    Uses a deterministic hash-based embedding for development when no
    embedding API is configured.
    """
    rng = np.random.default_rng(int(hashlib.md5(text.encode()).hexdigest()[:8], 16))
    return rng.uniform(-0.01, 0.01, VECTOR_DIMENSION).tolist()


def _vector_literal(embedding: list[float]) -> str:
    """Format a float list as a pgvector literal, e.g. '[0.1,0.2,...]'."""
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


class KnowledgeStore:
    """Postgres-backed advisory knowledge store."""

    def __init__(self) -> None:
        self._enabled = postgres.is_enabled()

    # ── structured knowledge (relational queries) ──────────────────────────

    def query_knowledge_graph(
        self, crop: str | None = None, disease: str | None = None
    ) -> list[dict[str, Any]]:
        """Retrieve crop/disease/symptom/remedy/practice rows.

        Returns a list of dicts with keys: crop, disease, symptom, remedy, practice.
        """
        if not self._enabled:
            return self._sample_data(crop, disease)
        try:
            with postgres.get_conn() as conn:
                rows = conn.execute(
                    """
                    SELECT c.name AS crop, d.name AS disease,
                           cd.symptom AS symptom, cd.remedy AS remedy,
                           cd.practice AS practice
                    FROM crop_diseases cd
                    JOIN crops c    ON c.id = cd.crop_id
                    JOIN diseases d ON d.id = cd.disease_id
                    WHERE (%(crop)s::text IS NULL
                           OR lower(c.name) LIKE '%%' || lower(%(crop)s::text) || '%%'
                           OR lower(%(crop)s::text) LIKE '%%' || lower(c.name) || '%%')
                      AND (%(disease)s::text IS NULL
                           OR lower(d.name) LIKE '%%' || lower(%(disease)s::text) || '%%'
                           OR lower(%(disease)s::text) LIKE '%%' || lower(d.name) || '%%')
                    LIMIT 25
                    """,
                    {"crop": crop, "disease": disease},
                ).fetchall()
            return [dict(r) for r in rows] or self._sample_data(crop, disease)
        except Exception as exc:
            logger.error("Knowledge query failed: %s", exc)
            return self._sample_data(crop, disease)

    def get_location_info(self, location: str) -> list[dict[str, Any]]:
        """Retrieve crops and advice associated with a location."""
        if not self._enabled:
            return []
        try:
            with postgres.get_conn() as conn:
                rows = conn.execute(
                    """
                    SELECT c.name AS crop, lc.practice AS practice
                    FROM locations loc
                    JOIN location_crops lc ON lc.location_id = loc.id
                    JOIN crops c ON c.id = lc.crop_id
                    WHERE lower(loc.name) = lower(%s)
                    LIMIT 15
                    """,
                    (location.title(),),
                ).fetchall()
            return [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Location query failed: %s", exc)
            return []

    def ingest_seed_data(self) -> str:
        """Populate Postgres with the Kenyan agricultural seed knowledge."""
        from db.seed import seed_knowledge

        return seed_knowledge()

    # ── vector storage (document_chunks + pgvector) ────────────────────────

    def store_embedding(
        self,
        chunk_id: str,
        text: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """Store a document chunk with its pgvector embedding."""
        if not self._enabled:
            logger.warning("Postgres not enabled — skipping storage of chunk %s", chunk_id)
            return False
        meta = metadata or {}
        # Postgres text cannot hold NUL bytes, which PDF extraction can emit.
        text = text.replace("\x00", "")
        try:
            with postgres.get_conn() as conn:
                conn.execute(
                    """
                    INSERT INTO document_chunks (id, text, pdf_name, page_num, chunk_idx, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s::vector)
                    ON CONFLICT (id) DO UPDATE SET
                        text = EXCLUDED.text, embedding = EXCLUDED.embedding,
                        pdf_name = EXCLUDED.pdf_name, page_num = EXCLUDED.page_num,
                        chunk_idx = EXCLUDED.chunk_idx
                    """,
                    (
                        chunk_id, text,
                        meta.get("pdf_name", ""), meta.get("page_num", 0),
                        meta.get("chunk_idx", 0), _vector_literal(embedding),
                    ),
                )
            return True
        except Exception as exc:
            logger.error("Failed to store embedding: %s", exc)
            return False

    def store_embeddings_batch(self, chunks: list[dict[str, Any]]) -> int:
        """Store multiple document chunks; returns count stored."""
        return sum(
            1
            for chunk in chunks
            if self.store_embedding(
                chunk_id=chunk["chunk_id"],
                text=chunk["text"],
                embedding=chunk["embedding"],
                metadata=chunk.get("metadata"),
            )
        )

    def clear_document_chunks(self) -> bool:
        """Delete all document chunks (used before a fresh PDF ingestion)."""
        if not self._enabled:
            return False
        try:
            with postgres.get_conn() as conn:
                conn.execute("DELETE FROM document_chunks")
            logger.info("Cleared all document_chunks rows.")
            return True
        except Exception as exc:
            logger.error("Failed to clear document chunks: %s", exc)
            return False

    # ── vector search (pgvector cosine distance) ────────────────────────────

    def vector_search(
        self, query_text: str, top_k: int = 5
    ) -> list[dict[str, Any]]:
        """Find document chunks most similar to the query (pgvector `<=>`).

        Returns dicts with keys: text, pdf_name, page_num, chunk_idx, score
        where score is cosine similarity (1 = identical).
        """
        if not self._enabled:
            logger.warning("Postgres not enabled — returning empty vector search results.")
            return []
        query_embedding = _vector_literal(get_embedding(query_text))
        try:
            with postgres.get_conn() as conn:
                rows = conn.execute(
                    """
                    SELECT text, pdf_name, page_num, chunk_idx,
                           1 - (embedding <=> %s::vector) AS score
                    FROM document_chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (query_embedding, query_embedding, top_k),
                ).fetchall()
            return [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Vector search failed: %s", exc)
            return []

    def close(self) -> None:
        """No persistent connection is held (per-call connections)."""

    # ── fallback sample data (no Postgres) ──────────────────────────────────

    @staticmethod
    def _sample_data(
        crop: str | None, disease: str | None
    ) -> list[dict[str, Any]]:
        """Return seed Kenyan farming knowledge when Postgres is unavailable."""
        rows = [
            {
                "crop": r["crop"], "disease": r["disease"],
                "symptom": r["symptom"], "remedy": r["remedy"],
                "practice": r["practice"],
            }
            for r in SEED_KNOWLEDGE
        ]
        matched = [
            r for r in rows
            if (crop is None or crop.lower() in r["crop"].lower())
            and (disease is None or disease.lower() in r["disease"].lower())
        ]
        return matched if matched else rows[:2]
