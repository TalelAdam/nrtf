# apps/doc-extraction

Document intelligence service. Owns Re·Tech Fusion **Part 2** input pipeline: PDF invoices, scanned bills (JPEG), multi-sheet Excel reports → structured JSON with normalized units.

## What this app does

- Ingest a file (PDF / JPEG / XLSX) or a directory of files
- Detect document type (native PDF / scanned bill image / Excel report)
- Run the right extractor:
  - native PDF → `pdfplumber` + `pypdf`
  - scanned image / PDF → OCR (Tesseract / PaddleOCR / docling / Marker)
  - Excel → `openpyxl` + `polars` with LLM-assisted header detection
- LLM-assisted field extraction (Claude Sonnet) with Pydantic schema constraints
- Unit normalization to canonical kWh, with provenance
- POST to the official challenge submission endpoint, parse F1 feedback
- Return structured JSON to the backend / dashboard / agent layer

## Folder layout

```
apps/doc-extraction/
├── src/
│   ├── ingest/        # file probing, type detection, batch readers
│   ├── ocr/           # tesseract / paddleocr / docling / marker wrappers
│   ├── extraction/    # LLM-assisted field extraction + table extraction
│   ├── validation/    # Pydantic schemas, cross-field checks
│   ├── submission/    # POST to challenge platform, F1 parsing
│   └── inference/     # FastAPI server (router-per-doc-type)
├── tasks/             # one folder per task: bills, audits, reports
└── tests/
```

## Endpoints (post-stand-up)

```
POST /extract/bill        (file | base64) → BillRecord
POST /extract/excel       (file)          → list[EnergyEntry]
POST /extract/audit       (file)          → AuditFlowSummary
POST /normalize/units     (json)          → NormalizedFrame
POST /submit              (json)          → {f1, details}
```

## Owner agents

- `document-intelligence-engineer` — extraction recipes, OCR, LLM prompts
- `energy-domain-engineer` — schema (suppliers, units, tariffs, emission factors)
- `data-engineer` — Parquet sinks, manifests, splits
- `ai-engineer` — wraps endpoints as LangChain tools for the orchestration graph

## Quickstart (for the team during the hackathon)

```bash
cd apps/doc-extraction
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # tesseract, paddleocr, pdfplumber, polars, fastapi, pydantic
uvicorn src.inference.server:app --port 8003 --reload

# extract a single bill
curl -F file=@/path/to/bill.jpg http://localhost:8003/extract/bill | jq .
```
