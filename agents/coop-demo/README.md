# @agentbus/coop-demo

The **two cooperating agents demo** with built-in HTTP dashboard.

## What's in here

Three agents on one bus:

- **signaler** — publishes raw signals on demand
- **classifier** — Qwen-powered scoring agent
- **executor** — only fires when classifier passes `quality ≥ 0.6`

Plus a tiny HTTP dashboard that streams the live bus state into a single
HTML page.

## Install

This package is built as part of the monorepo. To run it:

```bash
pnpm install
pnpm -r build
node scripts/demo-two-agents.mjs --inject
# → http://localhost:8787
```

## Use programmatically

```ts
import { CoopDemo } from 'agentbus-coop-demo';

const demo = new CoopDemo({
  mode: 'paper',
  paperCashUsdt: 10_000,
  dashboardPort: 8787,
});
await demo.start();

// Publish a signal programmatically:
demo.publishSignal({
  symbol: 'BTCUSDT',
  direction: 'long',
  confidence: 0.9,
  rationale: 'whale 1.2k BTC, CVD positive, 4h close above 60k',
});

// Inject a believable demo sequence:
demo.injectDemoSequence();

await demo.stop();
```

## Docs

- [`docs/two-agent-demo.md`](../../docs/two-agent-demo.md) — judge walkthrough
