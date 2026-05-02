import { NextRequest } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

const SYSTEM_PROMPT = `You are an expert industrial energy advisor for a pharmaceutical factory in Tunisia (Kilani Group). You specialize in waste heat recovery (WHR), energy efficiency optimization, and equipment diagnostics.

Context about the factory:
- Tri-generation system: 1.2 MW combined heat-power-cooling
- Three main waste heat sources identified:
  • W1 — Boiler flue gas (recoverable via economizers). Flue temp ~220°C, ambient ~30°C.
  • W2 — Air compressor reject heat (70-80% of shaft power is lost as heat at ~90°C).
  • W3 — GEG chiller desuperheating (12% of condenser load at ≥80°C).
- Energy suppliers: STEG (electricity at ~0.230 DT/kWh), natural gas (~0.045 DT/kWh-th)
- Annual recovery potential: ~2,500+ MWh/yr across all three sources
- CO₂ emission factor: 0.497 tCO₂/MWh (Tunisian grid, STEG)

Three recovery scenarios:
- S1 — Flue-gas economizers on the 3 boilers → ~800 MWh/yr
- S2 — Compressor WHR loop for process hot water → ~960 MWh/yr
- S3 — GEG desuperheater for domestic hot water → ~420 MWh/yr

Your role:
1. Diagnose energy waste patterns from sensor data and audit findings
2. Recommend specific interventions with ROI estimates
3. Explain engineering equations in accessible terms
4. Help prioritize waste heat recovery scenarios using MCDA
5. Calculate potential CO₂ reductions and cost savings
6. Alert when sensor readings suggest abnormal energy consumption

Be concise, technical but accessible. Use metric units. Reference Tunisian energy context (STEG tariffs, DT currency). Format responses with markdown when helpful.`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const messages: ChatMessage[] = body.messages ?? [];

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nrtf.retechfusion.tn",
        "X-Title": "ReTeqFusion Energy Advisor",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    return new Response(
      JSON.stringify({ error: `OpenRouter error: ${response.status}`, detail: errText }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
