# AgentBus

**A typed pub/sub message bus for AI trading agents — built on top of Bitget Agent Hub.**

**Submission for Bitget AI Base Camp · Hackathon S1 · Track 2 — Trading Infra**

---

## What it is, in one sentence

AgentBus turns **solo LLM trading agents into teams** by giving them a
typed, Redis-backed pub/sub bus to publish signals and subscribe to each
other — with a Qwen-powered classifier in the loop to filter noise.

```
   📡 Signaler          ───signal.raw.btc───▶
                                                │
                                                ▼
                                          🤖 Classifier (Qwen 3.6-plus)
                                                │
                                ┌───────────────┼───────────────┐
                                ▼                               ▼
                          signal.scored                   signal.noise
                                │
                                ▼ (quality ≥ 0.6)
                          ⚡ Executor ──submitOrder──▶ Bitget Adapter
                                                              │
                                                              ▼
                                                          fill / order_update
                                                              │
                                                              ▼
                                                       📝 JSONL audit log
                                                              │
                                                              ▼
                                                       🖥 Dashboard
```

The dashboard at `http://localhost:8787` shows all three panels live:

![two-agent dashboard](docs/dashboard-screenshot-placeholder.txt)

(See `examples/two-agent-demo/session.jsonl` for the recorded session and
[`docs/two-agent-demo.md`](./docs/two-agent-demo.md) for the full how-to.)

---

## What's in this repo

| Package | Purpose |
|---|---|
| [`packages/agentbus-core`](./packages/agentbus-core/) | Typed pub/sub bus, Agent lifecycle, **BusTransport** (in-process + Redis), Risk engine |
| [`packages/agentbus-bitget`](./packages/agentbus-bitget/) | Bitget adapter (live via `bitget-mcp-server`, or paper sim), Skill installer |
| [`packages/agentbus-runtime`](./packages/agentbus-runtime/) | Optional 4-agent reference runtime (researcher → strategist → risk → executor) + backtest |
| [`packages/agentbus-cli`](./packages/agentbus-cli/) | `agentbus inspect / publish / tail / run / backtest / install-skill` |
| [`packages/agentbus-mcp`](./packages/agentbus-mcp/) | MCP server so Claude Code / Cursor / Codex can drive the bus |
| [`agents/classifier`](./agents/classifier/) | **Qwen classifier agent** — scores & filters signals via hackathon proxy |
| [`agents/coop-demo`](./agents/coop-demo/) | **Two-agent cooperating demo** with built-in HTTP dashboard |
| [`agents/researcher`](./agents/researcher/) | Optional: macro/sentiment → signal |
| [`agents/strategist`](./agents/strategist/) | Optional: signal → thesis + plan |
| [`agents/risk-manager`](./agents/risk-manager/) | Optional: plan → risk_check → approve/shrink/reject |
| [`agents/executor`](./agents/executor/) | Approved `order` → Bitget call → `fill` |
| [`examples/two-agent-demo/`](./examples/two-agent-demo/) | Recorded JSONL session log for the two-agent demo |
| [`examples/paper-trading-session/`](./examples/paper-trading-session/) | Recorded JSONL session log for the 4-agent demo |
| [`docs/`](./docs/) | Architecture, messages, Bitget, MCP, Redis, Qwen, two-agent demo, hackathon |

---

## Quick start (the 2-minute story)

```bash
# 1. Install
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus
pnpm install

# 2. Build everything (12 packages)
pnpm -r build

# 3. Run the test suite (30 tests)
pnpm -r test

# 4. Smoke-test the bus (no network, no credentials)
pnpm smoke

# 5. Run the two-agent demo with the dashboard
node scripts/demo-two-agents.mjs --inject
# → open http://localhost:8787
```

### With the real Qwen classifier

```bash
export BITGET_QWEN_API_KEY=sk-...
node scripts/demo-two-agents.mjs --inject
```

This routes through `https://hackathon.bitgetops.com/v1` (model
`qwen3.6-plus`) — the same proxy every Bitget hackathon participant uses.

### With Redis (multi-process / multi-machine)

```bash
docker run --rm -p 6379:6379 redis:7-alpine
REDIS_URL=redis://127.0.0.1:6379 node scripts/demo-two-agents.mjs --inject
# in another shell, publish into the same bus:
node scripts/publish-signal.mjs --symbol=ETHUSDT --direction=long --confidence=0.8 \
  --rationale="eth/btc ratio breakout, gas < 10 gwei, l2 inflows +15% 24h"
```

