# ADR-003 — Spec-aligned pivot to Re·Tech Fusion (RETF) deliverables

- Status: **Accepted**
- Date: 2026-05-01 (Day 1 of the hackathon)
- Deciders: Talel, with team confirmation pending at the 18:00 stand-up
- Supersedes: the AURA-cleanroom direction in ADR-002. ADR-002 stays as historical record but is no longer active.

## Context

The official Re·Tech Fusion (RETF) specification book and the team's energy-audit + bills + Excel data dropped together on 2026-05-01. The actual challenge is **not** a cleanroom HVAC AI demo (what AURA was set up for). It is:

- **Part 1** — IoT device with ≥ 3 distinct sensor types streaming to a server.
- **Part 2** (the core, ~50% of points) — heterogeneous-document extraction (PDF, scanned bills, multi-sheet Excel) → unit normalization → CO₂ estimation → forecasting → optional anomaly detection → dashboard. Includes an instant-feedback POST submission endpoint.
- **Part 3** — choose **Track A** (on-device anomaly detection on ESP32-class hardware) or **Track B** (waste-heat recovery prioritization for an industrial site) or both.
- **Pitch** — top teams only, 8 + 7 minutes.

The pre-spec leaks (ADR-002) about "AI on edge / CV on real video / large data" were partially right — the spec does emphasize edge (Track A) and large data (Part 2 documents) — but **CV on real video** turned out to be misleading. The leaked-direction CV-on-cleanroom-video pivot does not fit this spec. The user-provided practice data is documents (audit PDF + 33 bill JPEGs + 5 PDF bill batches + 22 Excel reports), not video.

The team has 5 members: Talel + roommate (software/AI), one IIA student (industrial automation/embedded), two chemical/biological engineering students. The chem/bio depth maps perfectly to **Track B** and to the energy-domain (units, emission factors, energy balance) work in Part 2 §2.2. The team has **ESP32 only** (no Raspberry Pi, no Coral, no Jetson).

## Decision

We adopt the spec-aligned architecture:

1. **Part 1** — ESP32 device with 3 sensors (flow + heat + microwave/radiowave) → MQTT → NestJS backend → TimescaleDB. Reconnection without data loss for the +15 bonus.
2. **Part 2** — `apps/doc-extraction/` (FastAPI) for OCR + LLM extraction + unit normalization + CO₂ + submission. `apps/ml-pipeline/` for forecasting + anomaly. `apps/frontend/` for the dashboard. `apps/ai-agents/` for orchestration.
3. **Part 3 — Track B is primary** (chem/bio + audit data already in hand). `apps/heat-recovery/` produces the inventory + MCDA + top-3 ROI scenarios. **Track A is stretch** (Day 3 morning) — port the Part 2 forecaster to TFLite-Micro on ESP32 with on-device anomaly via residual-z-score.
4. **No Pi-class compute anywhere.** All edge work is ESP32-only. The previously planned Phi-3-mini-on-Pi-5 reasoning agent is dropped.
5. **No video.** All previously planned CV-on-video tasks are dropped.

## Concrete delta from ADR-002 / pre-spec setup

### Deleted

- `.claude/skills/cv-video-pipeline/` — no video in the spec.
- `.claude/skills/video-data-curation/` — no video labels.
- `.claude/skills/llm-edge-deployment/` — no Pi-class hardware available.
- `.claude/agents/computer-vision-engineer.md` — replaced by `document-intelligence-engineer`.
- `.claude/commands/cv-experiment.md` — superseded by `/extract-bills`, `/normalize-units`, `/co2-baseline`.
- `apps/firmware/esp32-cam/` — no on-device CV in the spec.
- `infra/edge-targets/{esp32-cam,coral-usb,raspberry-pi-5,jetson-orin-nano}.yaml` — only ESP32-S3 budget kept.

### Renamed / repurposed

- `apps/cv-pipeline/` → `apps/doc-extraction/` — same FastAPI scaffold, different domain (OCR + table + LLM extraction instead of video CV).
- `yolo-deployment` skill — kept; the YOLO toolchain still applies if we need DocLayNet-style layout detection on scanned PDFs (low-priority, but useful).

### Added

