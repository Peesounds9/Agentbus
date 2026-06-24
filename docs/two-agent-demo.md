# Two-Agent Cooperating Demo

This is the demo the Bitget hackathon submission puts front-and-centre. It
captures the entire "solo agent → team" story in a single browser tab.

## What you see

When you open `http://localhost:8787` after running the demo, three panels
update live:

| Panel | Shows |
|---|---|
| 📡 Signaler | Raw signals published on `signal.raw.<sym>` |
| 🤖 Classifier | Scored signals on `signal.scored` + dropped signals on `signal.noise` |
| ⚡ Executor | Approved orders submitted via Bitget adapter (paper) + resulting fills |

A new signal goes from the signaler → classifier scores it → executor fires
(if `quality ≥ 0.6`) → fill appears on the bus → JSONL audit log written.

## Run it

```bash
pnpm install
pnpm -r build
node scripts/demo-two-agents.mjs --inject
# open http://localhost:8787
```

### With the real Qwen classifier (recommended)

```bash
export BITGET_QWEN_API_KEY=sk-...
node scripts/demo-two-agents.mjs --inject
# dashboard title bar shows "classifier=qwen"
```

The Qwen proxy is `https://hackathon.bitgetops.com/v1`, model
`qwen3.6-plus`. Without `BITGET_QWEN_API_KEY` the classifier falls back to
a cheap heuristic (length + symbol presence + confidence alignment) so the
demo always runs offline.

### Inject signals from the browser / curl

```bash
curl -X POST http://localhost:8787/api/publish \
  -H 'content-type: application/json' \
  -d '{"symbol":"BTCUSDT","direction":"long","confidence":0.9,"rationale":"whale 1.2k BTC, CVD positive 18m, 4h close above 60k"}'
```

Or replay the built-in demo sequence:

```bash
curl -X POST http://localhost:8787/api/inject
```

### Share the bus with another process

To watch signals flow between two processes, set `REDIS_URL`:

```bash
REDIS_URL=redis://127.0.0.1:6379 node scripts/demo-two-agents.mjs --inject
# in another shell, publish a signal:
node scripts/publish-signal.mjs --symbol=ETHUSDT --direction=long --confidence=0.8 \
  --rationale="eth/btc ratio breakout, gas < 10 gwei, l2 inflows +15% 24h"
```

Both processes see the same bus state.

## What gets recorded

Every fill / order_update is appended to
`examples/two-agent-demo/session.jsonl`. Replay it through the backtest
harness:

```bash
node scripts/run-backtest.mjs examples/two-agent-demo/session.jsonl
```

The output shows fills, realized PnL, final positions, and avg cost — the
exact record judges ask for.

## How the demo differs from the four-agent stack

The four-agent runtime (`agentbus-runtime`, the `researcher → strategist →
risk → executor` pipeline) is still in the repo for users who want a more
production-shaped setup. The two-agent demo is the **cleaner, more focused**
story for a hackathon submission because:

- Two agents is the minimum to tell the "team" story.
- The Qwen classifier is the **new** contribution — no other Bitget Agent
  Hub project scores signals with an LLM in the loop.
- The dashboard gives judges a single screenshot that proves the bus is real.
- The recording + backtest give them a verifiable artifact.
