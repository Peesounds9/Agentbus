# @agentbus/runtime

The 4-agent reference runtime: `researcher → strategist → risk-manager → executor`
plus a backtest harness for replaying recorded sessions.

## What it provides

- **`AgentBusRuntime`** — boots the 4-agent pipeline on a single bus, with the
  Bitget adapter, a paper-session recorder, and an `injectTick` helper for demos.
- **`replaySession()`** — reads a recorded JSONL log and reconstructs
  realized PnL, final positions, and average cost basis.

## Install

```bash
pnpm add agentbus-runtime
```

## Minimal example

```ts
import { AgentBusRuntime } from 'agentbus-runtime';

const rt = new AgentBusRuntime({
  mode: 'paper',
  paperCashUsdt: 10_000,
  logPath: './logs/session.jsonl',
});
await rt.start();

rt.injectTick({ bias: 'risk_on', confidence: 0.7 });
// ... agents cooperate on the bus, orders get sized, risk-checked, executed ...

const stats = rt.recorder.markToMarket({ BTCUSDT: 60_000 });
await rt.stop();
```

## Backtest

```ts
import { replaySession } from 'agentbus-runtime';

const result = replaySession('./examples/paper-trading-session/session.jsonl', {
  BTCUSDT: 60_000,
});
// {
//   fills: 3,
//   orders: 6,
//   realizedPnlUsdt: 0,
//   finalPositions: { BTCUSDT: 0.041661 },
//   avgCost: { BTCUSDT: 2499.64 }
// }
```

## CLI

```bash
node scripts/run-backtest.mjs examples/paper-trading-session/session.jsonl
```

## Docs

- [`docs/architecture.md`](../../docs/architecture.md) — how the 4-agent pipeline fits
