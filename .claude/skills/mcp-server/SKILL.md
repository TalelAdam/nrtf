---
name: mcp-server
description: Use when building a Model Context Protocol (MCP) server that exposes hardware (ESP32, Modbus inverter, SCADA) or a data source (TimescaleDB, smart contract) as LLM tools. Trigger on "wrap X as MCP", "create an MCP server for Y device", "expose Z to the agents".
---

# MCP Server Pattern (for hardware & data sources)

## When to use this

Any time the AI agents need to control or read from a specific subsystem — a battery cell, an electrolyzer PSU, a greenhouse actuator, a grid simulator, a smart-contract state. MCP is the moat: it decouples agent logic from device specifics, and makes the same tools available to any LLM (Claude, GPT, Gemini, local Llama).

## File layout

```
apps/ai-agents/src/mcp_servers/
├── battery_server.py
├── inverter_server.py
├── electrolyzer_server.py
├── greenhouse_server.py
├── grid_simulator_server.py
└── contract_server.py        # smart-contract reads/writes
```

Each MCP server is a standalone Python process.

## Standard server skeleton

```python
"""Battery MCP Server — exposes 18650 cell telemetry and charge control as tools."""
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field
import httpx

mcp = FastMCP("battery")

# State (in-process; for prod use Redis)
DEVICE_STATE: dict = {}

class BatteryReading(BaseModel):
    device_id: str
    voltage_v: float
    current_a: float
    temperature_c: float
    timestamp: str

@mcp.tool()
async def get_battery_state(device_id: str, window_s: int = 60) -> dict:
    """Returns the most recent state of a battery cell.

    Args:
        device_id: ESP32 device ID, e.g. 'esp32-batt-01'
        window_s: how far back to average (10-600 seconds)

    Returns:
        Dict with voltage_v, current_a, temperature_c, soc_percent, soh_percent.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"http://backend:3000/api/v1/devices/{device_id}/latest")
        return r.json()

@mcp.tool()
async def set_charge_current(device_id: str, current_a: float) -> dict:
    """Sets the charge current for a battery cell. Safety-clamped to [0, 2A].

    Args:
        device_id: target device
        current_a: requested charge current in amps (0 = stop)

    Returns:
        Dict with applied_current_a and status ('ok' | 'clamped' | 'error').
    """
    safe_current = max(0.0, min(current_a, 2.0))
    status = "clamped" if safe_current != current_a else "ok"
    # publish to MQTT or POST to backend
    async with httpx.AsyncClient() as client:
        await client.post(
            f"http://backend:3000/api/v1/devices/{device_id}/cmd/set_current",
            json={"current_a": safe_current},
        )
    return {"applied_current_a": safe_current, "status": status}

@mcp.resource("battery://{device_id}/history")
async def battery_history(device_id: str) -> str:
    """Time-series snapshot of the last hour of voltage/current/temperature."""
    # Returns CSV or JSON; LLM can read this as context
    ...

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

## Tool docstrings = LLM prompts

The docstring is what the LLM sees when deciding whether to call this tool. Be **specific**:

- State the unit (`amps`, not `current`).
- State the safe range.
- State error modes.
- Give one example value if the parameter is obscure.

## Resources vs tools

- **Tool**: a function the agent calls to act or query (synchronous answer).
- **Resource**: a static-ish blob the agent can read for context (e.g., last 1h of telemetry as CSV).

Use resources for "give me a slice of historical state to reason over"; tools for "do this now."

## Connecting from LangGraph

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "battery": {
        "command": "python",
        "args": ["-m", "src.mcp_servers.battery_server"],
        "transport": "stdio",
    },
    "inverter": {
        "command": "python",
        "args": ["-m", "src.mcp_servers.inverter_server"],
    },
})

tools = await client.get_tools()  # returns LangChain BaseTool instances
llm_with_tools = llm.bind_tools(tools)
```

The agent doesn't import `battery_server` directly — it discovers tools at runtime. This is the decoupling that makes MCP powerful.

## Security

- MCP servers should be read-only by default. Any setter (`set_*`, `enable_*`, `disconnect_*`) should be gated behind an API key check.
- Log every tool invocation with the agent ID and the parameters. This is your audit trail for the pitch.
- Clamp control inputs at the MCP layer, not in the agent. Even a bad agent shouldn't fry a cell.

## Lifecycle in docker-compose

```yaml
services:
  mcp-battery:
    build: ./apps/ai-agents
    command: python -m src.mcp_servers.battery_server
    depends_on: [backend]

  mcp-electrolyzer:
    build: ./apps/ai-agents
    command: python -m src.mcp_servers.electrolyzer_server
    depends_on: [backend]
```

Each MCP server is its own service. Agents discover them via env config.

## Things NOT to do

- Don't expose raw database queries as tools. Wrap them in semantic functions (`get_device_health` not `select_from_readings`).
- Don't return giant blobs from tools. Page or summarize first.
- Don't let agent IDs be unauthenticated; use a signed JWT in tool headers if MCP server is over the network.

## Hackathon shortcut

For 24h, skip multi-process MCP. Just write `@tool` functions in `tools/` and bind them directly. Refactor to MCP if time allows.
