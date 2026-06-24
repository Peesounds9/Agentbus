# AgentBus Architecture

## Goals

1. **Observable.** Every message is recorded with timestamp, producer, kind,
   topic, correlation ID, and causation ID. You can reconstruct any session
   from the JSONL log alone.
2. **Pluggable.** The bus core has zero Bitget-specific knowledge. Adding
   a new exchange = writing one adapter that satisfies the same `submitOrder`
   / `snapshot` contract.
3. **Forgiving.** Risk manager *shrinks* orders that breach caps instead of
   rejecting them when possible. Dropped messages and backpressure are
   surfaced, not hidden.
4. **Compatible.** Drops into the Bitget Agent Hub ecosystem — same MCP
   conventions, same env-var credential model, same `npx` install path.

## Topology

```
                       ┌─────────────────────────────────────────┐
                       │             AgentBus (core)             │
   Agent A ─publish──▶ │  ┌────────┐  ┌─────────┐  ┌──────────┐ │ ──▶ Agent B
                       │  │Topics  │  │History  │  │Subscribers│ │
   Agent C ─publish──▶ │  │signal.*│  │ring buf │  │ queues   │ │ ──▶ Agent D
                       │  │thesis.*│  │JSONL    │  │per-sub   │ │
   Agent E ─publish──▶ │  │order.* │  │         │  │          │ │ ──▶ Agent F
                       │  └────────┘  └─────────┘  └──────────┘ │
                       └─────────────────────────────────────────┘
                                       │
                                       ▼
                       ┌─────────────────────────────────────────┐
                       │  BitgetAdapter  (paper | live)         │
                       │   paper: in-process deterministic sim  │
                       │   live : stdio JSON-RPC to             │
                       │          `bitget-mcp-server`           │
                       └─────────────────────────────────────────┘
```

## Message lifecycle

1. **Producer agent** calls `bus.publish(topic, kind, payload, { from })`.
2. Bus assigns `id`, `ts`, validates `expiresAt`, appends to ring buffer,
   and fans out to matching subscribers + attached transports.
3. **Subscriber**'s handler runs async. The bus per-subscriber queue
   caps backpressure (`maxQueuePerSubscriber`); overflow is counted in
   `bus.inspect().dropped`.
4. **Recorder** subscribes to `order.bitget.>` and writes one JSON line
   per `fill` / `order_update` — this is the file the hackathon judges open.

## Tracing

Every message carries:

- `id` — unique message id
- `ts` — wall-clock ms
- `from` — producer agent id
- `correlationId` — groups a logical workflow end-to-end
- `causationId` — the id of the message that directly caused this one

So you can rebuild a session as a DAG.

## Risk pipeline

Plans → Risk Manager → Order topic → Executor → Bitget:

```
plan  ─▶ risk_check (allow | shrink | reject)
              │
              ▼  allow
           order ─▶ executor ─▶ submitOrder ─▶ fill / order_update
              │
              ▼  shrink
           order (sized to fit per-symbol cap)
              │
              ▼  reject
           risk_alert (warn) — no order emitted
```

The risk manager is also a watchdog: if any agent's heartbeats go silent for
>30s, it publishes a `risk_alert` with `action: flatten`.

## Modes

| Mode | Network | Credentials | Used for |
|---|---|---|---|
| `paper` | none | none | Development, demos, judges' first impression |
| `live` | spawns `bitget-mcp-server` | `BITGET_API_KEY` etc. | Production, real-money trading |

Both modes publish identical message shapes, so the same agents, the same
recorder, and the same backtest work for either.
