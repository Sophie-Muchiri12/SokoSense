"""Ingest PDF files from engines/data/ into the Neo4j knowledge graph.

Usage:
    python engines/ingest_pdfs.py                      # ingest all PDFs
    python engines/ingest_pdfs.py --file sample.pdf    # ingest specific PDF
    python engines/ingest_pdfs.py --dry-run            # print what would happen

Extracts text, chunks it, and creates Cypher MERGE statements to load into Neo4j.
If Neo4j is not configured, prints the Cypher statements that can be run manually.
"""

import os
import re
import argparse
import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from engines.neo4j_client import Neo4jClient

load_dotenv()

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "data"

# ── crop & disease keyword matching ────────────────────────────────────────

CROP_KEYWORDS = [
    "maize", "beans", "tomatoes", "potatoes", "kale", "cabbage",
    "carrots", "onions", "spinach", "cassava", "sweet potato",
    "irish potato", "rice", "wheat", "sorghum", "millet",
    "green grams", "groundnuts", "cowpeas", "pigeon peas",
    "french beans", "capsicum", "cucumber", "lettuce", "pumpkin",
    "watermelon", "mangoes", "avocado", "oranges", "banana",
    "pineapples", "pawpaw", "passion fruit", "coffee", "tea",
    "cotton", "macadamia", "coconut", "ginger", "garlic",
    "chillies", "egg plant", "brinjals", "sukuma wiki",
    "managu", "terere", "murenda", "kunde", "mito",
]

DISEASE_KEYWORDS = [
    "rust", "blight", "wilt", "mosaic", "streak", "smut", "mildew",
    "rot", "leaf spot", "canker", "gall", "scab", "curl",
    "yellow", "necrosis", "armyworm", "borer", "aphid", "thrips",
    "whitefly", "nematode", "weevil", "mite", "fungal", "bacterial",
    "virus", "disease", "pest", "infection", "decline",
]


def extract_text_from_pdf(pdf_path: str) -> list[dict[str, Any]]:
    """Extract text from a PDF file, returning pages.

    Uses PyMuPDF (fitz) if available, falls back to pdfminer.
    """
    text = ""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(pdf_path)
        pages = []
        for page_num, page in enumerate(doc, 1):
            page_text = page.get_text().strip()
            if page_text:
                pages.append({"page": page_num, "text": page_text})
        doc.close()
        return pages
    except ImportError:
        pass

    try:
        from pdfminer.high_level import extract_text as pdfminer_extract

        full_text = pdfminer_extract(pdf_path)
        # Split by page break markers (form feed)
        page_texts = full_text.split("\f")
        return [
            {"page": i + 1, "text": pt.strip()}
            for i, pt in enumerate(page_texts)
            if pt.strip()
        ]
    except ImportError:
        logger.error(
            "No PDF parser installed. Install with: "
            "pip install PyMuPDF pdfminer.six"
        )
        return []


def chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    """Split text into overlapping chunks at sentence boundaries."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current = []
    current_len = 0

    for sent in sentences:
        sent_len = len(sent)
        if current_len + sent_len > chunk_size and current:
            chunks.append(" ".join(current))
            current = current[-2:]  # overlap last 2 sentences
            current_len = sum(len(s) for s in current)
        current.append(sent)
        current_len += sent_len

    if current:
        chunks.append(" ".join(current))

    return chunks if chunks else [text]


def extract_knowledge_from_chunk(
    chunk: str,
) -> dict[str, Any]:
    """Identify crops, diseases, and possible remedy/practice from a text chunk."""
    chunk_lower = chunk.lower()

    found_crops = [c for c in CROP_KEYWORDS if c in chunk_lower]
    found_diseases = [d for d in DISEASE_KEYWORDS if d in chunk_lower]

    # Extract potential remedy sentences: sentences with action words
    remedy_pattern = re.compile(
        r"(apply|use|spray|plant|rotate|remove|control|treat|manage|prevent|"
        r"avoid|ensure|harvest|prune|mulch|irrigate|foliar|drench|rogue|"
        r"uproot|burn|destroy|disinfect|solarize|seed dress)[^.]*\.",
        re.IGNORECASE,
    )
    remedy_sentences = remedy_pattern.findall(chunk)

    # Extract potential practice sentences: general recommendations
    practice_pattern = re.compile(
        r"(best practice|recommend|should|always|never|important to|crucial to)[^.]*\.",
        re.IGNORECASE,
    )
    practice_sentences = practice_pattern.findall(chunk)

    return {
        "crops": found_crops,
        "diseases": found_diseases,
        "remedies": remedy_sentences[:3],
        "practices": practice_sentences[:3],
        "original_chunk": chunk,
    }


def generate_cypher_statements(
    pdf_name: str,
    extracted: list[dict[str, Any]],
) -> list[str]:
    """Generate Cypher MERGE statements from extracted PDF pages."""
    statements = []
    source_prefix = pdf_name.replace(".pdf", "").replace("_", " ").title()

    for page_data in extracted:
        page_num = page_data["page"]
        chunks = chunk_text(page_data["text"])

        for chunk_idx, chunk_text_content in enumerate(chunks):
            knowledge = extract_knowledge_from_chunk(chunk_text_content)

            for crop in set(knowledge["crops"]):
                crop_node = f"MERGE (c:Crop {{name: '{crop.title()}'}})"
                if crop_node not in statements:
                    statements.append(crop_node)

            for disease in set(knowledge["diseases"]):
                disease_node = f"MERGE (d:Disease {{name: '{disease.title()}'}})"
                if disease_node not in statements:
                    statements.append(disease_node)

            # Link crops to diseases
            for crop in set(knowledge["crops"]):
                for disease in set(knowledge["diseases"]):
                    rel = (
                        f"MATCH (c:Crop {{name: '{crop.title()}'}}), "
                        f"(d:Disease {{name: '{disease.title()}'}}) "
                        f"MERGE (c)-[:AFFECTED_BY]->(d)"
                    )
                    if rel not in statements:
                        statements.append(rel)

            # Create remedy nodes and link
            for remedy in set(knowledge["remedies"]):
                remedy_text = remedy.strip().rstrip(".")
                remedy_node = (
                    f"MERGE (r:Remedy {{name: '{remedy_text[:120]}'}})"
                )
                if remedy_node not in statements:
                    statements.append(remedy_node)
                for disease in set(knowledge["diseases"]):
                    rel = (
                        f"MATCH (d:Disease {{name: '{disease.title()}'}}), "
                        f"(r:Remedy {{name: '{remedy_text[:120]}'}}) "
                        f"MERGE (d)-[:TREATED_BY]->(r)"
                    )
                    if rel not in statements:
                        statements.append(rel)

            # Create practice nodes and link
            for practice in set(knowledge["practices"]):
                practice_text = practice.strip().rstrip(".")
                practice_node = (
                    f"MERGE (p:BestPractice {{name: '{practice_text[:120]}'}})"
                )
                if practice_node not in statements:
                    statements.append(practice_node)
                for crop in set(knowledge["crops"]):
                    rel = (
                        f"MATCH (c:Crop {{name: '{crop.title()}'}}), "
                        f"(p:BestPractice {{name: '{practice_text[:120]}'}}) "
                        f"MERGE (c)-[:HAS_PRACTICE]->(p)"
                    )
                    if rel not in statements:
                        statements.append(rel)

            # Create a Source node pointing back to PDF
            source_name = f"{source_prefix} (Page {page_num})"
            source_node = f"MERGE (src:Source {{name: '{source_name}'}})"
            if source_node not in statements:
                statements.append(source_node)

            # Link knowledge chunks to source
            for crop in set(knowledge["crops"]):
                link = (
                    f"MATCH (c:Crop {{name: '{crop.title()}'}}), "
                    f"(src:Source {{name: '{source_name}'}}) "
                    f"MERGE (c)-[:HAS_SOURCE]->(src)"
                )
                if link not in statements:
                    statements.append(link)

    return statements


def ingest_pdf(
    pdf_path: str,
    neo4j_client: Neo4jClient | None = None,
    dry_run: bool = False,
) -> str:
    """Ingest a single PDF into Neo4j."""
    pdf_name = os.path.basename(pdf_path)

    print(f" Processing: {pdf_name}")
    pages = extract_text_from_pdf(pdf_path)
    if not pages:
        return f" No text extracted from {pdf_name}"

    print(f"   Extracted {len(pages)} page(s)")

    statements = generate_cypher_statements(pdf_name, pages)
    print(f"   Generated {len(statements)} Cypher statements")

    if dry_run:
        print("\n─── Cypher Statements (dry-run) ───")
        for stmt in statements:
            print(stmt)
        return f" Dry-run complete for {pdf_name}: {len(statements)} statements"

    # Execute against Neo4j
    if neo4j_client and neo4j_client._enabled:
        try:
            with neo4j_client.driver.session() as session:
                for stmt in statements:
                    session.run(stmt)
            return f" Ingested {pdf_name}: {len(statements)} statements executed"
        except Exception as exc:
            return f" Neo4j ingestion failed for {pdf_name}: {exc}"
    else:
        print("\n─── Cypher Statements (Neo4j not available) ───")
        for stmt in statements:
            print(stmt)
        print(f"\nℹ  Paste the {len(statements)} statements above into your Neo4j browser.")
        return f" Printed {len(statements)} Cypher statements for {pdf_name}"


def main():
    parser = argparse.ArgumentParser(
        description="Ingest PDF files from engines/data/ into Neo4j knowledge graph."
    )
    parser.add_argument(
        "--file", "-f",
        type=str,
        default=None,
        help="Specific PDF filename in engines/data/ to process (default: all PDFs).",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Print Cypher statements without executing them.",
    )
    parser.add_argument(
        "--use-neo4j",
        action="store_true",
        help="Force Neo4j execution (if configured in .env).",
    )
    args = parser.parse_args()

    # Set up Neo4j client if requested
    neo4j_client = None
    if args.use_neo4j:
        neo4j_client = Neo4jClient()
        # Trigger connection
        _ = neo4j_client.driver
        if neo4j_client._enabled:
            print(" Connected to Neo4j")
        else:
            print(" Neo4j not configured — will print Cypher statements instead")
            neo4j_client = None

    # Determine which PDFs to process
    if args.file:
        pdf_path = DATA_DIR / args.file
        if not pdf_path.exists():
            print(f"File not found: {pdf_path}")
            return
        pdf_files = [pdf_path]
    else:
        pdf_files = sorted(DATA_DIR.glob("*.pdf"))
        if not pdf_files:
            print(" No PDF files found in engines/data/")
            print("   Place your agricultural PDFs there and re-run.")
            return

    print(f" Found {len(pdf_files)} PDF(s) to process\n")

    results = []
    for pdf in pdf_files:
        result = ingest_pdf(str(pdf), neo4j_client=neo4j_client, dry_run=args.dry_run)
        results.append(result)
        print(f"   {result}\n")

    # Summary
    success = sum(1 for r in results if r.startswith(""))
    info = sum(1 for r in results if r.startswith(""))
    failed = sum(1 for r in results if r.startswith(""))
    print(
        f"─── Summary: {success} ingested, {info} printed, {failed} failed ───"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
