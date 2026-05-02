---
name: document-extraction
description: Use when extracting structured data from heterogeneous energy documents — native PDFs, scanned bills (JPEG / PDF), multi-sheet Excel reports. Trigger on "extract from PDF", "OCR this bill", "parse Excel report", "STEG bill extraction", "Tunisian invoice", "scanned document".
---

# Document Extraction Recipes

The companion to `document-intelligence-engineer`. Three branches: **native PDF**, **scanned image / image-PDF**, **Excel**.

## Branch decision

```python
def detect_kind(path: str) -> str:
    if path.lower().endswith((".xlsx", ".xls", ".xlsm")):
        return "excel"
    if path.lower().endswith(".pdf"):
        with pdfplumber.open(path) as pdf:
            text = pdf.pages[0].extract_text() or ""
            if len(text.strip()) > 100:
                return "native_pdf"
        return "scanned_pdf"
    if path.lower().endswith((".jpg", ".jpeg", ".png", ".tif")):
        return "scanned_image"
    raise ValueError(f"Unsupported: {path}")
```

## Branch 1: Native PDF

```python
import pdfplumber, polars as pl
def extract_native(path):
    rows, tables = [], []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            tables.extend([{"page": i, "table": t} for t in page.extract_tables()])
            rows.append({"page": i, "text": page.extract_text()})
    return rows, tables
```

When tables fail with pdfplumber, retry with `camelot.read_pdf(path, flavor="lattice")` then `flavor="stream"`. Pick the result with the most rows × columns.

## Branch 2: Scanned image / image-PDF

Pre-process **first**, OCR **second**:

```python
import cv2, numpy as np
def preprocess(img_path: str) -> np.ndarray:
    img = cv2.imread(img_path); g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # deskew via min-area-rect on dark pixels
    coords = np.column_stack(np.where(g < 200))
    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    M = cv2.getRotationMatrix2D((g.shape[1]/2, g.shape[0]/2), angle, 1.0)
    rot = cv2.warpAffine(g, M, g.shape[::-1], flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    den = cv2.fastNlMeansDenoising(rot, h=8)
    return cv2.adaptiveThreshold(den, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)
```

OCR engines, in priority order for French Tunisian bills:
1. **PaddleOCR `lang='fr'`** — best on bills with mixed orientation.
2. **Tesseract `-l fra+ara --oem 1 --psm 6`** — fallback.
3. **docling** or **Marker** — when layout is dense (mixed text + tables).
4. **surya-ocr** — strongest for Arabic-inflected layouts; slower.

```python
from paddleocr import PaddleOCR
ocr = PaddleOCR(lang="fr", show_log=False)
result = ocr.ocr(preprocess(path), cls=True)
text_lines = [(box, txt, conf) for line in result for box, (txt, conf) in line]
```

For multi-page scanned PDFs: `pdf2image.convert_from_path(path, dpi=300)` → preprocess each → OCR each → concatenate with page markers `\f`.

## Branch 3: Excel (multi-sheet, discovered headers)

```python
import openpyxl, polars as pl
def extract_excel(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = []
    for sheet in wb.sheetnames:
        # Find header row by asking the LLM (prompt: "Which row index contains column headers?")
        df_raw = pl.read_excel(path, sheet_name=sheet)
        header_row = ask_llm_for_header_row(df_raw.head(10))  # returns int 0..9
        df = pl.read_excel(path, sheet_name=sheet,
                           read_csv_options={"skip_rows": header_row})
        out.append({"sheet": sheet, "df": df, "header_row": header_row})
    return out
```

Some sheets have summary blocks above tables — the header detection saves you here.

## LLM-assisted field extraction (the big lever)

Pass the OCR text + the Pydantic schema to Claude Sonnet:

```python
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0, max_tokens=2000)
chain = llm.with_structured_output(EnergyBill)  # Pydantic class

result = chain.invoke([
    {"role": "system", "content": SYSTEM_PROMPT_FR},
    {"role": "user", "content": f"Document: STEG bill\nOCR:\n{ocr_text}"},
])
```

Set `temperature=0`. If structured-output fails, retry with `tool_choice` mode then with raw JSON-mode + `json.loads` + Pydantic parse.

## Caching by SHA

```python
import hashlib, diskcache
cache = diskcache.Cache(".cache/extract")
def with_cache(extractor):
    def wrap(path):
        key = f"{extractor.__name__}:{hashlib.sha256(open(path,'rb').read()).hexdigest()}"
        if key in cache: return cache[key]
        out = extractor(path); cache[key] = out; return out
    return wrap
```

Re-run on 100 docs after first pass should take seconds.

## Failure-bucket parquet

Write every failed extraction to `data/processed/extraction_failures.parquet` with: `path, sha, error_type, ocr_excerpt, schema_violation`. Review in batch, not interrupt-driven.

## Things NOT to do

- Don't OCR without preprocessing on phone photos.
- Don't extract one bill at a time in a Python loop. Batch with `concurrent.futures.ThreadPoolExecutor` (OCR is GIL-releasing C extensions).
- Don't trust LLM extraction without Pydantic. JSON-mode lies under load.
- Don't recompute OCR on every run. Cache by SHA.
- Don't rotate by `cv2.ROTATE_*` — use the deskew angle from min-area-rect or Hough.

## Hackathon shortcut: 20-line baseline

```python
from paddleocr import PaddleOCR
from langchain_anthropic import ChatAnthropic
ocr = PaddleOCR(lang="fr"); llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)
def extract_bill(path):
    text = "\n".join(t for line in ocr.ocr(path) for _, (t, _) in line)
    return llm.with_structured_output(EnergyBill).invoke(
        f"Document: STEG bill (TN)\nOCR:\n{text}\n\nExtract per the schema. Null if missing.")
```

That gets you a 70-80% baseline in 20 lines on most STEG/SONEDE bills. Refine for the long tail.
