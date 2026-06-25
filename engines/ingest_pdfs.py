"""Ingest PDF files from engines/data/ into the Neo4j vector knowledge graph.

Usage:
    python engines/ingest_pdfs.py                      # ingest all PDFs
    python engines/ingest_pdfs.py --file sample.pdf    # ingest specific PDF
    python engines/ingest_pdfs.py --dry-run            # print what would happen

Pipeline:
  1. Extract text from PDF using pypdf
  2. Chunk text into overlapping segments
  3. Generate vector embeddings for each chunk via Featherless API
  4. Store chunks in Neo4j as DocumentChunk nodes with vector index

If Neo4j is not configured, prints the chunk metadata that would be stored.
"""

import os
import re
import sys
import argparse
import logging
import hashlib
from pathlib import Path
from typing import Any

# Add project root to sys.path to support executing this script directly
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from dotenv import load_dotenv

from engines.neo4j_client import Neo4jClient, get_embedding, VECTOR_DIMENSION

load_dotenv()

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "data"

# Chunking configuration
CHUNK_SIZE = 500       # target characters per chunk
CHUNK_OVERLAP = 100    # overlap between consecutive chunks in characters


def extract_text_from_pdf(pdf_path: str) -> list[dict[str, Any]]:
    """Extract text from a PDF file using pypdf, returning pages.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        List of dicts with keys: page (int), text (str).
    """
    from pypdf import PdfReader

    reader = PdfReader(pdf_path)
    pages = []
    for page_num, page in enumerate(reader.pages, 1):
        text = page.extract_text()
        if text and text.strip():
            pages.append({"page": page_num, "text": text.strip()})
    return pages


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks at sentence boundaries.

    Args:
        text: The full text to split.
        chunk_size: Target character count per chunk.
        overlap: Number of overlapping characters between consecutive chunks.

    Returns:
        List of text chunks.
    """
    if len(text) <= chunk_size:
        return [text]

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current = []
    current_len = 0

    for sent in sentences:
        sent_len = len(sent)
        if current_len + sent_len > chunk_size and current:
            # Calculate overlap: keep last ~overlap chars worth of sentences
            combined = " ".join(current)
            chunks.append(combined)

            # Overlap: keep sentences from the end that cover ~overlap chars
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current):
                overlap_sentences.insert(0, s)
                overlap_len += len(s)
                if overlap_len >= overlap:
                    break

            current = overlap_sentences
            current_len = overlap_len

        current.append(sent)
        current_len += sent_len

    if current:
        chunks.append(" ".join(current))

    return chunks


def process_pdf_for_ingestion(
    pdf_path: str,
    include_embeddings: bool = True,
) -> list[dict[str, Any]]:
    """Extract, chunk, and embed text from a PDF.

    Args:
        pdf_path: Path to the PDF file.
        include_embeddings: If True, generate vector embeddings for each chunk.

    Returns:
        List of chunk dicts with keys: chunk_id, text, embedding, metadata.
    """
    pdf_name = os.path.basename(pdf_path)
    pages = extract_text_from_pdf(pdf_path)

    all_chunks = []
    for page_data in pages:
        page_num = page_data["page"]
        page_text = page_data["text"]

        chunks = chunk_text(page_text)
        for chunk_idx, chunk_content in enumerate(chunks):
            # Create a deterministic unique ID
            unique_str = f"{pdf_name}:p{page_num}:c{chunk_idx}:{chunk_content[:50]}"
            chunk_id = hashlib.md5(unique_str.encode()).hexdigest()

            entry: dict[str, Any] = {
                "chunk_id": chunk_id,
                "text": chunk_content,
                "metadata": {
                    "pdf_name": pdf_name,
                    "page_num": page_num,
                    "chunk_idx": chunk_idx,
                },
            }

            if include_embeddings:
                entry["embedding"] = get_embedding(chunk_content)
            else:
                entry["embedding"] = []

            all_chunks.append(entry)

    return all_chunks


def ingest_pdf(
    pdf_path: str,
    neo4j_client: Neo4jClient | None = None,
    dry_run: bool = False,
) -> str:
    """Ingest a single PDF into Neo4j vector store.

    Args:
        pdf_path: Path to the PDF file.
        neo4j_client: Neo4j client instance. If None, prints results instead.
        dry_run: If True, only print what would be done.

    Returns:
        Status message.
    """
    pdf_name = os.path.basename(pdf_path)
    logger.info("Processing: %s", pdf_name)

    chunks = process_pdf_for_ingestion(pdf_path, include_embeddings=not dry_run)
    if not chunks:
        return f" No text extracted from {pdf_name}"

    logger.info("  Generated %d chunk(s)", len(chunks))

    if dry_run:
        print(f"\n─── Chunks from {pdf_name} (dry-run) ───")
        for i, chunk in enumerate(chunks):
            print(f"\n--- Chunk {i + 1} (id: {chunk['chunk_id'][:12]}...) ---")
            print(f"  Page: {chunk['metadata']['page_num']}")
            print(f"  Text preview: {chunk['text'][:200]}...")
            if chunk["embedding"]:
                print(f"  Embedding: {len(chunk['embedding'])} dims "
                      f"[{chunk['embedding'][0]:.4f}, {chunk['embedding'][1]:.4f}, ...]")
        print()
        return f" Dry-run complete for {pdf_name}: {len(chunks)} chunks"

    # Store in Neo4j
    if neo4j_client and neo4j_client._enabled:
        stored = neo4j_client.store_embeddings_batch(chunks)
        return f" Ingested {pdf_name}: {stored}/{len(chunks)} chunks stored in Neo4j"
    else:
        # Print summary
        print(f"\n─── Chunks from {pdf_name} (Neo4j not available) ───")
        for i, chunk in enumerate(chunks):
            print(f"\n  Chunk {i + 1} (page {chunk['metadata']['page_num']}): "
                  f"{chunk['text'][:150]}...")
        print(f"\nℹ  Configure NEO4J_URI and NEO4J_PASSWORD in .env to store in Neo4j.")
        return f" Chunked {pdf_name}: {len(chunks)} chunks (not stored — Neo4j not configured)"


def main():
    parser = argparse.ArgumentParser(
        description="Ingest PDF files from engines/data/ into Neo4j vector knowledge graph."
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
        help="Print chunks without computing embeddings or storing in Neo4j.",
    )
    parser.add_argument(
        "--use-neo4j",
        action="store_true",
        help="Force Neo4j execution (if configured in .env).",
    )
    args = parser.parse_args()

    # Set up Neo4j client (enabled by default unless dry-run is requested)
    neo4j_client = None
    if not args.dry_run:
        neo4j_client = Neo4jClient()
        if neo4j_client._enabled:
            print(" Connected to Neo4j")
            print(" Clearing existing DocumentChunk nodes to avoid conflicts...")
            neo4j_client.clear_document_chunks()
        else:
            print(" Neo4j not configured or connection failed — will print chunk info instead")
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
        result = ingest_pdf(
            str(pdf),
            neo4j_client=neo4j_client,
            dry_run=args.dry_run,
        )
        results.append(result)
        print(f"   {result}\n")

    # Summary
    success = sum(1 for r in results if "stored" in r or "Chunked" in r)
    dry = sum(1 for r in results if "Dry-run" in r)
    failed = sum(1 for r in results if "No text" in r)
    print(
        f"─── Summary: {success} processed, {dry} dry-runs, {failed} failed ───"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
