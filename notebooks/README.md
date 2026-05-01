# notebooks/

Jupyter notebooks for **exploration only**. Not for production code.

## Naming convention

`<task>_<purpose>.ipynb` — kebab-case task, snake_case purpose.

Examples:
- `ppe_eda.ipynb` — initial EDA on PPE compliance dataset
- `cleanroom_video_inspection.ipynb` — first watch of leaked video
- `chronos_zero_shot_particles.ipynb` — Chronos-Bolt zero-shot baseline
- `phi3_french_quality_check.ipynb` — sanity test on Phi-3-mini French outputs

## Rules

1. **No production code lives here.** Once a transform stabilizes, lift it into `apps/<app>/src/` with tests.
2. **Notebooks are throw-away.** They document the journey, not the destination.
3. **Don't commit large outputs.** Strip outputs before committing: `jupyter nbconvert --clear-output --inplace *.ipynb` (or use `nbstripout`).
4. **Reproducible.** Pin random seeds, list package versions in the first cell.
5. **One question per notebook.** Don't accumulate "scratch.ipynb".

`*.ipynb_checkpoints` is gitignored.
