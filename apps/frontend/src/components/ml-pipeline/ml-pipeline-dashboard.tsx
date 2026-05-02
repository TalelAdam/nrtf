"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ForecasterScore = {
  sensorId: string;
  cadence: string;
  nTest: number;
  baselineMae: number;
  lgbMae: number;
  baselineSmape: number;
  lgbSmape: number;
  liftMaePct: number | null;
  bestIteration: number;
};

export type AnomalyScore = {
  sensorId: string;
  nRows: number;
  iforestFlags: number;
  madFlags: number;
  anyFlags: number;
  flagRatePct: number;
  iforestScoreP95: number;
};

type MlPipelineDashboardProps = {
  forecasterScores: ForecasterScore[];
  anomalyScores: AnomalyScore[];
};

type MockInput = {
  currentValue: number;
  gasFlow: number;
  waterTemp: number;
  loadPct: number;
  vibration: number;
};

const initialInput: MockInput = {
  currentValue: 74,
  gasFlow: 1.8,
  waterTemp: 42,
  loadPct: 68,
  vibration: 0.22,
};

function displaySensor(sensorId: string) {
  return sensorId
    .split("_")
    .filter(Boolean)
    .slice(0, 7)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function buildForecastData(input: MockInput, score: ForecasterScore) {
  const lift = clamp(score.liftMaePct ?? 0, -100, 100);
  const baselineError = Math.max(0.4, Math.min(input.currentValue * 0.28, score.baselineMae / 12));
  const modelError = Math.max(0.08, Math.min(input.currentValue * 0.08, score.lgbMae / 12));

  return Array.from({ length: 18 }, (_, index) => {
    const hour = index + 1;
    const season = Math.sin((index / 17) * Math.PI * 2) * (input.currentValue * 0.07);
    const loadEffect = (input.loadPct - 60) * 0.09;
    const gasEffect = (input.gasFlow - 1.5) * 1.2;
    const actual = input.currentValue + season + loadEffect + gasEffect;

    return {
      hour: `+${hour}h`,
      actual: Number(actual.toFixed(2)),
      baseline: Number((actual + Math.sin(index * 0.7) * baselineError).toFixed(2)),
      model: Number((actual + Math.cos(index * 0.45) * modelError * (1 - lift / 160)).toFixed(2)),
    };
  });
}

function buildAnomalySeries(input: MockInput, score: AnomalyScore | undefined) {
  const branchRisk = score ? clamp(score.flagRatePct, 5, 85) / 100 : 0.26;
  const stress =
    input.gasFlow * 0.12 +
    input.vibration * 1.3 +
    Math.abs(input.waterTemp - 42) * 0.018 +
    Math.max(0, input.loadPct - 70) * 0.012;

  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin(index * 0.62) * 0.16 + Math.cos(index * 0.22) * 0.08;
    const probability = clamp((branchRisk + stress + wave) * 100, 2, 98);
    const actualAnomaly = probability > 58 || (index % 11 === 0 && stress > 0.55);
    const predictedAnomaly = probability > 52;

    return {
      slot: `${index}:00`,
      probability: Number(probability.toFixed(1)),
      actualAnomaly,
      predictedAnomaly,
    };
  });
}

function confusionMetrics(series: ReturnType<typeof buildAnomalySeries>) {
  const totals = series.reduce(
    (acc, point) => {
      if (point.actualAnomaly && point.predictedAnomaly) acc.tp += 1;
      if (!point.actualAnomaly && point.predictedAnomaly) acc.fp += 1;
      if (point.actualAnomaly && !point.predictedAnomaly) acc.fn += 1;
      if (!point.actualAnomaly && !point.predictedAnomaly) acc.tn += 1;
      return acc;
    },
    { tp: 0, fp: 0, fn: 0, tn: 0 },
  );

  const precision = totals.tp / Math.max(1, totals.tp + totals.fp);
  const recall = totals.tp / Math.max(1, totals.tp + totals.fn);
  const f1 = (2 * precision * recall) / Math.max(0.001, precision + recall);
  const accuracy = (totals.tp + totals.tn) / Math.max(1, series.length);

  return {
    accuracy: accuracy * 100,
    f1: f1 * 100,
    precision: precision * 100,
    recall: recall * 100,
  };
}

