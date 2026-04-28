---
description: Once the team locks the hackathon project, write an ADR and update CLAUDE.md
argument-hint: project-name (e.g., AthenaGrid, H2-Sentinel, STEG-Whisperer)
---

The team has committed to the `$ARGUMENTS` project. Do the following:

1. Read `docs/brainstorm/02_ai_trends_fintech_prep_v2.md` for the project description.
2. Create `docs/architecture/ADR-001-project-selection.md` with: context, decision, alternatives considered (top-7 list), consequences.
3. Update `CLAUDE.md` "Open decisions" → "Locked: $ARGUMENTS" with a 1-paragraph elevator summary.
4. Create `docs/architecture/system-overview.md` with a Mermaid diagram of the chosen project's components.
5. Suggest an initial set of feature modules for the backend and pages for the frontend based on the project. Don't scaffold them yet — just list.
