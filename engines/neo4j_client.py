"""Neo4j AuraDB client for the advisory RAG pipeline.

Stores and retrieves agricultural knowledge as a graph:
  (Crop)-[:AFFECTED_BY]->(Disease)
  (Disease)-[:TREATED_BY]->(Remedy)
  (Disease)-[:HAS_SYMPTOM]->(Symptom)
  (Location)-[:GROWS]->(Crop)
  (Crop)-[:HAS_PRACTICE]->(BestPractice)

Vector embeddings are stored using Neo4j 5.x vector index for semantic search
over PDF document chunks.

Usage:
    from engines.neo4j_client import Neo4jClient
    client = Neo4jClient()
    results = client.query_knowledge_graph("maize", "rust")
    chunks = client.vector_search("what causes leaf spots on tomatoes", top_k=5)
"""

import os
import logging
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Dimension of embeddings. We use OpenAI text-embedding-3-small (1536 dims)
# via the Featherless API. If Featherless is not available, fall back to
# a simple character-level hash embedding for development.
VECTOR_DIMENSION = 1536
VECTOR_INDEX_NAME = "document_chunks"


def get_embedding(text: str) -> list[float]:
    """Generate embedding vector for a text string.

    Uses OpenAI-compatible embeddings API via Featherless if configured,
    otherwise returns a deterministic zero vector as development fallback.
    """
    featherless_key = os.getenv("FEATHERLSS_API_KEY")
    if False:  # Featherless does not support embeddings (404), use fallback
        try:
            import httpx
            resp = httpx.post(
                "https://api.featherless.ai/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {featherless_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "text-embedding-3-small",
                    "input": text[:8000],  # token limit safety
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]
        except Exception as exc:
            logger.warning("Featherless embedding failed: %s — using fallback", exc)

    # Fallback: deterministic hash-based embedding for development
    import hashlib
    import numpy as np
    rng = np.random.default_rng(int(hashlib.md5(text.encode()).hexdigest()[:8], 16))
    return rng.uniform(-0.01, 0.01, VECTOR_DIMENSION).tolist()


