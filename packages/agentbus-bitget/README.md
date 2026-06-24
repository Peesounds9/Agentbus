# @agentbus/bitget

Bitget Agent Hub integration. Provides `BitgetAdapter` (paper + live modes)
and the installable `agentbus-bitget` skill for Claude Code / Cursor / Codex.

## What it provides

- **`BitgetAdapter`** — wraps Bitget's MCP server (`bitget-mcp-server`) so any
  AgentBus agent can place orders, query balances, and receive fills via the bus.
- **`PaperSessionRecorder`** — writes every `order_update` and `fill` to a JSONL
  audit log. The artifact judges use to verify your "live trading record or paper trading log."
- **`installSkill()`** — drops a `SKILL.md` into a Claude Code / Cursor skills
  folder so the host AI knows how to drive Bitget through AgentBus.

## Two execution modes

| Mode | Network | Credentials | Use for |
|---|---|---|---|
| `paper` | none | none | Dev, demos, judges' first impression |
| `live` | spawns `bitget-mcp-server` | `BITGET_API_KEY` etc. | Real trading |

## Install

```bash
pnpm add agentbus-bitget   # workspace project
```

## Minimal example

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

## Skill install

```bash
node packages/agentbus-cli/dist/cli.js install-skill ~/.claude/skills
# → drops SKILL.md so Claude Code knows how to drive Bitget through AgentBus
```

## Docs

- [`docs/bitget.md`](../../docs/bitget.md) — adapter details, paper vs live
