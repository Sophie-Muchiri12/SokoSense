# Agricultural Knowledge PDFs

Place PDF files containing agricultural advisory content here. 
These PDFs are ingested into Postgres (pgvector) via `engines/ingest_pdfs.py`.

## How to add content

1. Place your PDF file(s) in this folder
2. Run the ingestion script:
   ```bash
   python engines/ingest_pdfs.py
   ```

The script extracts text from each PDF and stores chunks + embeddings in the `document_chunks` table:
- Each PDF page becomes knowledge chunks
- Chunks are linked to relevant crops and diseases using keyword matching

## Structure

- `*.pdf` — your agricultural PDFs (e.g., KALRO crop disease guides)
- Knowledge is extracted and stored as (`Crop`)-[:AFFECTED_BY]->(`Disease`) + remedies/symptoms
