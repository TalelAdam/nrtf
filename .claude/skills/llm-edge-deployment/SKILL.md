---
name: llm-edge-deployment
description: Use when deploying an LLM to edge hardware — GGUF quantization via llama.cpp, MLC-LLM, ExecuTorch, choice of small models (Phi-3-mini, Gemma-2-2B, Qwen2.5-1.5B, Llama-3.2-1B), llama.cpp HTTP server, integration with LangChain. Trigger on "GGUF", "llama.cpp", "run an LLM on Pi 5", "edge LLM", "Phi-3-mini", "small language model on device", "local LLM".
---

# LLM Edge Deployment

For the AURA Reasoning agent that runs on a Raspberry Pi 5 (and the fallback for any local-LLM step). Owner: `edge-ai-optimizer`; consumer: `ai-engineer`.

## Model selection (Pi 5, 8 GB RAM)

| Model | Params | GGUF Q4_K_M size | Tok/s on Pi 5 | French quality | AURA verdict |
|---|---:|---:|---:|---|---|
| **Phi-3-mini-4k-instruct** | 3.8 B | 2.3 GB | 8-10 | Good | **Default** |
| Gemma-2-2B-it | 2.6 B | 1.6 GB | 12-15 | Very good | Fallback |
| Qwen2.5-1.5B-Instruct | 1.5 B | 1.0 GB | 18-22 | Decent | Speed pick |
| Llama-3.2-1B-Instruct | 1.2 B | 0.8 GB | 22-26 | Mediocre French | Skip |
| TinyLlama-1.1B | 1.1 B | 0.7 GB | 28-32 | Poor French | Skip |

For richer French + factual recall, jump to a phone-class device or run Phi-3-medium (14 B) on a Jetson Orin.

## GGUF conversion (llama.cpp pipeline)

```bash
git clone https://github.com/ggerganov/llama.cpp && cd llama.cpp
make -j8 LLAMA_OPENBLAS=1   # or LLAMA_CUBLAS=1 if GPU on conversion box

# 1. Download HF model (or use cached path)
huggingface-cli download microsoft/Phi-3-mini-4k-instruct --local-dir ./phi3-mini

# 2. HF → GGUF FP16
python convert-hf-to-gguf.py ./phi3-mini --outfile phi3-mini-f16.gguf --outtype f16

# 3. Quantize FP16 → Q4_K_M
./llama-quantize phi3-mini-f16.gguf phi3-mini-q4_k_m.gguf Q4_K_M

# 4. Sanity check
./llama-cli -m phi3-mini-q4_k_m.gguf -p "Bonjour, " -n 50
```

Quantization scheme cheat-sheet:

| Scheme | Size ratio vs FP16 | Quality drop | Use when |
|---|---:|---|---|
| Q8_0 | ~ 53% | imperceptible | RAM headroom |
| Q5_K_M | ~ 36% | very small | balanced default for nuanced output |
| **Q4_K_M** | ~ 28% | small | **AURA default** |
| Q4_0 | ~ 27% | noticeable | only if Q4_K_M too big |
| Q3_K_M | ~ 22% | clearly degraded | last resort |
| Q2_K | ~ 18% | broken | don't ship |

## Running the llama.cpp HTTP server (OpenAI-compatible)

```bash
./llama-server \
  -m phi3-mini-q4_k_m.gguf \
  -c 4096 \
  --host 0.0.0.0 --port 8080 \
  -t 4 \
  --n-gpu-layers 0 \
  --metrics
```

Then from `apps/ai-agents`:

```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(
    base_url="http://pi5.local:8080/v1",
    api_key="not-needed",
    model="phi3-mini-q4km",
    temperature=0.2,
    max_tokens=400,
)
```

This is the same shape as a cloud LLM call — the rest of the LangGraph code doesn't change.

## Pi 5 deployment checklist

- [ ] OS: Raspberry Pi OS 64-bit Bookworm, kernel ≥ 6.6
- [ ] CPU governor: `performance` (`sudo cpufreq-set -g performance`)
- [ ] Active cooling (PoE+ HAT or fan) — without cooling, throttling at 80°C cuts tok/s in half
- [ ] Swap: 4 GB on USB-SSD (avoid SD-card swap thrash)
- [ ] llama.cpp built with `LLAMA_OPENBLAS=1` and `-march=armv8.4-a+dotprod`
- [ ] Run server as a systemd unit; restart on failure
- [ ] Expose only on internal network; no public port

## Prompt engineering for small models

- **Be ridiculously specific.** Phi-3-mini follows instructions but doesn't infer subtext like Sonnet 4.
- **Few-shot 2-3 examples** for any structured output. Tighten the format.
- **JSON mode** via `response_format={"type":"json_object"}` works on Phi-3 but is fragile — validate with Pydantic on receipt.
- **Keep context short.** Above 2 K tokens, Phi-3-mini's coherence degrades.
- **System prompt in French if French output is required.** Don't expect cross-lingual zero-shot.

## Alternative runtimes

| Runtime | When to use |
|---|---|
| **llama.cpp** | Default. CPU-only edge. Universal. |
| MLC-LLM | If Pi 5's GPU (V3D) actually helps; rarely worth the build complexity |
| ExecuTorch | Mobile / phone deployment with PyTorch native graph |
| TensorRT-LLM | Jetson Orin / Orin Nano (FP16 / INT8) — 3-5× faster than llama.cpp on those |
| Ollama | Easiest local CLI; wraps llama.cpp; for dev only, not production demo |

## Cost / quality knobs (in order)

1. Smaller model. Phi-3-mini → Gemma-2-2B → Qwen 1.5B.
2. Smaller quant. Q5_K_M → Q4_K_M.
3. Shorter max_tokens. 400 → 200.
4. Smaller context. 4096 → 2048.
5. Greedy decoding (`temperature=0`) for deterministic structured output.

## Things NOT to do

- Don't run an LLM on the Pi 5 at the same time as TFLite vision inference — they fight for cache. Put vision on ESP32-S3 / Pi cam, LLM on Pi 5.
- Don't use Q2_K. It speaks confident nonsense.
- Don't put secrets in the prompt. The local server has no auth — anyone on the network can hit it.
- Don't load the GGUF inside the LangGraph process. Run llama.cpp as a separate server; agents call it over HTTP.
- Don't expect the Pi 5 to handle > 1 concurrent request. Queue them.

## Hackathon shortcuts

- Use `ollama pull phi3:mini` on dev laptops; the same Modelfile structure works.
- For quick iteration: `llama-cli -m model.gguf -p "..." -n 200` is faster than spinning up the server.
- Pre-warm the model on Pi 5 boot — first inference is 5× slower (memory pages).
- If Phi-3-mini's French is rough, add a Sonnet-4 cloud "translator" pass at H22 — judges won't notice the latency, only the polish.
