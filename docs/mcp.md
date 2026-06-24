# MCP Usage (Claude Code / Cursor / Codex / OpenClaw)

The `agentbus-mcp` server exposes the bus to any MCP-compatible AI client.

## Install

### Claude Code

```bash
claude mcp add -s user \
  --env AGENTBUS_MODE=paper \
  agentbus \
  -- npx -y agentbus-mcp
```

For live trading, pass your Bitget credentials too:

```bash
claude mcp add -s user \
  --env AGENTBUS_MODE=live \
  --env BITGET_API_KEY=... \
  --env BITGET_SECRET_KEY=... \
  --env BITGET_PASSPHRASE=... \
  agentbus \
  -- npx -y agentbus-mcp
```

### Cursor

Add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "agentbus": {
      "command": "npx",
      "args": ["-y", "agentbus-mcp"],
      "env": { "AGENTBUS_MODE": "paper" }
    }
  }
}
```

### Codex

Add to `~/.codex/config.toml`:

```toml
[[mcp_servers]]
name = "agentbus"
command = "npx"
args = ["-y", "agentbus-mcp"]

[mcp_servers.env]
AGENTBUS_MODE = "paper"
```

## Tools exposed

| Tool | Purpose |
|---|---|
| `agentbus_inspect` | Bus state, subscriber queues, history size |
| `agentbus_publish` | Publish a typed message to any topic |
| `agentbus_history` | Recent messages matching `{ topic, kind, limit }` |
| `agentbus_subscribe` | Snapshot of recent messages matching a pattern |
| `agentbus_inject_tick` | Push a `macro` / `sentiment` event into the bus |

## Resources exposed

| URI | Content |
|---|---|
| `agentbus://topics` | Distinct topics seen recently |
| `agentbus://agents` | Agents seen via heartbeats |

## Example: drive the bus from Claude

Once connected, ask Claude:

> "Inspect the agent bus, then inject a `risk_on` tick with confidence 0.9,
> wait a moment, and show me the resulting order updates."

Claude will use `agentbus_inspect` → `agentbus_inject_tick` → `agentbus_history`
in sequence, and you'll see the full chain tick → signal → thesis → plan →
order → fill appear on the bus.

## Example: drive the bus from Cursor

Open the Agent panel, attach the `agentbus` MCP server, then in chat:

> "Publish a manual buy thesis on ETHUSDT with stop 2800, target 3500, then
> tail the risk_alert topic."

## Notes on safety

- `AGENTBUS_MODE=paper` (default) cannot touch real funds — fills are
  simulated.
- `AGENTBUS_MODE=live` requires valid Bitget credentials. The bus's
  risk-manager agent will still cap position sizes and shrink
  over-sized orders.
- Every order, fill, and risk decision is logged to the JSONL file at
  `AGENTBUS_LOG` (default `./logs/session.jsonl`).
