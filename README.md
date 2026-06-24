# AgentBus

**A typed, persistent pub/sub message bus for AI trading agents — built on top of Bitget Agent Hub.**

Submission for **Bitget AI Base Camp · Hackathon S1** · Track 2 — Trading Infra

---

## What this is

Bitget Agent Hub gives you **58 trading APIs** and **5 perception skills**. As soon as
you start building on it you run into the same wall: *one* AI agent is not enough —
you want a researcher, a strategist, a risk manager, and an executor coordinating
on a single Bitget account, with full traceability.

**AgentBus** is the missing piece — a typed message bus designed for AI trading
agents. Every agent publishes typed messages (`signal`, `thesis`, `order`,
`fill`, `risk_alert`, `metric`) to topics; every other agent reacts. The whole
flow is observable, replayable, and Bitget-aware.

```
   Researcher ─signal/thesis─▶  Strategist
                                  │
                                  ▼  plan
                              Risk Manager ─risk_check/alert─▶ (loop)
                                  │
                                  ▼  order
                                Executor ─submitOrder─▶  BitgetAdapter
                                                                 │
                                                                 ▼
                                                          live / paper fill
                                                          + JSONL audit log
```

---

## What this repo contains

| Package | Purpose |
|---|---|
| [`packages/agentbus-core`](./packages/agentbus-core/) | Typed pub/sub bus, Agent lifecycle, Risk engine |
| [`packages/agentbus-bitget`](./packages/agentbus-bitget/) | Bitget adapter (live via `bitget-mcp-server`, or paper sim), Skill installer |
| [`packages/agentbus-runtime`](./packages/agentbus-runtime/) | Wires the 4 reference agents on a single bus; backtest harness |
| [`packages/agentbus-cli`](./packages/agentbus-cli/) | `agentbus inspect / publish / tail / run / backtest / install-skill` |
| [`packages/agentbus-mcp`](./packages/agentbus-mcp/) | MCP server so Claude Code / Cursor / Codex can drive the bus |
| [`agents/researcher`](./agents/researcher/) | Reference: macro/sentiment/news/onchain → `signal` |
| [`agents/strategist`](./agents/strategist/) | Reference: `signal` → `thesis` + `plan` |
| [`agents/risk-manager`](./agents/risk-manager/) | Reference: `plan` → `risk_check` → approve/shrink/reject |
| [`agents/executor`](./agents/executor/) | Reference: approved `order` → Bitget call → `fill` |
| [`examples/paper-trading-session/`](./examples/paper-trading-session/) | Pre-recorded demo session (JSONL log) |
| [`docs/`](./docs/) | Architecture, Bitget integration, MCP usage, hackathon mapping |

---

## Quick start

```bash
# 1. Install
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus
pnpm install

# 2. Build everything
pnpm -r build

# 3. Run the full test suite (22 tests)
pnpm -r test

# 4. Smoke-test the runtime (no network)
pnpm smoke

# 5. Run a paper-trading session and write the JSONL audit log
pnpm demo
cat examples/paper-trading-session/session.jsonl

# 6. Replay the session through the backtest harness
pnpm backtest examples/paper-trading-session/session.jsonl
```

Output of step 6 (the backtest against the included sample session):

```json
{
  "fills": 3,
  "orders": 6,
  "startTs": 1782314392411,
  "endTs": 1782314393558,
  "realizedPnlUsdt": 0,
  "finalPositions": { "BTCUSDT": 0.041661 },
  "avgCost": { "BTCUSDT": 2499.64 }
}
```

---

## How it talks to Bitget

The Bitget adapter has two modes:

- **`paper`** — deterministic local simulation. No network, no credentials.
  The bus still publishes real `order`, `fill`, and `order_update` messages
  so the rest of the system can be exercised end-to-end. This is the mode
  the included demo uses, and the JSONL log satisfies the hackathon's
  *"live trading record or paper trading log"* requirement.

- **`live`** — spawns `bitget-mcp-server` over stdio (the official
  `Bitget-AI/agent_hub` package) and forwards JSON-RPC calls. Requires
  `BITGET_API_KEY`, `BITGET_SECRET_KEY`, `BITGET_PASSPHRASE` in the env,
  exactly like the rest of the Bitget Agent Hub ecosystem.

Set `AGENTBUS_MODE=live` (and the standard Bitget env vars) to switch.

```bash
export AGENTBUS_MODE=live
export BITGET_API_KEY=...
export BITGET_SECRET_KEY=...
export BITGET_PASSPHRASE=...
npx agentbus run
```

---

## Using the MCP server (Claude Code / Cursor / Codex)

Add to your Claude Code MCP config:

```bash
claude mcp add -s user \
  --env AGENTBUS_MODE=paper \
  agentbus \
  -- npx -y agentbus-mcp
```

Then any Claude Code session gains five new tools:

| Tool | Purpose |
|---|---|
| `agentbus_inspect` | Bus state, subscribers, queue depths |
| `agentbus_publish` | Publish a typed message to any topic |
| `agentbus_history` | Recent messages matching a filter |
| `agentbus_subscribe` | Snapshot of recent matching messages |
| `agentbus_inject_tick` | Push a macro/sentiment event into the bus |

Cursor / Codex config is identical — see [docs/mcp.md](./docs/mcp.md).

---

## Why this maps well to Track 2 (Trading Infra)

The hackathon brief for Track 2 calls for *"tools or frameworks for Agents,
products for traders (monitoring dashboards, visualization tools, etc.),
and strategy evaluation and benchmarking systems."*

AgentBus is exactly that:

- ✅ **Framework for agents** — typed messages, lifecycle, tracing
- ✅ **Monitoring** — `agentbus inspect`, JSONL audit log, heartbeats
- ✅ **Strategy evaluation** — replayable session log + backtest harness
- ✅ **Reusability** — 4 reference agents anyone can fork, plus a
     Claude/Cursor-installable skill
- ✅ **Built on Agent Hub** — wraps the same MCP primitives; drops into
     any Agent Hub project via `agentbus-bitget`

---

## Documentation

- [Architecture overview](./docs/architecture.md)
- [Message kinds and topic conventions](./docs/messages.md)
- [Bitget integration guide](./docs/bitget.md)
- [MCP usage with Claude Code / Cursor](./docs/mcp.md)
- [Hackathon submission mapping](./docs/hackathon.md)

---

## Hackathon compliance

This repo satisfies the **Track 2 — Trading Infra** submission requirements:

| Requirement | Where it lives |
|---|---|
| Public GitHub repo | ✅ this repo |
| Project description (4-part structure) | [`docs/hackathon.md`](./docs/hackathon.md) |
| README with install + usage | ✅ this file + per-package READMEs |
| Verifiable usage record | [`examples/paper-trading-session/session.jsonl`](./examples/paper-trading-session/session.jsonl) + backtest output |
| Demo (no login required) | `pnpm smoke` / `pnpm demo` / `agentbus inspect` |
| Uses Bitget Agent Hub | ✅ `agentbus-bitget` wraps `bitget-mcp-server` |

---

## License

MIT — see [LICENSE](./LICENSE).

Built for Bitget AI Base Camp Hackathon S1 (May 27 – Jun 30, 2026).
