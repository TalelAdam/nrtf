# data/raw

Practice data uploaded by Talel on 2026-05-01, before the official Part 2 test set drops at Day 2 00:00.

## Three datasets staged here

| Folder | What | Use |
|---|---|---|
| `audit/` | `rapport_audit.pdf` (15 pages, French, pharma factory energy audit) | Reference doc for Track B; also a Part 2 extraction target. |
| `factures/` | 33 JPEG bills + 5 PDF batches | Practice corpus for the bill-extraction pipeline. Use it tonight to discover schema, OCR-engine quality, common units, supplier names. |
| `tri-gen/` | 21 Excel monthly reports + 1 PDF (Jul 2025 → Apr 2026) | Practice corpus for the Excel-extraction pipeline. Also ground-truth-like operational data for the IoT story. |

## Why this matters

The challenge spec promises "An amount of heterogeneous energy documents" at Day 2 00:00 — same shape as what's already here. Building the pipeline against this data **now** means: at H+0 of Part 2 we point our pipeline at the test set, fix discrepancies, and submit. We get a ~6-hour head start on every team that started from zero.

## Rules

- Gitignored (see `.gitignore`). DVC or release-tarball if we want to share across machines.
- Do NOT edit raw files. Derived outputs go to `data/processed/`.
- Sensitive (real factory data). Don't post screenshots in public threads or push to a public repo.
- Manifests live next to each subfolder as `_manifest.json` with SHA256s.

Owner agent: `data-engineer`.
