import { readFile } from "fs/promises";
import path from "path";
import { MlPipelineDashboard } from "@/components/ml-pipeline/ml-pipeline-dashboard";
import type {
  AnomalyScore,
  ForecasterScore,
} from "@/components/ml-pipeline/ml-pipeline-dashboard";

export const metadata = {
  title: "ML Pipeline - ReTeqFusion",
  description: "TRI-GEN model evaluation and mock inference dashboard",
};

function numberOrNull(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  return lines
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",");
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });
}

async function findEvalDir() {
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "apps", "ml-pipeline", "reports", "eval"),
    path.resolve(process.cwd(), "apps", "ml-pipeline", "reports", "eval"),
  ];

  for (const candidate of candidates) {
    try {
      await readFile(path.join(candidate, "forecaster_leaderboard.csv"), "utf-8");
      return candidate;
    } catch {
      // Try the next likely cwd layout.
    }
  }

  return candidates[0];
}

async function loadForecasterScores(evalDir: string): Promise<ForecasterScore[]> {
  const text = await readFile(path.join(evalDir, "forecaster_leaderboard.csv"), "utf-8");

  return parseCsvRows(text).map((row) => ({
    sensorId: row.sensor_id,
    cadence: row.cadence,
    nTest: Number(row.n_test),
    baselineMae: Number(row.baseline_mae),
    lgbMae: Number(row.lgb_mae),
    baselineSmape: Number(row.baseline_smape),
    lgbSmape: Number(row.lgb_smape),
    liftMaePct: numberOrNull(row.lift_mae_pct),
    bestIteration: Number(row.best_iteration),
  }));
}

async function loadAnomalyScores(evalDir: string): Promise<AnomalyScore[]> {
  const text = await readFile(path.join(evalDir, "anomaly_leaderboard.csv"), "utf-8");

  return parseCsvRows(text).map((row) => ({
    sensorId: row.sensor_id,
    nRows: Number(row.n_rows),
    iforestFlags: Number(row.n_iforest_flags),
    madFlags: Number(row.n_mad_flags),
    anyFlags: Number(row.n_any_flags),
    flagRatePct: Number(row.flag_rate_pct),
    iforestScoreP95: Number(row.iforest_score_p95),
  }));
}

export default async function MlPipelinePage() {
  const evalDir = await findEvalDir();
  const [forecasterScores, anomalyScores] = await Promise.all([
    loadForecasterScores(evalDir),
    loadAnomalyScores(evalDir),
  ]);

  return (
    <MlPipelineDashboard
      anomalyScores={anomalyScores}
      forecasterScores={forecasterScores}
    />
  );
}
