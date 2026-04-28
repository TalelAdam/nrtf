---
name: langgraph-workflow
description: Use when designing or implementing a LangGraph multi-agent workflow — supervisor patterns, state graphs, tool nodes, conditional edges, streaming. Trigger on "build a workflow for X", "add an agent that does Y", "wire up multi-agent for Z", "make the agent decide between A and B".
---

# LangGraph Multi-Agent Workflow Pattern

## When to reach for this

You have a problem where **one LLM call isn't enough**: it needs multi-step reasoning, multiple specialist roles, tool use over multiple turns, or conditional branching based on intermediate state. Single-prompt: just use LangChain. Multi-step / role-routing: use LangGraph.

## File layout (under apps/ai-agents/src/)

```
agents/<agent_name>/
├── __init__.py
├── agent.py              # build_graph() returns a compiled StateGraph
├── state.py              # AgentState (Pydantic BaseModel)
├── nodes.py              # node functions: each takes state, returns updated state
├── prompts.py            # PromptTemplate constants
├── README.md             # what this agent does, inputs/outputs, golden cases
└── tests/
    └── test_<agent>.py   # golden-case eval

workflows/<workflow_name>.py   # multi-agent orchestration combining agents

tools/<domain>/<tool>.py       # @tool functions (LangChain BaseTool compatible)

mcp_servers/<device>_server.py # MCP server exposing hardware as tools
```

## State design (state.py)

```python
from pydantic import BaseModel, Field
from typing import Literal, Annotated
from langgraph.graph.message import add_messages

class AgentState(BaseModel):
    # conversation
    messages: Annotated[list, add_messages] = Field(default_factory=list)
    # current task
    objective: str
    # working memory
    plan: list[str] = Field(default_factory=list)
    observations: list[dict] = Field(default_factory=list)
    # routing
    next_node: Literal["plan", "execute", "reflect", "done"] = "plan"
    # outputs
    final_answer: str | None = None
    confidence: float = 0.0
```

State must be **serializable** (Pydantic does this) so LangGraph can checkpoint it.

## Graph construction (agent.py)

```python
from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import plan_node, execute_node, reflect_node

def build_graph():
    g = StateGraph(AgentState)
    g.add_node("plan", plan_node)
    g.add_node("execute", execute_node)
    g.add_node("reflect", reflect_node)

    g.set_entry_point("plan")
    g.add_edge("plan", "execute")
    g.add_conditional_edges(
        "execute",
        lambda s: s.next_node,
        {"reflect": "reflect", "done": END},
    )
    g.add_conditional_edges(
        "reflect",
        lambda s: s.next_node,
        {"execute": "execute", "done": END},
    )
    return g.compile(checkpointer=...)  # SqliteSaver for hackathon
```

## Node function shape (nodes.py)

```python
async def plan_node(state: AgentState) -> dict:
    """Generates a plan from the objective."""
    llm = get_llm("planner")  # see config/models.py
    response = await llm.ainvoke([
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": state.objective},
    ])
    return {"plan": parse_plan(response.content), "next_node": "execute"}
```

A node returns a **partial state update** (dict). LangGraph merges it.

## Multi-agent supervisor pattern

```
              ┌─────────────┐
              │  Supervisor │ ◀── routes to next worker
              └─────┬───────┘
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  ┌─────────┐  ┌─────────┐  ┌──────────┐
  │Forecaster│  │Battery │  │ Tariff   │
  │  Agent   │  │Operator│  │Negotiator│
  └────┬────┘  └────┬───┘  └────┬─────┘
       └────────────┼───────────┘
                    ▼
              ┌─────────────┐
              │   Final     │
              │  Decision   │
              └─────────────┘
```

Use this for AthenaGrid (microgrid) and any workflow with 3+ specialist agents.

## Tool design

Every tool:

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

class GetSolarForecastInput(BaseModel):
    location: str = Field(description="ISO city code, e.g. 'TUN'")
    horizon_hours: int = Field(default=24, ge=1, le=168)

@tool("get_solar_forecast", args_schema=GetSolarForecastInput)
async def get_solar_forecast(location: str, horizon_hours: int = 24) -> dict:
    """Returns hourly solar irradiance forecast for the given location.
    Uses Chronos-Bolt foundation model on NASA POWER historical data.
    Returns: {hours: [iso8601...], ghi_wm2: [float...]}.
    Raises: ValueError if location unknown."""
    ...
```

Bind tools to the LLM with `llm.bind_tools([...])`. Use `ToolNode` from `langgraph.prebuilt` for tool execution.

## MCP integration

For hardware tools, write an MCP server and connect via:

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "battery": {"command": "python", "args": ["src/mcp_servers/battery_server.py"]},
    "inverter": {"command": "python", "args": ["src/mcp_servers/inverter_server.py"]},
})
tools = await client.get_tools()
```

This is the moat: agents don't know they're controlling hardware. They just call tools.

## Streaming reasoning to the frontend

```python
async for event in graph.astream_events(
    {"objective": user_request},
    config={"configurable": {"thread_id": session_id}},
    version="v2",
):
    if event["event"] == "on_chat_model_stream":
        await websocket.send_json({"type": "token", "data": event["data"]["chunk"].content})
    elif event["event"] == "on_tool_start":
        await websocket.send_json({"type": "tool_call", "data": event["name"]})
```

The frontend's right-rail "agent trace" panel reads this stream.

## Evaluation (tests/test_<agent>.py)

```python
import pytest
from langsmith.evaluation import aevaluate

GOLDEN = [
    {"input": "minimize my bill tomorrow", "expected": {"action": "shift_loads"}},
    {"input": "is my battery healthy?", "expected": {"contains": "soh"}},
    # add 5+
]

@pytest.mark.asyncio
async def test_supervisor_routes_correctly():
    graph = build_graph()
    for case in GOLDEN:
        result = await graph.ainvoke({"objective": case["input"]})
        assert evaluator(result, case["expected"])
```

## Things NOT to do

- Don't put hardcoded device IPs in nodes — they belong in MCP servers.
- Don't use synchronous LLM calls inside an async graph — use `ainvoke` / `astream`.
- Don't skip state schema typing. Untyped state = runtime errors at the worst time.
- Don't re-create the graph on every request; build once at module import, reuse.

## Hackathon shortcuts

- Skip MCP for the first iteration; use plain `@tool` decorators.
- SqliteSaver checkpointer is fine; Redis is overkill for 24h.
- Use Claude Sonnet 4 for everything if you only have 1 LLM provider key.
- Pre-cache 3 demo inputs and run them at startup so the demo is warm.