Both processes share the same bus — that's the "two cooperating agents"
story made literal.

---

## How it talks to Bitget

The Bitget adapter has two modes:

- **`paper`** — deterministic local simulation. No network, no credentials.
  The bus still publishes real `order`, `fill`, and `order_update` messages
  so the rest of the system can be exercised end-to-end. This is the mode
  the included demos use, and the JSONL logs satisfy the hackathon's
  *"live trading record or paper trading log"* requirement.

- **`live`** — spawns `bitget-mcp-server` over stdio (the official
  `Bitget-AI/agent_hub` package) and forwards JSON-RPC tool calls. Requires
  `BITGET_API_KEY`, `BITGET_SECRET_KEY`, `BITGET_PASSPHRASE` in the env.

Set `AGENTBUS_MODE=live` to switch.

---

## How the Qwen classifier works

The classifier listens on `signal.raw.>`, posts each signal to
`qwen3.6-plus` (via the Bitget hackathon proxy), and re-publishes either:

- `signal.scored` — accepted signal enriched with a `quality` score
- `signal.noise` — rejected signal with the model's reason

The model uses a rubric (in [`docs/qwen.md`](./docs/qwen.md)) that scores on
specificity, direction alignment, confidence calibration, and horizon realism.

If `BITGET_QWEN_API_KEY` is missing, the classifier falls back to a
heuristic (length + symbol + confidence alignment) so demos never block.

---

## Using the MCP server (Claude Code / Cursor / Codex)

```bash
claude mcp add -s user \
  --env AGENTBUS_MODE=paper \
  --env BITGET_QWEN_API_KEY=... \
  agentbus \
  -- npx -y agentbus-mcp
```

Five tools get exposed: `agentbus_inspect`, `agentbus_publish`,
`agentbus_history`, `agentbus_subscribe`, `agentbus_inject_tick`. See
[`docs/mcp.md`](./docs/mcp.md).

---

## Why this maps to Track 2 (Trading Infra)

The hackathon brief for Track 2 calls for *"tools or frameworks for
Agents, products for traders, and strategy evaluation and benchmarking
systems."* AgentBus hits all three:

- ✅ **Framework for agents** — typed messages, lifecycle, tracing, transports
- ✅ **Product for traders** — live dashboard + JSONL audit log
- ✅ **Strategy evaluation** — Qwen classifier scores signals + backtest harness
- ✅ **Reusability** — 5 standalone agent packages + installable skill + MCP server
- ✅ **Built on Agent Hub** — wraps `bitget-mcp-server`, same conventions

---

## Documentation

- [Architecture overview](./docs/architecture.md)
- [Message kinds and topic conventions](./docs/messages.md)
- [Bitget integration guide](./docs/bitget.md)
- [MCP usage with Claude Code / Cursor](./docs/mcp.md)
- [Redis transport (multi-process bus)](./docs/redis.md)
- [Qwen classifier wiring details](./docs/qwen.md)
- [Two-agent cooperating demo guide](./docs/two-agent-demo.md)
- [Deploying to Railway](./docs/deploy-railway.md)
- [Live Bitget trading on Railway](./docs/deploy-railway-live.md) *(read before enabling AGENTBUS_MODE=live)*
- [Hackathon submission mapping](./docs/hackathon.md)

---

## Hackathon compliance

This repo satisfies the **Track 2 — Trading Infra** submission requirements:

| Requirement | Where it lives |
|---|---|
| Public GitHub repo | ✅ this repo |
| Project description (4-part structure) | [`docs/hackathon.md`](./docs/hackathon.md) |
| README with install + usage | ✅ this file + per-package READMEs |
| Verifiable usage record | [`examples/two-agent-demo/session.jsonl`](./examples/two-agent-demo/session.jsonl) + [`examples/paper-trading-session/session.jsonl`](./examples/paper-trading-session/session.jsonl) + backtest output |
| Demo (no login required) | `pnpm smoke` / `pnpm demo` / `node scripts/demo-two-agents.mjs` |
| Uses Bitget Agent Hub | ✅ `agentbus-bitget` wraps `bitget-mcp-server` |

---

## License

MIT — see [LICENSE](./LICENSE).

Built for Bitget AI Base Camp Hackathon S1 (May 27 – Jun 30, 2026).
