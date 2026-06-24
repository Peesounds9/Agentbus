# Redis Transport

AgentBus ships with a **lightweight, Redis-backed** cross-process transport so
two agents on different machines can share one bus. ioredis is an **optional
peer dep** — if you don't install it, the bus falls back to in-process mode
and nothing breaks.

## Install

```bash
pnpm add ioredis
# or
npm install ioredis
```

## Run a redis

The fastest local dev path is Docker:

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

Or install redis natively (`apt install redis-server && redis-server`).

## Attach a Redis transport

```ts
import { AgentBus, RedisTransport } from 'agentbus-core';

const bus = new AgentBus();
const t = new RedisTransport({ url: 'redis://127.0.0.1:6379', persist: true });
bus.attachTransport(t);

// Now every publish() fans out to all other bus instances that share the
// same redis. Messages are also persisted to a per-bus log so newcomers
// replay recent history on attach.
```

## Channels

Per bus id, the transport uses:

| Channel | Direction | Purpose |
|---|---|---|
| `agentbus:<busId>:publish` | both | Live message fan-out |
| `agentbus:<busId>:hello` | both | 5s heartbeat for presence |
| `agentbus:<busId>:log` | redis stream | Per-bus history (capped `LTRIM`) |

The `busId` is auto-assigned per `new AgentBus()` instance. To make two
processes share the same logical bus, you need them to use the **same bus id**.
Set it via `bus.id` after construction (currently the id is `readonly` —
override at construction by patching the source, or use a custom transport).

## Env-var shortcut

The CLI / runtime accepts `REDIS_URL` automatically:

```bash
REDIS_URL=redis://127.0.0.1:6379 node scripts/demo-two-agents.mjs
```

When `REDIS_URL` is set *and* `ioredis` is installed, the runtime swaps the
in-process transport for `RedisTransport`. Without ioredis, the bus logs a
warning and continues in-process (so demos never break).

## Why this matters for the hackathon

The Bitget Base Camp brief asks for *"verifiable usage records."* A
Redis-backed bus means judges can:

1. Point two processes at the same Redis.
2. Watch signals emitted by one show up in the other agent's dashboard.
3. Replay any session by re-reading the per-bus log.

That makes the "two cooperating agents" story reproducible across judges'
machines — not just on ours.
