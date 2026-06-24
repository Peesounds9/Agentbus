# @agentbus/mcp

Model Context Protocol (MCP) server for AgentBus. Lets Claude Code, Cursor,
Codex, or any MCP-compatible client drive the bus through natural language.

## Tools exposed

| Tool | Purpose |
|---|---|
| `agentbus_inspect` | Bus state, subscribers, queue depths |
| `agentbus_publish` | Publish a typed message to any topic |
| `agentbus_history` | Recent messages matching a filter |
| `agentbus_subscribe` | Snapshot of recent messages matching a pattern |
| `agentbus_inject_tick` | Push a macro / sentiment event into the bus |

## Resources

| URI | Content |
|---|---|
| `agentbus://topics` | Distinct topics seen recently |
| `agentbus://agents` | Agents seen via heartbeats |

## Install + run

```bash
pnpm add agentbus-mcp
# Or run directly via npx:
npx agentbus-mcp
```

## Claude Code config

```bash
claude mcp add -s user \
  --env AGENTBUS_MODE=paper \
  agentbus \
  -- npx -y agentbus-mcp
```

## Cursor config

`~/.cursor/mcp.json`:

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

## Codex config

`~/.codex/config.toml`:

```toml
[[mcp_servers]]
name = "agentbus"
command = "npx"
args = ["-y", "agentbus-mcp"]

[mcp_servers.env]
AGENTBUS_MODE = "paper"
```

## Docs

- [`docs/mcp.md`](../../docs/mcp.md) — full usage guide with examples
