# Neo4j Integration Document

**Kenya AI Challenge — Neo4j Track**

Use this document with your prototype link, GitHub/source link, and Neo4j technical proof video on Oxbridge.  
**Recommended length:** 1 page · **Maximum:** 2 pages.  
No passwords, API keys, database credentials, connection strings, or sensitive personal data are included below.

---

## Project Name

**SokoSense** — Farmer Decision Engine for AgriFin

## Team Name

`[Type here — add on Oxbridge submission]`

## Selected Challenge Brief

**Kenya AI Challenge 2026 · AgriFin Track** — AI-powered market intelligence, credit scoring, and agronomic advisory for Kenyan smallholder farmers, SACCOs, and agribusinesses (SMS, USSD, and web demo).

### Submission links (add on Oxbridge)

| Item | Link |
|------|------|
| Live prototype | `[Add URL]` |
| GitHub / source | `[Add URL]` |
| Neo4j technical proof video | `[Add URL — you are handling separately]` |
| Technical deep-dive (optional) | `docs/NEO4J_INTEGRATION.md` in this repository |

---

## 1. How We Used Neo4j

Neo4j powers **SokoSense’s agricultural advisory (RAG) pipeline** — the feature that answers farmer questions about crops, pests, diseases, and practices.

When a farmer asks a question (via web `/advisory`, `POST /api/advisory`, or the LangGraph agent’s `answer_farmer_question` tool), the backend:

1. **Extracts** crop, disease, and location keywords from the query.
2. **Queries the Neo4j knowledge graph** for structured facts — which diseases affect a crop, their symptoms, remedies, and best practices.
3. **Runs vector search** over PDF guide chunks stored as `DocumentChunk` nodes (ingested from `engines/data/*.pdf`).
4. **Combines** graph context, vector context, and optional local weather (Open-Meteo).
5. **Synthesizes** a farmer-facing answer via the Featherless LLM, with `sources` citing graph rows and PDF pages.

Neo4j stores **relationships that matter for farming advice** (crop → disease → symptom/remedy), not just flat text. It also holds **semantic search** over extension-guide PDFs via a Neo4j 5.x vector index (`document_chunks`, 1536 dimensions, cosine similarity).

**What Neo4j does *not* power today:** market arbitrage, sell-timing, and loan risk engines — those use live **KAMIS** price data (`data/price_pipeline.py`), not Neo4j.

---

## 2. Why Neo4j Matters

Agricultural advisory is inherently **relational**. A farmer does not ask “list all diseases”; they ask “my maize has orange spots in Nakuru — what is it and what do I do?” That requires traversing:

- which **crops** are affected by which **diseases**,
- what **symptoms** distinguish them,
- which **remedies** and **best practices** apply,
- plus **location-relevant** context from ingested guides.

A relational table or document store can hold this data, but Neo4j makes **multi-hop reasoning and retrieval natural** — e.g. `(Crop)-[:AFFECTED_BY]->(Disease)-[:HAS_SYMPTOM]->(Symptom)` — without heavy joins. Pairing the property graph with a **vector index** on PDF chunks gives a practical hybrid RAG: structured Kenyan crop/disease facts plus semantic search over longer guide text.

For the product, this improves **advisory quality and trust**: answers are grounded in explicit graph paths and PDF sources returned in the API `sources` field, rather than a generic LLM guess. For SMS/USSD, the same pipeline runs through the agent tool, so one knowledge base serves web and messaging channels.

---

## 3. Graph Model

### Main Nodes

| Node type | What it represents |
|-----------|-------------------|
| `Crop` | Kenyan crops (e.g. Maize, Beans, Tomatoes, Potatoes, Kale) with properties such as `sci_name`, `type` |
| `Disease` | Crop diseases and pests (e.g. Maize Rust, Fall Armyworm, Late Blight) with `severity` |
| `Symptom` | Observable signs linked to a disease |
| `Remedy` | Treatment or control measures for a disease |
| `BestPractice` | Agronomic practices for a crop (spacing, rotation, irrigation, etc.) |
| `Location` | Kenyan locations; schema supports which crops grow where |
| `DocumentChunk` | Text chunk from an ingested PDF with `text`, `pdf_name`, `page_num`, `chunk_idx`, and `embedding` vector |

### Main Relationships

| Relationship | What it means |
|--------------|---------------|
| `(Crop)-[:AFFECTED_BY]->(Disease)` | A crop can suffer from this disease/pest |
| `(Disease)-[:HAS_SYMPTOM]->(Symptom)` | Observable signs of the disease |
| `(Disease)-[:TREATED_BY]->(Remedy)` | Recommended treatment or control |
| `(Crop)-[:HAS_PRACTICE]->(BestPractice)` | Recommended farming practice for the crop |
| `(Location)-[:GROWS]->(Crop)` | A location is associated with growing a crop |

### Optional properties (examples)

- `Crop.sci_name`, `Crop.type`
- `Disease.severity`
- `DocumentChunk.pdf_name`, `DocumentChunk.page_num`, `DocumentChunk.text`, `DocumentChunk.embedding`
- `Location.name` (county / region)

**Seed data:** `Neo4jClient.ingest_seed_data()` in `engines/neo4j_client.py` loads Kenyan crop/disease facts via Cypher (`_SEED_CYPHER` — 14 disease entries across maize, beans, tomatoes, potatoes).

**Supplementary module (not on live advisory path):** `neo4j_graph.py` models `(Market)-[:HAS_PRICE]->(PricePoint)-[:FOR_CROP]->(Crop)` for market arbitrage — present in the repo but **not** wired to the live market/timing engines (those use KAMIS).

