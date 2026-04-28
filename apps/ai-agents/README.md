# @nrtf/ai-agents

LangGraph multi-agent workflows + MCP servers for NRTF.

## Layout

```
src/
├── agents/<name>/             # one folder per agent (state.py, nodes.py, agent.py, prompts.py)
├── workflows/                 # multi-agent orchestrations
├── tools/<domain>/            # @tool functions (battery, grid, market, ...)
├── mcp_servers/               # MCP servers wrapping hardware/data sources
├── prompts/                   # shared prompt fragments
├── memory/                    # conversation + long-term store
├── config/                    # model selection, env config
├── utils/
└── api/                       # FastAPI server exposing /ai/run/<workflow>
tests/
```

## Setup

```bash
cp .env.example .env
python -m venv .venv && source .venv/bin/activate    # or use uv
pip install -r requirements.txt
uvicorn src.api.server:app --reload --port 8001
```

## Patterns

- LangGraph workflows: `.claude/skills/langgraph-workflow/SKILL.md`
- MCP servers: `.claude/skills/mcp-server/SKILL.md`

## Suggested local LLMs (sovereign-AI angle, Tunisian Arabic/French)

```bash
ollama pull gemma2:2b
ollama pull phi3:mini
ollama pull llama3.2:3b
ollama pull whisper-large-v3
```
