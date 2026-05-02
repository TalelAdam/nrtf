# @nrtf/ai-agents

LangGraph.js multi-agent workflows + MCP servers for NRTF (TypeScript).

## Layout

```
src/
├── agents/<name>/             # one folder per agent (state.ts, nodes.ts, agent.ts, prompts.ts)
├── workflows/                 # multi-agent orchestrations (LangGraph StateGraph)
├── tools/<domain>/            # tool functions for LangChain.js
├── mcp_servers/               # MCP servers wrapping hardware/data sources
├── prompts/                   # shared prompt fragments
├── memory/                    # conversation + long-term store
├── config/                    # model selection, env config
├── utils/
└── server.ts                  # Fastify server exposing /ai/run/<workflow>
tests/
```

## Setup

```bash
cp .env.example .env
pnpm --filter @nrtf/ai-agents install
pnpm --filter @nrtf/ai-agents dev    # starts on :8001
```

## Patterns

- LangGraph.js workflows: `.claude/skills/langgraph-workflow/SKILL.md`
- MCP servers: `.claude/skills/mcp-server/SKILL.md`

