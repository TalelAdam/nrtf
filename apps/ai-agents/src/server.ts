/**
 * AI Agents — LangGraph.js orchestration server
 * Port: 8001
 *
 * Routes:
 *   GET  /health                  — liveness probe
 *   POST /api/v1/extract          — run document-extraction pipeline
 *   POST /api/v1/normalize        — normalize energy units to kWh
 *   POST /api/v1/co2              — compute CO₂ from normalized energy frame
 *   POST /api/v1/anomaly-report   — annotate anomalies with LLM reasoning
 */

import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';

const PORT = parseInt(process.env.PORT ?? '8001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const server = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// ─── Health ───────────────────────────────────────────────────────────────────

server.get('/health', async () => ({
  status: 'ok',
  service: 'ai-agents',
  timestamp: new Date().toISOString(),
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
}));

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ExtractRequestSchema = z.object({
  /** base64-encoded file content */
  fileBase64: z.string(),
  /** Original filename (used for type detection) */
  filename: z.string(),
  /** Optional SHA-256 to skip re-extraction if cached */
  sha: z.string().optional(),
});

const NormalizeRequestSchema = z.object({
  entries: z.array(
    z.object({
      value: z.number(),
      unit: z.string(),
      carrier: z.string().optional(),
      period: z.string().optional(),
    }),
  ),
});

const Co2RequestSchema = z.object({
  entries: z.array(
    z.object({
      kWh: z.number(),
      carrier: z.string(),
      period: z.string().optional(),
    }),
  ),
  /** Override emission factor source (default: ADEME 2024) */
  factorSource: z.string().optional(),
});

// ─── /api/v1/extract ──────────────────────────────────────────────────────────

server.post('/api/v1/extract', async (req, reply) => {
  const parse = ExtractRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
  }

  const { filename } = parse.data;
  server.log.info({ filename }, 'extract request received');

  // Stub — wire the LangGraph extraction supervisor here
  return {
    status: 'stub',
    filename,
    note: 'Wire LangGraph Supervisor → Extract → Normalize → CO₂ nodes here',
    extracted: null,
  };
});

// ─── /api/v1/normalize ────────────────────────────────────────────────────────

server.post('/api/v1/normalize', async (req, reply) => {
  const parse = NormalizeRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
  }

  const { entries } = parse.data;

  // Conversion table (representative values — full table lives in energy-domain-engineer skill)
  const toKWh: Record<string, number> = {
    kwh: 1,
    mwh: 1000,
    gwh: 1_000_000,
    gcal: 1163,
    toe: 11_630,
    gj: 277.778,
    btu: 0.000293071,
    'nm3': 10.55, // natural gas, Tunisian average
    kj: 0.000277778,
    mj: 0.277778,
  };

  const normalized = entries.map((e) => {
    const factor = toKWh[e.unit.toLowerCase()];
    if (factor === undefined) {
      return { ...e, kWh: null, error: `Unknown unit: ${e.unit}` };
    }
    return { ...e, kWh: parseFloat((e.value * factor).toFixed(4)), conversionFactor: factor };
  });

  return { normalized, count: normalized.length };
});

// ─── /api/v1/co2 ──────────────────────────────────────────────────────────────

server.post('/api/v1/co2', async (req, reply) => {
  const parse = Co2RequestSchema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
  }

  const { entries, factorSource = 'ADEME 2024' } = parse.data;

  // Emission factors (kg CO₂e / kWh)
  const factors: Record<string, number> = {
    electricity: 0.218,   // Tunisian grid (STEG 2024 estimate)
    natural_gas: 0.2015,  // ADEME 2024
    fuel_oil: 0.265,      // ADEME 2024
    lpg: 0.227,           // ADEME 2024
    diesel: 0.267,        // ADEME 2024
    coal: 0.341,          // ADEME 2024
  };

  const results = entries.map((e) => {
    const ef = factors[e.carrier.toLowerCase().replace(/\s+/g, '_')];
    if (ef === undefined) {
      return { ...e, co2_kg: null, error: `No emission factor for carrier: ${e.carrier}` };
    }
    const co2_kg = parseFloat((e.kWh * ef).toFixed(3));
    return { ...e, co2_kg, emissionFactor: ef, factorSource };
  });

  const totalCo2_kg = results.reduce((sum, r) => sum + (r.co2_kg ?? 0), 0);

  return { results, totalCo2_kg: parseFloat(totalCo2_kg.toFixed(3)), factorSource };
});

// ─── /api/v1/anomaly-report ───────────────────────────────────────────────────

server.post('/api/v1/anomaly-report', async (req, reply) => {
  const schema = z.object({
    anomalies: z.array(z.object({ index: z.number(), value: z.number(), zscore: z.number() })),
    context: z.string().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
  }

  const { anomalies } = parse.data;
  server.log.info({ anomalyCount: anomalies.length }, 'anomaly-report');

  // Stub — wire LLM reasoning via ChatGroq here
  return {
    status: 'stub',
    anomalyCount: anomalies.length,
    note: 'Wire ChatGroq with GROQ_API_KEY to generate anomaly reasoning',
  };
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

server.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`ai-agents listening on http://${HOST}:${PORT}`);
});
