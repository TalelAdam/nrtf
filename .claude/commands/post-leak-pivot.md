---
description: Show the post-leak architectural shift in one screen — what changed, what owns it, what to read
argument-hint:
allowed-tools: Read, Glob
---

# /post-leak-pivot — orientation for the post-leak setup

Print a concise summary of how the project changed on 2026-04-30 in response to the leaks (AI on edge, computer vision on real video, large real data). Used to onboard a teammate or refresh memory after a context reset.

## What this command does

Prints, in this order:

1. **Pivot one-liner.** "AURA evolved from sensor + forecast to a multimodal edge AI system: vision + sensors + edge LLM, trained on the leaked KILANI dataset, distilled to ESP32-S3 / Pi 5."
2. **What's new in `.claude/agents/`** — links to `edge-ai-optimizer.md`, `computer-vision-engineer.md`, `data-engineer.md`.
3. **What's new in `.claude/skills/`** — eight new SKILL.md paths.
4. **What's new in the repo** — `apps/edge-runtime/`, `apps/cv-pipeline/`, `apps/firmware/esp32-cam/`, `data/`, `models/`, `notebooks/`, `infra/edge-targets/`, `docs/`.
5. **Read in this order** to catch up — `docs/architecture/ADR-002-post-leak-pivot.md`, then `docs/brainstorm/STRATEGY.md` (post-leak section), then the three new agent files.
6. **Open decisions** (from STRATEGY.md §8) — order PMS5003 + ESP32-S3 + Pi 5 today; confirm spec at H0; pick demo-video fallback policy.

Reads from `docs/architecture/ADR-002-post-leak-pivot.md` and `docs/brainstorm/STRATEGY.md` to stay accurate.
