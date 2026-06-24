# Bitget Integration

AgentBus ships a Bitget adapter (`agentbus-bitget`) that wraps the official
[Bitget Agent Hub](https://github.com/Bitget-AI/agent_hub). It plugs into any
AgentBus topology — your agents don't need to know whether they're trading
against the real exchange or the deterministic paper simulator.

## Two modes

### Paper mode (default — no network)

```bash
node packages/agentbus-cli/dist/cli.js run --mode=paper --cash=10000
```

Internally:
- A virtual portfolio tracks `cash`, `positions`, and a fill history.
- Every order produces a real `order_update` (new → filled) and a `fill` event
  on the bus, just like a live exchange would.
- Deterministic: same tick sequence → same fills.

This is the mode used by `pnpm smoke`, `pnpm demo`, and the included
paper-trading session in `examples/paper-trading-session/session.jsonl`.

### Live mode

```bash
export BITGET_API_KEY=...
export BITGET_SECRET_KEY=...
export BITGET_PASSPHRASE=...
export AGENTBUS_MODE=live
node packages/agentbus-cli/dist/cli.js run --mode=live
```

Internally:
- Adapter spawns `npx -y bitget-mcp-server` over stdio.
- Order submissions forward to the Bitget MCP `tools/call` interface
  (`futures_place_order` for leverage>0 orders, `spot_place_order` otherwise).
- Responses are parsed and republished as `order_update` / `fill` messages.

## Credentials

The adapter reads from the same env vars as the official Agent Hub:

| Var | Required for |
|---|---|
| `BITGET_API_KEY` | all private endpoints (account, orders) |
| `BITGET_SECRET_KEY` | signing |
| `BITGET_PASSPHRASE` | signing |
| `AGENTBUS_MODE` | `paper` (default) or `live` |
| `AGENTBUS_CASH` | starting cash in paper mode (default 10000) |
| `AGENTBUS_LOG` | path to the JSONL audit log (default `./logs/session.jsonl`) |

Public market data works without credentials.

## Adapter API

```ts
import { AgentBus } from 'agentbus-core';
import { BitgetAdapter } from 'agentbus-bitget';

const bus = new AgentBus();
const adapter = new BitgetAdapter({ bus, mode: 'paper', paperCashUsdt: 10_000 });

await adapter.submitOrder(
  { symbol: 'BTCUSDT', side: 'buy', type: 'market', size: 0.01, leverage: 2 },
  60_000, // reference price for paper fills
);

const snap = adapter.snapshot({ BTCUSDT: 60_000 });
// { cashUsdt, equityUsdt, positions, marks }
```

The snapshot is what the risk engine reads on every plan.

## Skill installer

To install the `agentbus-bitget` skill into a Claude Code / Cursor / Codex
skills folder:

```bash
node packages/agentbus-cli/dist/cli.js install-skill ~/.claude/skills
```

This drops a `SKILL.md` that describes the bus's Bitget integration so the
host AI can route Bitget operations through the bus.

## Compatibility with the official Agent Hub

- Same credential model (`BITGET_API_KEY` etc.)
- Same MCP transport (stdio JSON-RPC)
- Same `npx -y bitget-mcp-server` invocation
- Same tool names (`futures_place_order`, `spot_place_order`, ...)

You can use `bitget-hub install --target claude,codex` from the official
Agent Hub alongside AgentBus — they don't conflict; AgentBus adds a parallel
coordination layer.