export function MlPipelineDashboard({
  anomalyScores,
  forecasterScores,
}: MlPipelineDashboardProps) {
  const [selectedSensor, setSelectedSensor] = useState(forecasterScores[0]?.sensorId ?? "");
  const [input, setInput] = useState<MockInput>(initialInput);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const id = window.setInterval(() => {
      setInput((current) => ({
        currentValue: clamp(current.currentValue + (Math.random() - 0.45) * 2.2, 10, 160),
        gasFlow: clamp(current.gasFlow + (Math.random() - 0.5) * 0.14, 0.2, 4),
        waterTemp: clamp(current.waterTemp + (Math.random() - 0.48) * 0.9, 18, 88),
        loadPct: clamp(current.loadPct + (Math.random() - 0.45) * 3.4, 10, 100),
        vibration: clamp(current.vibration + (Math.random() - 0.48) * 0.035, 0.02, 1.2),
      }));
    }, 2200);

    return () => window.clearInterval(id);
  }, [isLive]);

  const selectedForecast =
    forecasterScores.find((score) => score.sensorId === selectedSensor) ?? forecasterScores[0];
  const selectedAnomaly =
    anomalyScores.find((score) => score.sensorId === selectedForecast?.sensorId) ?? anomalyScores[0];

  const forecastData = useMemo(
    () => (selectedForecast ? buildForecastData(input, selectedForecast) : []),
    [input, selectedForecast],
  );
  const anomalySeries = useMemo(
    () => buildAnomalySeries(input, selectedAnomaly),
    [input, selectedAnomaly],
  );
  const mockScores = useMemo(() => confusionMetrics(anomalySeries), [anomalySeries]);

  const topForecasters = useMemo(
    () =>
      [...forecasterScores]
        .filter((score) => score.liftMaePct !== null)
        .sort((a, b) => (b.liftMaePct ?? -Infinity) - (a.liftMaePct ?? -Infinity))
        .slice(0, 10),
    [forecasterScores],
  );

  const topAnomalies = useMemo(
    () => [...anomalyScores].sort((a, b) => b.flagRatePct - a.flagRatePct).slice(0, 10),
    [anomalyScores],
  );

  if (!selectedForecast) {
    return (
      <div className="ml-page">
        <div className="ml-empty">No ML evaluation artifacts found.</div>
      </div>
    );
  }

  const modelAccuracy = clamp(100 - selectedForecast.lgbSmape);

  function updateInput(key: keyof MockInput, value: number) {
    setInput((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? value : 0,
    }));
  }

  function regenerateInput() {
    setInput({
      currentValue: Math.round(40 + Math.random() * 80),
      gasFlow: Number((0.8 + Math.random() * 2.6).toFixed(2)),
      waterTemp: Math.round(28 + Math.random() * 34),
      loadPct: Math.round(35 + Math.random() * 55),
      vibration: Number((0.08 + Math.random() * 0.52).toFixed(2)),
    });
  }

  return (
    <div className="ml-page">
      <header className="ml-header">
        <div>
          <p className="ml-kicker">TRI-GEN ML Pipeline</p>
          <h2>Model Evaluation Console</h2>
        </div>
        <div className="ml-header-actions">
          <button className="ml-icon-button" onClick={() => setIsLive((value) => !value)}>
            {isLive ? <Pause size={16} /> : <Play size={16} />}
            <span>{isLive ? "Live mock" : "Paused"}</span>
          </button>
          <button className="ml-icon-button" onClick={regenerateInput}>
            <RefreshCw size={16} />
            <span>Sample</span>
          </button>
        </div>
      </header>

      <section className="ml-score-grid">
        <div className="ml-score-card">
          <span>Accuracy</span>
          <strong>{formatNumber(modelAccuracy, 1)}%</strong>
          <small>sMAPE-derived forecast score</small>
        </div>
        <div className="ml-score-card">
          <span>F1</span>
          <strong>{formatNumber(mockScores.f1, 1)}%</strong>
          <small>mock anomaly window</small>
        </div>
        <div className="ml-score-card">
          <span>MAE Lift</span>
          <strong>{formatNumber(selectedForecast.liftMaePct, 1)}%</strong>
          <small>LightGBM vs seasonal naive</small>
        </div>
        <div className="ml-score-card">
          <span>Flag Rate</span>
          <strong>{formatNumber(selectedAnomaly?.flagRatePct, 1)}%</strong>
          <small>IsolationForest + MAD</small>
        </div>
      </section>

      <section className="ml-grid">
        <div className="ml-panel ml-panel--controls">
          <div className="ml-panel-title">
            <SlidersHorizontal size={17} />
            <span>Input Stream</span>
          </div>

          <label className="ml-field">
            <span>Sensor</span>
            <select value={selectedForecast.sensorId} onChange={(event) => setSelectedSensor(event.target.value)}>
              {forecasterScores.map((score) => (
                <option key={score.sensorId} value={score.sensorId}>
                  {displaySensor(score.sensorId)}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-input-grid">
            <label className="ml-field">
              <span>Current value</span>
              <input
                type="number"
                value={input.currentValue.toFixed(1)}
                onChange={(event) => updateInput("currentValue", Number(event.target.value))}
              />
            </label>
            <label className="ml-field">
              <span>Gas flow</span>
              <input
                type="number"
                value={input.gasFlow.toFixed(2)}
                onChange={(event) => updateInput("gasFlow", Number(event.target.value))}
              />
            </label>
            <label className="ml-field">
              <span>Water temp</span>
              <input
                type="number"
                value={input.waterTemp.toFixed(1)}
                onChange={(event) => updateInput("waterTemp", Number(event.target.value))}
              />
            </label>
            <label className="ml-field">
              <span>Load %</span>
              <input
                type="number"
                value={input.loadPct.toFixed(1)}
                onChange={(event) => updateInput("loadPct", Number(event.target.value))}
              />
            </label>
            <label className="ml-field ml-field--wide">
              <span>Vibration</span>
              <input
                type="range"
                min="0"
                max="1.2"
                step="0.01"
                value={input.vibration}
                onChange={(event) => updateInput("vibration", Number(event.target.value))}
              />
            </label>
          </div>
        </div>

        <div className="ml-panel ml-panel--chart">
          <div className="ml-panel-title">
            <Activity size={17} />
            <span>Forecast Output</span>
          </div>
          <ResponsiveContainer width="100%" height={286}>
            <ComposedChart data={forecastData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(187, 171, 140, 0.12)" strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fill: "#9a8f82", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9a8f82", fontSize: 10 }} width={46} />
              <Tooltip contentStyle={{ background: "#171a24", border: "1px solid rgba(187,171,140,0.28)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="actual" fill="rgba(69, 183, 209, 0.16)" stroke="#45b7d1" name="Mock actual" />
              <Line dataKey="baseline" dot={false} stroke="#f4a261" strokeWidth={2} name="Baseline" />
              <Line dataKey="model" dot={false} stroke="#66d17a" strokeWidth={2.4} name="LightGBM" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="ml-panel">
          <div className="ml-panel-title">
            <Target size={17} />
            <span>Evaluation Metrics</span>
          </div>
          <ResponsiveContainer width="100%" height={238}>
            <BarChart
              data={[
                { metric: "MAE", baseline: selectedForecast.baselineMae, model: selectedForecast.lgbMae },
                { metric: "sMAPE", baseline: selectedForecast.baselineSmape, model: selectedForecast.lgbSmape },
              ]}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="rgba(187, 171, 140, 0.12)" strokeDasharray="3 3" />
              <XAxis dataKey="metric" tick={{ fill: "#9a8f82", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9a8f82", fontSize: 10 }} width={48} />
              <Tooltip contentStyle={{ background: "#171a24", border: "1px solid rgba(187,171,140,0.28)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="baseline" fill="#f4a261" name="Baseline" radius={[3, 3, 0, 0]} />
              <Bar dataKey="model" fill="#66d17a" name="LightGBM" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ml-panel">
          <div className="ml-panel-title">
            <Activity size={17} />
            <span>Anomaly Output</span>
          </div>
          <ResponsiveContainer width="100%" height={238}>
            <AreaChart data={anomalySeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(187, 171, 140, 0.12)" strokeDasharray="3 3" />
              <XAxis dataKey="slot" tick={{ fill: "#9a8f82", fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: "#9a8f82", fontSize: 10 }} width={42} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#171a24", border: "1px solid rgba(187,171,140,0.28)" }} />
              <Area
                dataKey="probability"
                fill="rgba(230, 57, 70, 0.2)"
                name="Anomaly probability"
                stroke="#e63946"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="ml-metric-row">
            <span>Precision {formatNumber(mockScores.precision, 1)}%</span>
            <span>Recall {formatNumber(mockScores.recall, 1)}%</span>
            <span>Accuracy {formatNumber(mockScores.accuracy, 1)}%</span>
          </div>
        </div>
      </section>

      <section className="ml-leaderboards">
        <div className="ml-table-panel">
          <h3>Top Forecasters</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topForecasters} layout="vertical" margin={{ top: 0, right: 18, left: 26, bottom: 0 }}>
              <CartesianGrid stroke="rgba(187, 171, 140, 0.1)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: "#9a8f82", fontSize: 10 }} />
              <YAxis
                dataKey="sensorId"
                tickFormatter={(value) => displaySensor(value).slice(0, 18)}
                tick={{ fill: "#9a8f82", fontSize: 10 }}
                type="category"
                width={108}
              />
              <Tooltip
                contentStyle={{ background: "#171a24", border: "1px solid rgba(187,171,140,0.28)" }}
                formatter={(value) => `${formatNumber(Number(value), 1)}%`}
                labelFormatter={(value) => displaySensor(String(value))}
              />
              <Bar dataKey="liftMaePct" name="MAE lift %" radius={[0, 3, 3, 0]}>
                {topForecasters.map((entry) => (
                  <Cell
                    fill={(entry.liftMaePct ?? 0) >= 0 ? "#66d17a" : "#e63946"}
                    key={entry.sensorId}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ml-table-panel">
          <h3>Anomaly Leaderboard</h3>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>Rows</th>
                  <th>Flags</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {topAnomalies.map((score) => (
                  <tr key={score.sensorId}>
                    <td>{displaySensor(score.sensorId)}</td>
                    <td>{score.nRows.toLocaleString()}</td>
                    <td>{score.anyFlags.toLocaleString()}</td>
                    <td>{formatNumber(score.flagRatePct, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
