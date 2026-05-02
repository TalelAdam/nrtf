/**
 * ML Pipeline — ONNX inference server
 * Port: 8002
 *
 * Routes:
 *   GET  /health           — liveness probe
 *   POST /api/v1/predict   — time-series forecasting (ONNX model)
 *   POST /api/v1/anomaly   — anomaly detection (rolling-MAD / IsolationForest)
 */

import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';

const PORT = parseInt(process.env.PORT ?? '8002', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const server = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// ─── Health ───────────────────────────────────────────────────────────────────

server.get('/health', async () => ({
  status: 'ok',
  service: 'ml-pipeline',
  timestamp: new Date().toISOString(),
}));

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PredictRequestSchema = z.object({
  /** Historical values in chronological order */
  series: z.array(z.number()).min(1).max(2048),
  /** Number of steps to forecast */
  horizon: z.number().int().positive().default(24),
  /** ISO-8601 timestamp of the first series value (optional) */
  startTs: z.string().optional(),
});

const AnomalyRequestSchema = z.object({
  series: z.array(z.number()).min(1).max(2048),
  /** Rolling window size for MAD baseline */
  windowSize: z.number().int().positive().default(12),
  /** Z-score threshold to flag an anomaly */
  threshold: z.number().positive().default(3.0),
});

// ─── /api/v1/predict ──────────────────────────────────────────────────────────

server.post('/api/v1/predict', async (req, reply) => {
  const parse = PredictRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
  }

  const { series, horizon } = parse.data;

  // Stub: naive last-value repeat until an ONNX model is wired
  const last = series[series.length - 1] ?? 0;
  const predictions = Array.from({ length: horizon }, (_, i) => ({
    step: i + 1,
    value: parseFloat((last * (1 + (Math.random() - 0.5) * 0.02)).toFixed(4)),
  }));

  server.log.info({ horizon, inputLen: series.length }, 'predict');

  return {
    horizon,
    predictions,
    model: 'stub-naive',
    note: 'Wire an ONNX model via onnxruntime-node to replace this stub',
  };
});

// ─── /api/v1/anomaly ──────────────────────────────────────────────────────────

server.post('/api/v1/anomaly', async (req, reply) => {
  const parse = AnomalyRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
  }

  const { series, windowSize, threshold } = parse.data;

  // Rolling MAD anomaly detection
  const anomalies: { index: number; value: number; zscore: number }[] = [];

  for (let i = windowSize; i < series.length; i++) {
    const window = series.slice(i - windowSize, i);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const mad = window.reduce((a, b) => a + Math.abs(b - mean), 0) / window.length;
    const zscore = mad === 0 ? 0 : Math.abs((series[i]! - mean) / (mad * 1.4826));
    if (zscore > threshold) {
      anomalies.push({ index: i, value: series[i]!, zscore: parseFloat(zscore.toFixed(3)) });
    }
  }

  server.log.info({ anomalyCount: anomalies.length, inputLen: series.length }, 'anomaly');

  return {
    anomalyCount: anomalies.length,
    anomalies,
    method: 'rolling-MAD',
    windowSize,
    threshold,
  };
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

server.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`ml-pipeline listening on http://${HOST}:${PORT}`);
});
