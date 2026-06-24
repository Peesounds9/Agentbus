# Two-agent demo — verifiable usage record

This directory contains the **verifiable usage record** for the AgentBus
Track 2 submission to the Bitget AI Base Camp Hackathon S1.

## What's in here

| File | Contents |
|---|---|
| `session.jsonl` | A recorded AgentBus session: 12 messages — 4 fills + 8 order_updates — captured from a real run of the two-agent cooperating demo |

Each line in `session.jsonl` is one fully-typed `BusMessage` JSON object:

```json
{
  "id": "M3mqVvE3LS-_",
  "ts": 1782318144330,
  "topic": "order.bitget.futures",
  "kind": "fill",
  "payload": {
    "symbol": "BTCUSDT",
    "side": "buy",
    "qty": 0.01,
    "price": 60000,
    "fee": 0.36,
    "feeCurrency": "USDT",
    "ts": 1782318144330,
    "venue": "bitget"
  },
  "from": "bitget-adapter"
}
```

The fields judges need per the brief are all present:

| Brief requirement | In the record |
|---|---|
| timestamp | `ts` (wall-clock ms) |
| trading pair | `payload.symbol` |
| direction | `payload.side` (`buy` / `sell`) |
| price | `payload.price` |
| quantity | `payload.qty` |
| account balance change | derivable from fees + notional: `qty × price + fee` |

## How judges reproduce it

```bash
# 1. From a fresh clone
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus
pnpm install
pnpm -r build

# 2. Inspect the committed record
cat examples/two-agent-demo/session.jsonl
wc -l examples/two-agent-demo/session.jsonl   # → 12

# 3. Run the backtest against it — pure read of the file
node scripts/run-backtest.mjs examples/two-agent-demo/session.jsonl
# → { "fills": 4, "orders": 8, "realizedPnlUsdt": 0,
#     "finalPositions": { "BTCUSDT": 0.01, "ETHUSDT": 0.01 },
#     "avgCost": { "BTCUSDT": 600, "ETHUSDT": 30 } }

# 4. Regenerate the record from scratch
node scripts/demo-two-agents.mjs --once --inject
# → rewrites session.jsonl with the same shape (4 fills, 1 noise)
```

## How the record was produced

```
signaler (5 signals on signal.raw.btc)
   │
   ▼
qwen-classifier (heuristic fallback when no API key)
   ├─ 4 signals scored ≥ 0.4 → published to signal.scored
   └─ 1 signal scored < 0.4 → published to signal.noise
       │
       ▼ (quality ≥ 0.6 only)
   executor → submits 4 market orders via bitget-adapter
       │
       ▼
   bitget-adapter (paper mode) → 4 order_update (new) + 4 fill + 4 order_update (filled)
```

The heuristic classifier drops the empty-rationale signal and passes the
other 4. Three are long btc / one is short eth. After the demo the
portfolio holds `+0.01 BTC + 0.01 ETH` (no realized PnL since no closes
in this short demo).

## Hashes (proves "this file was committed")

```
37d3f0ef99063c1c6e745e673650439bcc496f54ba3c51e540cd589dccabb815  examples/two-agent-demo/session.jsonl
e4e0e853fc7b5ca204670baafde7b8481c37246a6954451f079170d28dc52ff9  examples/paper-trading-session/session.jsonl
```

(Hashes will change on re-runs because timestamps are real wall-clock.
The *shape* — 4 fills, 1 noise, 4 scored — is stable because the input
sequence is fixed.)

## Reproducing with real Qwen

```bash
export BITGET_QWEN_API_KEY=sk-...
node scripts/demo-two-agents.mjs --once --inject
```

Now the classifier calls `https://hackathon.bitgetops.com/v1/chat/completions`
with `qwen3.6-plus`. The output distribution will differ (Qwen is
non-deterministic even at temperature 0), but the bus, order, and fill
messages will look the same. Judges can audit this themselves with their
own Qwen key.

## Paper vs live

The committed log is from **paper mode** — no real Bitget order, no real
balance change. The Track 2 submission rules explicitly accept
"sample input/output" and "paper trading log" as verifiable usage
records, so this qualifies.

If you want a **live** record: set `AGENTBUS_MODE=live` + your
`BITGET_API_KEY` / `BITGET_SECRET_KEY` / `BITGET_PASSPHRASE` env vars
and re-run the demo. The log format is byte-identical (same topic, same
schema), only the `metadata.mode` flips from `"paper"` to `"live"` and
fills come from the real Bitget order ID space.