---

## 4. Architecture / Integration

### Architecture flow

```
Farmer (web /advisory, SMS simulator, or POST /api/agent)
    → FastAPI backend (routes/advisory.py, engines/agent/tools.py)
    → engines/advisory.py (orchestration)
    → engines/neo4j_client.py
        ├─ query_knowledge_graph(crop, disease)   [Cypher on property graph]
        └─ vector_search(query, top_k=5)          [db.index.vector.queryNodes]
    → Neo4j AuraDB (live cloud instance via NEO4J_URI)
    → Featherless LLM + optional Open-Meteo weather
    → JSON answer + sources → user / SMS gateway
```

**Offline ingestion (separate workflow):**

```
engines/data/*.pdf → engines/ingest_pdfs.py → embeddings → DocumentChunk nodes in Neo4j
```

### Integration status

**Fully working** (advisory RAG path)

### Short explanation

With valid `NEO4J_URI`, `NEO4J_USER` / `NEO4J_USERNAME`, and `NEO4J_PASSWORD` in `.env`, the advisory API and agent tool connect to **Neo4j AuraDB**, query the knowledge graph, run vector search over ingested PDF chunks, and return grounded answers with sources. The web **Advisory** page (`/advisory`) calls the same `POST /api/advisory` endpoint.

**Incomplete / degraded behaviour:** if Aura is unreachable or credentials are missing, `Neo4jClient` falls back to in-memory sample graph data and empty vector results so the API still responds — answers are less grounded. PDF embeddings currently use a **development hash-based fallback** (Featherless embeddings endpoint disabled in code) until a production embedding API is configured. The separate market-price graph in `neo4j_graph.py` is **modeled in code only** and not used by live market/timing features.

---

## 5. Current Status

### Working

- Live connection to **Neo4j AuraDB** via official Python driver (`neo4j>=5.0.0`)
- Structured advisory graph: crops, diseases, symptoms, remedies, best practices
- Vector index `document_chunks` on `DocumentChunk.embedding` (1536-d, cosine)
- PDF ingestion script: `python engines/ingest_pdfs.py`
- Runtime retrieval in `engines/advisory.py` (graph + vector + weather + LLM)
- HTTP API: `POST /api/advisory`
- Agent integration: `answer_farmer_question` tool in `engines/agent/tools.py`
- Web UI: `/advisory` and references on home page and SMS simulator
- Graceful degradation when Neo4j is down (sample data fallback)

### Incomplete or simulated

- **Embeddings:** hash-based pseudo-embeddings in development; true semantic PDF similarity pending a working embedding API
- **Market graph** (`neo4j_graph.py`, `data_pipeline.py`): schema and seed loader exist; live market/timing engines use KAMIS instead
- **Location–crop graph:** schema supported; seed data focuses on crop–disease–remedy facts

### Next improvement

- Wire a production embedding provider for higher-quality vector retrieval over PDF guides
- Expand seed graph (more crops, counties, and `(Location)-[:GROWS]->(Crop)` edges)
- Optionally connect market-price nodes to live KAMIS ingestion for graph-based arbitrage queries
- Add automated health check exposing Neo4j connectivity status in `/health` or admin UI

---

## Reviewer checklist (maps to judging criteria)

| # | Question | Where to verify |
|---|----------|-----------------|
| 1 | Why is Neo4j useful? | **§2** — relational crop/disease/remedy knowledge + hybrid RAG |
| 2 | What data is stored as a graph? | **§3** — nodes, relationships, `DocumentChunk` vectors |
| 3 | Main nodes and relationships? | **§3** tables |
| 4 | How does the graph support the product? | **§1, §4** — advisory Q&A, agent tool, SMS-ready pipeline |
| 5 | Connected to a real feature? | `POST /api/advisory`, `/advisory` UI, agent `answer_farmer_question` |
| 6 | Database real and active? | Neo4j AuraDB; configure `.env` from `.env.example`; run ingestion + advisory test below |
| 7 | Proof video shows DB working? | `[Your video — add link on Oxbridge]` |
| 8 | Code, docs, proof easy to find? | This file + `docs/NEO4J_INTEGRATION.md` + table below |

### Key code and files

| File | Role |
|------|------|
| `engines/neo4j_client.py` | Aura connection, Cypher queries, vector index, seed data, embeddings |
| `engines/advisory.py` | RAG orchestration (graph + vector + weather + LLM) |
| `engines/ingest_pdfs.py` | PDF → `DocumentChunk` ingestion |
| `engines/data/*.pdf` | Source agricultural guides |
| `routes/advisory.py` | `POST /api/advisory` |
| `engines/agent/tools.py` | Agent tool wrapping advisory |
| `frontend/src/routes/advisory.tsx` | Web advisory UI |
| `neo4j_graph.py` | Supplementary market graph (not on live engine path) |
| `.env.example` | `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` |

### Quick verification (no secrets in this doc)

1. Copy `.env.example` → `.env` and set Neo4j Aura credentials.
2. Seed graph (optional): `python -c "from engines.neo4j_client import Neo4jClient; print(Neo4jClient().ingest_seed_data())"`
3. Ingest PDFs: `python engines/ingest_pdfs.py`
4. Start backend: `./scripts/dev.sh` (or `uvicorn main:app`)
5. Test: `POST /api/advisory` with body `{"query": "What causes maize rust in Nakuru?"}`
6. Confirm response `sources` includes knowledge-base and/or PDF references when Aura is connected.

---

*Before submitting: ensure this document matches your prototype, GitHub/source link, and Neo4j technical proof video on Oxbridge.*
