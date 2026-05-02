---
description: (Superseded) Historical command from the pre-spec ADR-002 direction
---

# /post-leak-pivot — SUPERSEDED by ADR-003

This command oriented the team around the post-leak multimodal-edge-AI direction (ADR-002) before the official Re·Tech Fusion spec arrived on 2026-05-01.

The official spec replaced that direction. **Use ADR-003 + STRATEGY.md instead.**

For current orientation, read in this order:
1. `docs/brainstorm/STRATEGY.md` — single source of truth
2. `docs/architecture/ADR-003-spec-alignment.md` — what changed and why
3. `CLAUDE.md` — agents + skills + commands quick reference
4. `data/raw/README.md` — practice data inventory

Active commands for the spec-aligned direction:
- `/extract-bills <dir>` — run extraction against a directory
- `/normalize-units <json>` — kWh canonicalization
- `/co2-baseline <input>` — CO₂ + balance reconciliation
- `/heat-recovery-scan` — Track B inventory + MCDA + top-3
- `/quantize-model <ckpt> esp32-s3` — Track A compression
- `/profile-edge <artifact> esp32-s3` — on-device benchmark