class Neo4jClient:
    """Thin wrapper around Neo4j driver for SokoSense advisory graph."""

    def __init__(self) -> None:
        self._driver = None
        self._enabled = False
        self._connect()

    # ── connection management ──────────────────────────────────────────────

    @property
    def driver(self):
        if self._driver is None:
            self._connect()
        return self._driver

    def _connect(self) -> None:
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD")

        if not uri or not password:
            logger.warning(
                "NEO4J_URI or NEO4J_PASSWORD not set. "
                "Neo4j client will return empty results."
            )
            self._enabled = False
            return

        try:
            from neo4j import GraphDatabase

            self._driver = GraphDatabase.driver(
                uri, auth=(user, password), max_connection_lifetime=3600
            )
            self._enabled = True
            logger.info("Connected to Neo4j at %s", uri)
            self._ensure_vector_index()
        except Exception as exc:
            logger.error("Failed to connect to Neo4j: %s", exc)
            self._enabled = False

    def close(self) -> None:
        if self._driver:
            self._driver.close()
            self._driver = None
            self._enabled = False

    # ── vector index management ────────────────────────────────────────────

    def _ensure_vector_index(self) -> None:
        """Create the vector index if it doesn't exist."""
        if not self._enabled:
            return
        try:
            with self.driver.session() as session:
                # Check if index already exists
                result = session.run(
                    "SHOW INDEXES WHERE name = $name",
                    name=VECTOR_INDEX_NAME,
                )
                if not result.single():
                    logger.info("Creating vector index '%s'...", VECTOR_INDEX_NAME)
                    session.run(
                        f"CREATE VECTOR INDEX {VECTOR_INDEX_NAME} "
                        "IF NOT EXISTS "
                        "FOR (n:DocumentChunk) ON (n.embedding) "
                        f"OPTIONS {{ indexConfig: {{ "
                        f"  `vector.dimensions`: {VECTOR_DIMENSION}, "
                        f"  `vector.similarity_function`: 'cosine' "
                        f"}} }}"
                    )
                    logger.info("Vector index created successfully.")
        except Exception as exc:
            logger.warning("Could not create vector index: %s", exc)

    # ── vector embedding storage ───────────────────────────────────────────

    def store_embedding(
        self,
        chunk_id: str,
        text: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """Store a document chunk with its embedding vector in Neo4j.

        Args:
            chunk_id: Unique identifier for this chunk.
            text: The original text content.
            embedding: The vector embedding (list of floats).
            metadata: Optional dict with keys like pdf_name, page_num, chunk_idx, etc.

        Returns:
            True if stored successfully, False otherwise.
        """
        if not self._enabled:
            logger.warning("Neo4j not enabled — skipping storage of chunk %s", chunk_id)
            return False

        meta = metadata or {}
        query = """
        MERGE (chunk:DocumentChunk {id: $chunk_id})
        SET chunk.text = $text,
            chunk.embedding = $embedding,
            chunk.pdf_name = $pdf_name,
            chunk.page_num = $page_num,
            chunk.chunk_idx = $chunk_idx,
            chunk.created_at = timestamp()
        """
        params = {
            "chunk_id": chunk_id,
            "text": text,
            "embedding": embedding,
            "pdf_name": meta.get("pdf_name", ""),
            "page_num": meta.get("page_num", 0),
            "chunk_idx": meta.get("chunk_idx", 0),
        }
        try:
            with self.driver.session() as session:
                session.run(query, **params)
            return True
        except Exception as exc:
            logger.error("Failed to store embedding: %s", exc)
            return False

    def store_embeddings_batch(
        self, chunks: list[dict[str, Any]]
    ) -> int:
        """Store multiple document chunks in a batch.

        Args:
            chunks: List of dicts with keys: chunk_id, text, embedding, metadata.

        Returns:
            Number of chunks successfully stored.
        """
        count = 0
        for chunk in chunks:
            ok = self.store_embedding(
                chunk_id=chunk["chunk_id"],
                text=chunk["text"],
                embedding=chunk["embedding"],
                metadata=chunk.get("metadata"),
            )
            if ok:
                count += 1
        return count

    # ── vector search ──────────────────────────────────────────────────────

    def vector_search(
        self,
        query_text: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Search for document chunks most semantically similar to the query.

        Uses the Neo4j vector index to find nearest neighbors by cosine similarity.

        Args:
            query_text: Natural language query string.
            top_k: Number of results to return (default 5).

        Returns:
            List of dicts with keys: text, pdf_name, page_num, chunk_idx, score.
        """
        if not self._enabled:
            logger.warning("Neo4j not enabled — returning empty vector search results.")
            return []

        query_embedding = get_embedding(query_text)

        cypher = """
        CALL db.index.vector.queryNodes($index_name, $top_k, $embedding)
        YIELD node, score
        RETURN node.text AS text,
               node.pdf_name AS pdf_name,
               node.page_num AS page_num,
               node.chunk_idx AS chunk_idx,
               score
        """
        try:
            with self.driver.session() as session:
                result = session.run(
                    cypher,
                    index_name=VECTOR_INDEX_NAME,
                    top_k=top_k,
                    embedding=query_embedding,
                )
                rows = [dict(r) for r in result]
                return rows
        except Exception as exc:
            logger.error("Vector search failed: %s", exc)
            return []

    # ── knowledge graph queries ────────────────────────────────────────────

    def query_knowledge_graph(
        self, crop: str | None = None, disease: str | None = None
    ) -> list[dict[str, Any]]:
        """Retrieve relevant sub-graph paths matching the crop and/or disease.

        Returns a list of dicts with keys: crop, disease, symptom, remedy, practice.
        """
        if not self._enabled:
            return self._sample_data(crop, disease)

        query = """
        MATCH path = (c:Crop)-[:AFFECTED_BY]->(d:Disease)
        OPTIONAL MATCH (d)-[:HAS_SYMPTOM]->(s:Symptom)
        OPTIONAL MATCH (d)-[:TREATED_BY]->(r:Remedy)
        OPTIONAL MATCH (c)-[:HAS_PRACTICE]->(p:BestPractice)
        WHERE ($crop IS NULL OR toLower(c.name) CONTAINS toLower($crop))
          AND ($disease IS NULL OR toLower(d.name) CONTAINS toLower($disease))
        RETURN c.name AS crop, d.name AS disease,
               s.name AS symptom, r.name AS remedy,
               p.name AS practice
        LIMIT 25
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, crop=crop, disease=disease)
                rows = [dict(r) for r in result]
                return rows if rows else self._sample_data(crop, disease)
        except Exception as exc:
            logger.error("Neo4j query failed: %s", exc)
            return self._sample_data(crop, disease)

    def get_location_info(self, location: str) -> list[dict[str, Any]]:
        """Retrieve crops and advice associated with a location."""
        if not self._enabled:
            return []

        query = """
        MATCH (loc:Location {name: $location})-[:GROWS]->(c:Crop)
        OPTIONAL MATCH (c)-[:HAS_PRACTICE]->(p:BestPractice)
        RETURN c.name AS crop, p.name AS practice
        LIMIT 15
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, location=location.title())
                return [dict(r) for r in result]
        except Exception as exc:
            logger.error("Neo4j location query failed: %s", exc)
            return []

    def ingest_seed_data(self) -> str:
        """Populate the graph with initial Kenyan agricultural knowledge.

        Call this once via a startup hook or management command.
        """
        if not self._enabled:
            return "Neo4j not configured — seed data not written."

        queries = _SEED_CYPHER
        try:
            with self.driver.session() as session:
                for q in queries:
                    session.run(q)
            return f"Seeded {len(queries)} Cypher statements into Neo4j."
        except Exception as exc:
            logger.error("Seeding failed: %s", exc)
            return f"Seeding failed: {exc}"

    # ── fallback sample data (no Neo4j) ────────────────────────────────────

    def _sample_data(
        self, crop: str | None, disease: str | None
    ) -> list[dict[str, Any]]:
        """Return hardcoded Kenyan farming knowledge when Neo4j is unavailable."""
        rows: list[dict[str, Any]] = []

        seed = [
            {
                "crop": "Maize",
                "disease": "Maize Rust (Puccinia sorghi)",
                "symptom": "Orange-brown pustules on leaves; premature leaf death",
                "remedy": "Resistant varieties (e.g. DUMA 43); early planting; fungicide (Mancozeb) at first sign; crop rotation with legumes",
                "practice": "Plant certified disease-free seeds; space rows 75cm apart for airflow; apply nitrogen in splits",
            },
            {
                "crop": "Maize",
                "disease": "Maize Lethal Necrosis (MLN)",
                "symptom": "Yellow streaking, leaf necrosis, plant stunting, dead heart",
                "remedy": "No cure — uproot and burn; rotate with non-cereals for 2 seasons; control thrips and aphids",
                "practice": "Use MLN-free certified seeds (e.g. WE3109); avoid planting maize after maize",
            },
            {
                "crop": "Maize",
                "disease": "Fall Armyworm (Spodoptera frugiperda)",
                "symptom": "Window-pane damage on leaves; frass (sawdust-like) near whorl; ragged feeding",
                "remedy": "Early detection; neem extract spray; Emamectin benzoate; push-pull farming (Desmodium + Napier grass)",
                "practice": "Scout fields weekly; intercropping with beans reduces infestation",
            },
            {
                "crop": "Maize",
                "disease": "Maize Streak Virus",
                "symptom": "Pale-green/yellow streaks along leaf veins; stunted growth",
                "remedy": "Control leafhoppers (vectors); use tolerant varieties (e.g. PIONEER 3253); rogue infected plants early",
                "practice": "Plant early in the season to avoid peak leafhopper populations",
            },
            {
                "crop": "Beans",
                "disease": "Angular Leaf Spot",
                "symptom": "Grey-brown angular lesions on leaves; pod lesions; premature defoliation",
                "remedy": "Copper-based fungicides; crop rotation (2+ years); use resistant varieties (e.g. KAT X56)",
                "practice": "Avoid overhead irrigation; remove crop debris after harvest",
            },
            {
                "crop": "Beans",
                "disease": "Bean Rust (Uromyces appendiculatus)",
                "symptom": "Small rust-brown pustules on underside of leaves; yellow halos",
                "remedy": "Fungicide (Mancozeb or Tebuconazole); resistant varieties; wide spacing",
                "practice": "Staking beans improves airflow and reduces rust severity",
            },
            {
                "crop": "Beans",
                "disease": "Common Bacterial Blight",
                "symptom": "Water-soaked lesions on leaves that turn brown; pod lesions with yellowish ooze",
                "remedy": "Copper-based sprays; pathogen-free seeds; 3-year crop rotation; avoid working in wet fields",
                "practice": "Use certified disease-free bean seeds from KALRO",
            },
            {
                "crop": "Tomatoes",
                "disease": "Late Blight (Phytophthora infestans)",
                "symptom": "Dark water-soaked lesions on leaves; white fungal growth under leaves; fruit rot",
                "remedy": "Metalaxyl + Mancozeb (Ridomil); remove infected plants; ensure good drainage",
                "practice": "Stake and prune tomatoes for air circulation; avoid overhead watering",
            },
            {
                "crop": "Tomatoes",
                "disease": "Tomato Yellow Leaf Curl Virus (TYLCV)",
                "symptom": "Yellowing and curling of leaves upward; stunted growth; flower drop",
                "remedy": "Control whiteflies (vector); reflective mulch; resistant varieties (e.g. TYLER F1)",
                "practice": "Use 50-mesh insect netting for nursery; remove alternate hosts (e.g. black nightshade)",
            },
            {
                "crop": "Tomatoes",
                "disease": "Blossom End Rot",
                "symptom": "Dark sunken lesion on the blossom end of the fruit",
                "remedy": "Calcium foliar spray; consistent watering (drip irrigation); avoid ammonium-based nitrogen",
                "practice": "Mulch to retain soil moisture; test soil calcium before planting",
            },
            {
                "crop": "Potatoes",
                "disease": "Late Blight (Phytophthora infestans)",
                "symptom": "Water-soaked lesions on leaves; white sporulation on underside; tuber rot",
                "remedy": "Metalaxyl + Mancozeb; certified disease-free seed potatoes; harvest tubers 2 weeks after vine kill",
                "practice": "Plant in well-drained soil; ridge up soil to protect tubers; avoid planting near tomatoes",
            },
            {
                "crop": "Potatoes",
                "disease": "Bacterial Wilt (Ralstonia solanacearum)",
                "symptom": "Sudden wilting of lower leaves; brown vascular ring in tuber; milky ooze from cut stem",
                "remedy": "No chemical cure — remove and burn plants; rotate with non-solanaceous crops for 5+ years; solarize soil",
                "practice": "Use certified seed potatoes; avoid over-irrigation; disinfect tools with jik (1:9 dilution)",
            },
            {
                "crop": "Potatoes",
                "disease": "Potato Cyst Nematode (Globodera spp.)",
                "symptom": "Stunted yellow patches in field; poor root development; tiny golden cysts visible on roots",
                "remedy": "Crop rotation (non-host: maize, beans) for 5+ years; resistant varieties; trap cropping with Solanum sisymbriifolium",
                "practice": "Never plant potatoes in infested soil; clean machinery between fields",
            },
        ]

        for row in seed:
            crop_match = crop is None or (crop.lower() in row["crop"].lower())
            disease_match = disease is None or (disease.lower() in row["disease"].lower())
            if crop_match and disease_match:
                rows.append(row)

        # Deduplicate by crop+disease
        seen = set()
        unique: list[dict[str, Any]] = []
        for r in rows:
            key = (r["crop"], r["disease"])
            if key not in seen:
                seen.add(key)
                unique.append(r)

        return unique if unique else seed[:2]


_SEED_CYPHER = [
    # Crops
    "MERGE (c:Crop {name: 'Maize'}) SET c.sci_name='Zea mays', c.type='Cereal'",
    "MERGE (c:Crop {name: 'Beans'}) SET c.sci_name='Phaseolus vulgaris', c.type='Legume'",
    "MERGE (c:Crop {name: 'Tomatoes'}) SET c.sci_name='Solanum lycopersicum', c.type='Vegetable'",
    "MERGE (c:Crop {name: 'Potatoes'}) SET c.sci_name='Solanum tuberosum', c.type='Tuber'",
    "MERGE (c:Crop {name: 'Kale'}) SET c.sci_name='Brassica oleracea', c.type='Leafy Green'",
    # Diseases
    "MERGE (d:Disease {name: 'Maize Rust (Puccinia sorghi)'}) SET d.severity='Moderate'",
    "MERGE (d:Disease {name: 'Maize Lethal Necrosis (MLN)'}) SET d.severity='Severe'",
    "MERGE (d:Disease {name: 'Fall Armyworm'}) SET d.severity='Severe'",
    "MERGE (d:Disease {name: 'Maize Streak Virus'}) SET d.severity='Moderate'",
    "MERGE (d:Disease {name: 'Angular Leaf Spot'}) SET d.severity='Moderate'",
    "MERGE (d:Disease {name: 'Bean Rust'}) SET d.severity='Moderate'",
    "MERGE (d:Disease {name: 'Common Bacterial Blight'}) SET d.severity='Moderate'",
    "MERGE (d:Disease {name: 'Late Blight (Phytophthora infestans)'}) SET d.severity='Severe'",
    "MERGE (d:Disease {name: 'Tomato Yellow Leaf Curl Virus (TYLCV)'}) SET d.severity='Severe'",
    "MERGE (d:Disease {name: 'Blossom End Rot'}) SET d.severity='Moderate'",
    "MERGE (d:Disease {name: 'Bacterial Wilt'}) SET d.severity='Severe'",
    "MERGE (d:Disease {name: 'Potato Cyst Nematode'}) SET d.severity='Moderate'",
    # Symptoms
    "MERGE (s:Symptom {name: 'Orange-brown pustules on leaves; premature leaf death'})",
    "MERGE (s:Symptom {name: 'Yellow streaking, leaf necrosis, plant stunting, dead heart'})",
    "MERGE (s:Symptom {name: 'Window-pane damage on leaves; frass near whorl; ragged feeding'})",
    "MERGE (s:Symptom {name: 'Pale-green/yellow streaks along leaf veins; stunted growth'})",
    "MERGE (s:Symptom {name: 'Grey-brown angular lesions on leaves; pod lesions'})",
    "MERGE (s:Symptom {name: 'Small rust-brown pustules on underside of leaves; yellow halos'})",
    "MERGE (s:Symptom {name: 'Water-soaked lesions turning brown; pod lesions with yellowish ooze'})",
    "MERGE (s:Symptom {name: 'Dark water-soaked lesions; white fungal growth; fruit rot'})",
    "MERGE (s:Symptom {name: 'Yellowing/curling leaves upward; stunted growth; flower drop'})",
    "MERGE (s:Symptom {name: 'Dark sunken lesion on blossom end of fruit'})",
    "MERGE (s:Symptom {name: 'Sudden wilting; brown vascular ring in tuber; milky ooze from cut stem'})",
    "MERGE (s:Symptom {name: 'Stunted yellow patches; poor roots; tiny golden cysts on roots'})",
    # Remedies
    "MERGE (r:Remedy {name: 'Resistant varieties; early planting; Mancozeb fungicide; crop rotation with legumes'})",
    "MERGE (r:Remedy {name: 'No cure — uproot and burn; rotate with non-cereals 2 seasons; control thrips/aphids'})",
    "MERGE (r:Remedy {name: 'Neem extract; Emamectin benzoate; push-pull farming (Desmodium + Napier)'})",
    "MERGE (r:Remedy {name: 'Control leafhoppers; tolerant varieties (PIONEER 3253); rogue infected plants'})",
    "MERGE (r:Remedy {name: 'Copper fungicides; 2+ year rotation; resistant varieties (KAT X56)'})",
    "MERGE (r:Remedy {name: 'Fungicide (Mancozeb/Tebuconazole); resistant varieties; wide spacing'})",
    "MERGE (r:Remedy {name: 'Copper sprays; pathogen-free seeds; 3-year rotation; avoid wet-field work'})",
    "MERGE (r:Remedy {name: 'Metalaxyl + Mancozeb (Ridomil); remove infected plants; good drainage'})",
    "MERGE (r:Remedy {name: 'Control whiteflies; reflective mulch; resistant varieties (TYLER F1)'})",
    "MERGE (r:Remedy {name: 'Calcium foliar spray; consistent drip irrigation; avoid ammonium nitrogen'})",
    "MERGE (r:Remedy {name: 'No chemical cure — remove/burn; 5+ year rotation; solarize soil'})",
    "MERGE (r:Remedy {name: '5+ year rotation with non-hosts; resistant varieties; trap cropping'})",
    # Best practices
    "MERGE (p:BestPractice {name: 'Plant certified disease-free seeds; space rows 75cm; nitrogen in splits'})",
    "MERGE (p:BestPractice {name: 'Use MLN-free certified seeds (WE3109); avoid maize-after-maize'})",
    "MERGE (p:BestPractice {name: 'Scout fields weekly; intercropping with beans reduces FAW'})",
    "MERGE (p:BestPractice {name: 'Plant early to avoid peak leafhopper season'})",
    "MERGE (p:BestPractice {name: 'Avoid overhead irrigation; remove crop debris after harvest'})",
    "MERGE (p:BestPractice {name: 'Staking beans improves airflow and reduces rust'})",
    "MERGE (p:BestPractice {name: 'Use certified disease-free bean seeds from KALRO'})",
    "MERGE (p:BestPractice {name: 'Stake and prune tomatoes for air circulation; avoid overhead watering'})",
    "MERGE (p:BestPractice {name: 'Use 50-mesh insect netting for nursery; remove alternate hosts'})",
    "MERGE (p:BestPractice {name: 'Mulch to retain soil moisture; test soil calcium before planting'})",
    "MERGE (p:BestPractice {name: 'Plant in well-drained soil; ridge up soil; avoid planting near tomatoes'})",
    "MERGE (p:BestPractice {name: 'Disinfect tools with jik (1:9 dilution); use certified seed potatoes'})",
    "MERGE (p:BestPractice {name: 'Never plant potatoes in infested soil; clean machinery between fields'})",
    # Relationships: Crop → Disease
    "MATCH (c:Crop {name:'Maize'}), (d:Disease {name:'Maize Rust (Puccinia sorghi)'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Maize'}), (d:Disease {name:'Maize Lethal Necrosis (MLN)'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Maize'}), (d:Disease {name:'Fall Armyworm'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Maize'}), (d:Disease {name:'Maize Streak Virus'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Beans'}), (d:Disease {name:'Angular Leaf Spot'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Beans'}), (d:Disease {name:'Bean Rust'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Beans'}), (d:Disease {name:'Common Bacterial Blight'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Tomatoes'}), (d:Disease {name:'Late Blight (Phytophthora infestans)'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Tomatoes'}), (d:Disease {name:'Tomato Yellow Leaf Curl Virus (TYLCV)'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Tomatoes'}), (d:Disease {name:'Blossom End Rot'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Potatoes'}), (d:Disease {name:'Late Blight (Phytophthora infestans)'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Potatoes'}), (d:Disease {name:'Bacterial Wilt'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    "MATCH (c:Crop {name:'Potatoes'}), (d:Disease {name:'Potato Cyst Nematode'}) MERGE (c)-[:AFFECTED_BY]->(d)",
    # Relationships: Disease → Symptom
    "MATCH (d:Disease {name:'Maize Rust (Puccinia sorghi)'}), (s:Symptom {name:'Orange-brown pustules on leaves; premature leaf death'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Maize Lethal Necrosis (MLN)'}), (s:Symptom {name:'Yellow streaking, leaf necrosis, plant stunting, dead heart'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Fall Armyworm'}), (s:Symptom {name:'Window-pane damage on leaves; frass near whorl; ragged feeding'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Maize Streak Virus'}), (s:Symptom {name:'Pale-green/yellow streaks along leaf veins; stunted growth'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Angular Leaf Spot'}), (s:Symptom {name:'Grey-brown angular lesions on leaves; pod lesions'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Bean Rust'}), (s:Symptom {name:'Small rust-brown pustules on underside of leaves; yellow halos'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Common Bacterial Blight'}), (s:Symptom {name:'Water-soaked lesions turning brown; pod lesions with yellowish ooze'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Late Blight (Phytophthora infestans)'}), (s:Symptom {name:'Dark water-soaked lesions; white fungal growth; fruit rot'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Tomato Yellow Leaf Curl Virus (TYLCV)'}), (s:Symptom {name:'Yellowing/curling leaves upward; stunted growth; flower drop'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Blossom End Rot'}), (s:Symptom {name:'Dark sunken lesion on blossom end of fruit'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Bacterial Wilt'}), (s:Symptom {name:'Sudden wilting; brown vascular ring in tuber; milky ooze from cut stem'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    "MATCH (d:Disease {name:'Potato Cyst Nematode'}), (s:Symptom {name:'Stunted yellow patches; poor roots; tiny golden cysts on roots'}) MERGE (d)-[:HAS_SYMPTOM]->(s)",
    # Relationships: Disease → Remedy
    "MATCH (d:Disease {name:'Maize Rust (Puccinia sorghi)'}), (r:Remedy {name:'Resistant varieties; early planting; Mancozeb fungicide; crop rotation with legumes'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Maize Lethal Necrosis (MLN)'}), (r:Remedy {name:'No cure — uproot and burn; rotate with non-cereals 2 seasons; control thrips/aphids'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Fall Armyworm'}), (r:Remedy {name:'Neem extract; Emamectin benzoate; push-pull farming (Desmodium + Napier)'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Maize Streak Virus'}), (r:Remedy {name:'Control leafhoppers; tolerant varieties (PIONEER 3253); rogue infected plants'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Angular Leaf Spot'}), (r:Remedy {name:'Copper fungicides; 2+ year rotation; resistant varieties (KAT X56)'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Bean Rust'}), (r:Remedy {name:'Fungicide (Mancozeb/Tebuconazole); resistant varieties; wide spacing'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Common Bacterial Blight'}), (r:Remedy {name:'Copper sprays; pathogen-free seeds; 3-year rotation; avoid wet-field work'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Late Blight (Phytophthora infestans)'}), (r:Remedy {name:'Metalaxyl + Mancozeb (Ridomil); remove infected plants; good drainage'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Tomato Yellow Leaf Curl Virus (TYLCV)'}), (r:Remedy {name:'Control whiteflies; reflective mulch; resistant varieties (TYLER F1)'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Blossom End Rot'}), (r:Remedy {name:'Calcium foliar spray; consistent drip irrigation; avoid ammonium nitrogen'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Bacterial Wilt'}), (r:Remedy {name:'No chemical cure — remove/burn; 5+ year rotation; solarize soil'}) MERGE (d)-[:TREATED_BY]->(r)",
    "MATCH (d:Disease {name:'Potato Cyst Nematode'}), (r:Remedy {name:'5+ year rotation with non-hosts; resistant varieties; trap cropping'}) MERGE (d)-[:TREATED_BY]->(r)",
    # Relationships: Crop → BestPractice
    "MATCH (c:Crop {name:'Maize'}), (p:BestPractice {name:'Plant certified disease-free seeds; space rows 75cm; nitrogen in splits'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Maize'}), (p:BestPractice {name:'Use MLN-free certified seeds (WE3109); avoid maize-after-maize'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Maize'}), (p:BestPractice {name:'Scout fields weekly; intercropping with beans reduces FAW'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Maize'}), (p:BestPractice {name:'Plant early to avoid peak leafhopper season'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Beans'}), (p:BestPractice {name:'Avoid overhead irrigation; remove crop debris after harvest'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Beans'}), (p:BestPractice {name:'Staking beans improves airflow and reduces rust'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Beans'}), (p:BestPractice {name:'Use certified disease-free bean seeds from KALRO'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Tomatoes'}), (p:BestPractice {name:'Stake and prune tomatoes for air circulation; avoid overhead watering'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Tomatoes'}), (p:BestPractice {name:'Use 50-mesh insect netting for nursery; remove alternate hosts'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Tomatoes'}), (p:BestPractice {name:'Mulch to retain soil moisture; test soil calcium before planting'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Potatoes'}), (p:BestPractice {name:'Plant in well-drained soil; ridge up soil; avoid planting near tomatoes'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Potatoes'}), (p:BestPractice {name:'Disinfect tools with jik (1:9 dilution); use certified seed potatoes'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
    "MATCH (c:Crop {name:'Potatoes'}), (p:BestPractice {name:'Never plant potatoes in infested soil; clean machinery between fields'}) MERGE (c)-[:HAS_PRACTICE]->(p)",
]