- `.claude/agents/document-intelligence-engineer.md` — owner of Part 2 §2.1 extraction.
- `.claude/agents/energy-domain-engineer.md` — owner of unit normalization, CO₂ factors, Track B scoring.
- `.claude/skills/document-extraction/SKILL.md` — OCR + Pydantic + LLM extraction recipe.
- `.claude/skills/energy-units-co2/SKILL.md` — conversion + emission factor tables (Tunisia-aware).
- `.claude/skills/anomaly-detection-timeseries/SKILL.md` — server-side + ESP32-side detectors.
- `.claude/skills/heat-recovery-prioritization/SKILL.md` — Track B canonical method.
- `.claude/skills/submission-platform-client/SKILL.md` — POST contract for instant F1 feedback.
- `.claude/commands/extract-bills.md`, `normalize-units.md`, `co2-baseline.md`, `heat-recovery-scan.md`.
- `apps/doc-extraction/` (renamed from cv-pipeline, restructured: `ingest/ ocr/ extraction/ validation/ submission/ inference/ tasks/`).
- `apps/heat-recovery/` (new, with `src/ scenarios/ data/`).
- `data/raw/audit/`, `data/raw/factures/`, `data/raw/tri-gen/` — practice data staged with manifests.

### Kept (still relevant)

- Backend, frontend, ai-agents, ml-pipeline, edge-runtime, firmware/esp32 apps.
- `frontend-designer`, `backend-engineer`, `ai-engineer`, `ml-engineer`, `data-engineer`, `edge-ai-optimizer` agents.
- `nestjs-module`, `nextjs-component`, `langgraph-workflow`, `ml-pipeline`, `mcp-server`, `iot-mqtt-pipeline`, `energy-dashboard` skills.
- `edge-quantization`, `tflite-micro-esp32`, `large-data-pipeline`, `model-distillation` skills (now serve Track A + Part 2 modeling).
- `infra/edge-targets/esp32-s3.yaml` (only edge target).

## Consequences

### Positive
- Architecture maps 1:1 to the spec scoring rubric. Every app has a points-bearing deliverable.
- Practice data already staged. We have a 6-hour head start on Part 2.
- Chem/bio teammates have a clear, high-leverage workstream (Track B + emission factors).
- Dropping Pi simplifies BoM, reduces hardware risk, eliminates a runtime to learn.

### Negative
- The "AI on edge multimodal" pitch from ADR-002 is gone; we replace it with the broader "industrial-energy operating system" framing. Less buzzword density, more domain credibility.
- Track A's 75 pts now depend on a single hardware port. We classify Track A as stretch, accept losing those pts cleanly if the port fails.
- The skill `yolo-deployment` is over-spec for this challenge — kept only as a hedge for layout detection on scans. Not deleted to avoid churn.

### Neutral
- The ML stack (Chronos / LightGBM / forecasting) carries over verbatim; only the inputs change (sensor + Excel time-series instead of particle counts).
- The LangGraph supervisor pattern carries over; the specialist nodes change identity.

## Alternatives considered

1. **Keep AURA-cleanroom direction.** Rejected: the spec doesn't reward it. The audit + bills + Excel data the team has is industrial-general, not cleanroom-specific.
2. **Track A only (skip B).** Rejected: chem/bio teammates would be under-utilized; Track B is lower hardware risk.
3. **Both tracks in full.** Rejected: 75 pts vs ~ 8 hours of work; pitch quality matters more than exhaustive coverage.
4. **Drop the LLM extraction in favor of pure regex/rules.** Rejected: extraction F1 ceiling for diverse bill formats is much higher with constrained LLM; we already have Sonnet API access.

## Implementation status

- [x] Repo deletions complete.
- [x] `apps/doc-extraction/` and `apps/heat-recovery/` scaffolded.
- [x] 2 new agents written.
- [x] 5 new skills written.
- [x] 4 new slash commands written.
- [x] STRATEGY.md rewritten as single source of truth.
- [x] User-provided practice data staged with manifests under `data/raw/`.
- [x] Memory file updated to reflect spec alignment.
- [ ] CLAUDE.md updated (in progress).
- [ ] ml/ai/edge-ai agent post-spec addenda (in progress).
- [ ] Code: not yet written. Next gate is the team stand-up at 18:00 on Day 1, then Part 1 announce at 23:00.

## Reversal triggers

If after Day 2 00:00 the official test-set distribution differs materially from our practice corpus (e.g. no scanned bills at all, no French content, no Excel), this ADR is amended in-place — not abandoned. The architecture is modular: only the OCR engine choice and a few schemas would change.

If the chem/bio teammates discover the audit doesn't apply to the official site, Track B can pivot to a generic industrial-site method (the heat-source classes are universal; only the numbers change).

## References

- `docs/brainstorm/STRATEGY.md` — master strategy (single source of truth)
- `docs/architecture/ADR-002-post-leak-pivot.md` — superseded
- `data/raw/audit/rapport_audit.pdf` — practice audit
- `data/raw/factures/` — practice bills
- `data/raw/tri-gen/` — practice Excel reports
