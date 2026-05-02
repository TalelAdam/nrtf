"""
io.py — single source of truth for file paths used by every pipeline stage.

Why centralise paths? So that if you ever move the repo or rename folders, you
edit one file, not nine. Every other module imports `paths` from here.
"""

from __future__ import annotations

from pathlib import Path
from dataclasses import dataclass
import os

# --------------------------------------------------------------------------------------
# Repo geometry
# --------------------------------------------------------------------------------------
# This file lives at apps/ml-pipeline/src/utils/io.py.
# parents[4] -> repo root (D:/Hackathons/NRTF3/repo/nrtf)
REPO_ROOT = Path(__file__).resolve().parents[4]
ML_PIPELINE = REPO_ROOT / "apps" / "ml-pipeline"


@dataclass(frozen=True)
class Paths:
    repo_root: Path = REPO_ROOT
    ml_pipeline: Path = ML_PIPELINE

    # Raw — gitignored, may live outside the repo. Override via NRTF_RAW_DIR env var.
    raw_tri_gen: Path = Path(os.environ.get(
        "NRTF_RAW_DIR",
        r"D:\Hackathons\NRTF3\nrtf data -20260501T231459Z-3-001\nrtf data\data tri gen",
    ))

    # Processed — the canonical store the rest of the pipeline reads.
    processed_tri_gen: Path = REPO_ROOT / "data" / "processed" / "tri-gen"

    @property
    def long_parquet(self) -> Path:
        return self.processed_tri_gen / "long.parquet"

    @property
    def features_parquet(self) -> Path:
        return self.processed_tri_gen / "features.parquet"

    @property
    def by_sensor_dir(self) -> Path:
        return self.processed_tri_gen / "by-sensor"

    @property
    def inspection_json(self) -> Path:
        return self.processed_tri_gen / "_inspection_report.json"

    @property
    def build_manifest(self) -> Path:
        return self.processed_tri_gen / "_build_manifest.json"

    # Reports + plots
    @property
    def reports_dir(self) -> Path:
        return ML_PIPELINE / "reports"

    @property
    def eda_dir(self) -> Path:
        return self.reports_dir / "eda"

    @property
    def eval_dir(self) -> Path:
        return self.reports_dir / "eval"

    # Models + experiments
    @property
    def models_dir(self) -> Path:
        return ML_PIPELINE / "checkpoints"

    @property
    def forecaster_dir(self) -> Path:
        return self.models_dir / "forecaster"

    @property
    def anomaly_dir(self) -> Path:
        return self.models_dir / "anomaly"

    @property
    def experiments_dir(self) -> Path:
        return ML_PIPELINE / "experiments"


paths = Paths()


def ensure_dirs() -> None:
    """Create every output directory the pipeline expects. Idempotent."""
    for d in (paths.processed_tri_gen, paths.by_sensor_dir,
              paths.reports_dir, paths.eda_dir, paths.eval_dir,
              paths.models_dir, paths.forecaster_dir, paths.anomaly_dir,
              paths.experiments_dir):
        d.mkdir(parents=True, exist_ok=True)


def mlflow_tracking_uri() -> str:
    """Local file store; no server needed. `mlflow ui --backend-store-uri ...` reads this."""
    paths.experiments_dir.mkdir(parents=True, exist_ok=True)
    return f"file:{paths.experiments_dir.as_posix()}"


def require_long_parquet():
    """Fail fast with a useful message if the user runs a downstream stage too early."""
    if not paths.long_parquet.exists():
        raise SystemExit(
            f"[fatal] {paths.long_parquet} not found.\n"
            f"        Run the data stage first:\n"
            f"          python -m src.data.inspect_tri_gen\n"
            f"          python -m src.data.clean_tri_gen"
        )
