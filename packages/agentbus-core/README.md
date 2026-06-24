# @agentbus/core

The core library: typed pub/sub message bus, Agent lifecycle, risk engine,
and pluggable transports.

## What it provides

- **`AgentBus`** — the central bus class. Pub/sub with topic wildcards (`*` and `>`),
  per-subscriber backpressure queues, ring-buffer history, tracing fields.
- **`Agent`** — lifecycle wrapper. Declares topics to listen on, emits heartbeats,
  tracks uptime + status.
- **`evaluateOrder`** — pure risk engine. Returns `allow | shrink | reject` with
  detailed check breakdown.
- **`BusTransport`** — pluggable cross-process delivery. Ships with
  `InProcessTransport` (default) and an optional `RedisTransport` (requires `ioredis`).

## Install

```bash
# In a workspace project, add via:
pnpm add agentbus-core

# Outside the monorepo:
npm install agentbus-core
```

## Minimal example

```ts
import { AgentBus } from 'agentbus-core';

const bus = new AgentBus({ persist: true });
const subId = bus.subscribe<string>('signal.>', (msg) => {
  console.log(`${msg.from}: ${msg.payload}`);
});
bus.publish('signal.btc', 'signal', 'breakout 60k', { from: 'signaler' });
```

## API summary

| Export | Type | Purpose |
|---|---|---|
| `AgentBus` | class | The bus itself |
| `Agent` | class | Agent lifecycle wrapper |
| `BusMessage<T>` | interface | The envelope wrapping every message |
| `evaluateOrder` | function | Risk engine (returns `RiskCheck`) |
| `RedisTransport` | class | Optional Redis transport (peer dep: `ioredis`) |
| `InProcessTransport` | class | Default no-op transport |

## Docs

- [`docs/architecture.md`](../../docs/architecture.md) — design + topology
- [`docs/messages.md`](../../docs/messages.md) — message kinds + topics
- [`docs/redis.md`](../../docs/redis.md) — Redis transport
