git # apps/doc-extraction

> ⚠️ **This directory is a stub. The active implementation lives in:**
> `apps/backend/src/modules/doc-extraction/`
>
> It is a fully-wired **NestJS module** (TypeScript) served as part of the backend API on port 3000.

## What the module does

- Ingest a file (PDF / JPEG / XLSX) via `POST /extract/document`
- Detect document type: `native_pdf` | `scanned_pdf` | `scanned_image` | `excel` | `unknown`
- Run the correct extractor:
  - native PDF → `pdf-parse` → LangChain.js structured extraction
  - scanned image / PDF → `sharp` preprocessing → `tesseract.js` (fra+ara) → LangChain.js
  - Excel → `SheetJS (xlsx)` → LLM header detection → LangChain.js per-sheet extraction
- LLM extraction via `@langchain/anthropic` with `withStructuredOutput(ZodSchema)` + fallback
- Zod schema validation + cross-field consistency checks
- Redis-backed extraction cache (fallback to in-memory Map)
- POST to challenge submission endpoint (`POST /extract/submit`)

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/extract/document` | Auto-detect & extract (multipart or base64) |
| POST | `/extract/bill` | Force bill extraction |
| POST | `/extract/audit` | Force audit extraction |
| POST | `/extract/submit` | Submit to challenge platform |

## Running

```bash
# From repo root
pnpm --filter backend dev    # starts NestJS on :3000
# Swagger UI at http://localhost:3000/docs
```

## Running benchmark tests

```bash
# Ensure data/raw/factures/ has JPEG/PDF bills first
pnpm --filter backend test -- --testPathPattern=extraction-benchmark.spec
pnpm --filter backend test -- --testPathPattern=ocr.service.spec

# Override quality thresholds via env vars
TARGET_QUALITY_SCORE=0.5 TARGET_OCR_CONFIDENCE=60 pnpm --filter backend test
```

## Module layout

```
apps/backend/src/modules/doc-extraction/
├── cache/              # Redis + in-memory cache
├── dto/                # ExtractBillDto, SubmitPayloadDto, ExtractionResultDto
├── extraction/         # bill-extractor, excel-extractor, audit-extractor + prompts/
├── ingest/             # FileTypeService (magic-byte detection)
├── ocr/                # ImagePreprocessorService (sharp) + OcrService (tesseract.js)
├── submission/         # SubmissionService (POST to challenge platform)
├── validation/         # ValidationService + Zod schemas (bill, excel, audit, shared)
├── tests/              # ocr.service.spec.ts, extraction-benchmark.spec.ts
├── doc-extraction.controller.ts
├── doc-extraction.service.ts
└── doc-extraction.module.ts
```
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
