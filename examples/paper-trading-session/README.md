# Paper-trading session — verifiable usage record (4-agent stack)

This is the recorded session for the **full 4-agent runtime** (researcher →
strategist → risk-manager → executor → bitget-adapter). Smaller than the
two-agent demo but exercises more of the bus.

## Contents

`session.jsonl` — 9 lines, 3 fills + 6 order_updates.

## Reproduce

```bash
node scripts/demo-paper-session.mjs
# rewrites session.jsonl
```

## Hash (committed)

```
04c890019215317e662937e7281fbb2fa91b6476b228ae403fa41d964ba27683  examples/paper-trading-session/session.jsonl
```

## What's verified

- All 3 buys are BTCUSDT, sized 0.02 then 0.02 then ~0.0017 — the third
  order was shrunk by the risk engine to fit the 20% per-symbol cap
  (10k equity × 20% = 2k USDT → ~0.0333 BTC max → actual fill ~0.0017
  after fees + price movement). The risk engine in action, recorded.
- See `examples/two-agent-demo/README.md` for the format details.
