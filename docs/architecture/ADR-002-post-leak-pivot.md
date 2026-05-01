# ADR-002 — Post-leak pivot to multimodal edge AI

- Status: **Accepted**
- Date: 2026-04-30
- Deciders: Talel (lead), pending team confirmation at H0 on May 1
- Supersedes: nothing (ADR-001 not yet written; this ADR predates it because of leak urgency)

## Context

On 2026-04-30, the team received credible leaks about the NRTF 3.0 official spec book and judge expectations:

1. **AI on edge implementation** is a first-class judging criterion. A live on-device inference demo (ESP32-class or Pi-class) is expected, not optional.
2. **Computer vision on real video** — the organizers have prepared (or will distribute) a real industrial video dataset. CV pipelines move from "nice-to-have" to "core."
3. **Large real data** — the dataset is sized such that "train a small custom model in 24h" loses to "fine-tune a foundation model on the provided data, then distill to edge."

Without this pivot, the original AURA architecture (sensors + Chronos forecasting + LangGraph) would compete poorly against teams that read the room. The risk: a technically sound pitch that misses the "AI sophistication × real data × edge deployment" axis the judges care about.

## Decision

**AURA evolves from "sensor-only HVAC controller with cloud LLM reasoning" to "multimodal edge AI controller fusing video + sensors + edge LLM, trained on the leaked dataset, distilled and quantized to ESP32-S3 / Pi 5."**

Concretely:

1. Add an **ESP32-CAM / Pi camera module** to the AURA mini-cleanroom rig. CV is now equal-weight with particle sensing.
2. The Reasoning agent (the one producing the French explanation trace) now runs **locally on a Raspberry Pi 5** via `llama.cpp` + Phi-3-mini Q4_K_M, not on a cloud endpoint. The cloud LLM (Claude Sonnet 4) becomes the Supervisor only.
3. Every model that ships in the demo follows the **foundation-fine-tune-then-distill pattern**: foundation model → fine-tune on leaked KILANI data → distill into a small student → quantize to INT8 → deploy. The deck shows a 4-bar accuracy chart from zero-shot to on-device-INT8.
4. Add three new specialist agents: `edge-ai-optimizer`, `computer-vision-engineer`, `data-engineer`.
5. Add eight new skills: `edge-quantization`, `tflite-micro-esp32`, `cv-video-pipeline`, `yolo-deployment`, `large-data-pipeline`, `model-distillation`, `llm-edge-deployment`, `video-data-curation`.
6. Add four new slash commands: `/quantize-model`, `/profile-edge`, `/cv-experiment`, `/post-leak-pivot`.
7. Add five new repo locations: `apps/edge-runtime/`, `apps/cv-pipeline/`, `apps/firmware/esp32-cam/`, `data/`, `models/`, `notebooks/`, `infra/edge-targets/`.
8. Update `ml-engineer` and `ai-engineer` agents with post-leak addenda (foundation-FT + edge LLMs).

The KILANI EnerOS narrative is unchanged — the platform vision still closes the pitch.

## Consequences

### Positive
- **Pitch hit-rate.** Hits all three leaked judging axes simultaneously.
- **Defensible moat.** Foundation-FT + distillation is a story most teams can't tell.
- **Hardware sovereignty narrative.** "No data leaves the cleanroom" is a real differentiator for KILANI / Tunisia.
- **Modular.** If the spec contradicts AURA, the same architecture (vision + sensors + edge LLM + multi-agent supervisor) maps to IKEL drying, PROTIS mixing, public-works solar.
- **Resume-grade.** The compression toolchain and the multi-agent edge architecture are both portfolio pieces beyond NRTF.

### Negative
- **Hardware cost +.** ESP32-S3 + ESP32-CAM + Pi 5 + camera adds ~ 250-400 TND vs the original sensor-only kit.
- **Hardware risk +.** Two cameras + a Pi 5 + an ESP32-S3 in one demo box is more failure surface than a single ESP32 + sensors. Mitigated by demo-video fallback.
- **Schedule risk.** Vision training on leaked data + distillation + quantization adds ~ 8 hours to the H0-H24 plan. Mitigated by foundation-model bootstrap (`Grounding-DINO` + `SAM-2` for instant labels) and pre-built ESP-WHO / `ai_edge_torch` paths.
- **Dependency on leaked data quality.** If the dataset is small or unusable, fall back to the public datasets list in `docs/research/datasets-fallback.md` — the architecture still works.
- **One more language to manage.** GGUF + llama.cpp adds a runtime to learn. Mitigated by `llm-edge-deployment` skill and the OpenAI-compatible HTTP shim (no LangGraph code change).

### Neutral
- The original sensor + Chronos forecasting story is preserved as one of three modalities, not scrapped.
- The Compliance Guardian remains rule-based and non-overridable — that GMP differentiator is unchanged.

## Alternatives considered

1. **Keep AURA sensor-only, ignore the leaks.** Rejected: the leaks are credible; ignoring them costs us the AI-sophistication axis.
2. **Pivot entirely to a vision-only project.** Rejected: loses the KILANI cleanroom narrative and the 5 M TND EBRD hook. Multi-modal is stronger than vision-only.
3. **Add vision but keep cloud-only LLM.** Rejected: misses the "AI on edge" narrative. Pi 5 + Phi-3-mini Q4_K_M is doable in our hardware budget.
4. **Add vision + edge LLM but skip distillation.** Rejected: foundation-fine-tune-then-distill is the data-play that beats teams who don't know it. Cheap to add, big in the deck.

## Implementation status (as of 2026-04-30)

- Repo skeleton updated (apps/, .claude/, docs/, data/, models/, notebooks/, infra/edge-targets/).
- 3 new agents + 8 new skills + 4 new slash commands written.
- ml-engineer + ai-engineer updated with post-leak addenda.
- STRATEGY.md to receive a Post-leak Addendum section.
- BoM updated: ESP32-S3, ESP32-CAM, Raspberry Pi 5 + camera ordered.
- Code: not yet written — next steps after spec confirmation at H0 on May 1.

## Reversal triggers

If the official spec book (released at hackathon kick-off) contradicts these assumptions, this ADR is amended in H1 — not abandoned. Likely amendments:

- Spec emphasizes IKEL drying / grain quality vs cleanroom HVAC → swap the YOLO task to grain-quality detection. Architecture identical.
- Spec emphasizes solar / public-works → swap to PV defect detection on a panel image; replace PMS5003 with a pyranometer. Architecture identical.
- Spec forbids pre-built hardware → fall back to `apps/firmware/esp32` only with software-only CV demo on a laptop pretending to be the edge. Less sexy but salvageable.

## References

- STRATEGY.md (post-leak section)
- `.claude/agents/edge-ai-optimizer.md`
- `.claude/agents/computer-vision-engineer.md`
- `.claude/agents/data-engineer.md`
- `.claude/skills/edge-quantization/SKILL.md`
