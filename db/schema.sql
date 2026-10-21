-- SokoSense — Supabase / Postgres schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) OR via
--   python scripts/setup_db.py
-- Safe to re-run: every statement is idempotent.

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Market prices ─────────────────────────────────────────────────────────
-- NOT in Postgres: the single source of truth is data/market_prices.csv
-- (built from KAMIS by scripts/collect_market_data.py). See data/market_csv.py.

-- ── User accounts (role-based auth: farmer / sacco; admin is PIN-only) ────
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('farmer', 'sacco')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Advisory knowledge base (crops / diseases / their relationships) ───────
CREATE TABLE IF NOT EXISTS crops (
    id       SERIAL PRIMARY KEY,
    name     TEXT NOT NULL UNIQUE,
    sci_name TEXT,
    type     TEXT
);

CREATE TABLE IF NOT EXISTS diseases (
    id       SERIAL PRIMARY KEY,
    name     TEXT NOT NULL UNIQUE,
    severity TEXT
);

-- One row per (crop, disease) pair, carrying the symptom / remedy /
-- practice facts for that pairing.
CREATE TABLE IF NOT EXISTS crop_diseases (
    crop_id    INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    disease_id INTEGER NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    symptom    TEXT,
    remedy     TEXT,
    practice   TEXT,
    PRIMARY KEY (crop_id, disease_id)
);

CREATE TABLE IF NOT EXISTS locations (
    id     SERIAL PRIMARY KEY,
    name   TEXT NOT NULL UNIQUE,
    county TEXT
);

CREATE TABLE IF NOT EXISTS location_crops (
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    crop_id     INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    practice    TEXT,
    PRIMARY KEY (location_id, crop_id)
);

-- ── RAG document chunks (pgvector) ──────────────────────────────────────────
-- 1536-dim dev embeddings (deterministic hash fallback, see
-- engines/knowledge_store.get_embedding). If you switch to a real embedding
-- model with a different dimension, change vector(1536) here and
-- VECTOR_DIMENSION in engines/knowledge_store.py, then re-ingest.
CREATE TABLE IF NOT EXISTS document_chunks (
    id         TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    pdf_name   TEXT,
    page_num   INTEGER,
    chunk_idx  INTEGER,
    embedding  vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- HNSW cosine index for pgvector semantic search.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks USING hnsw (embedding vector_cosine_ops);
