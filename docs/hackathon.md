# Hackathon Submission — AgentBus

**Event:** Bitget AI Base Camp · Hackathon Season 1
**Track:** 🟩 Track 2 — Trading Infra
**Submission window:** Jun 15, 2026 0:00 – Jun 25, 2026 24:00 (UTC+8)
**Repo:** https://github.com/Peesounds9/Agentbus
**UID:** *(to be filled in the submission form)*

---

## 1. Project description (4-part structure)

### 1.1 Core idea

AgentBus is a **lightweight, Redis-backed pub/sub message bus** for AI
trading agents. Agents publish signals (e.g. "BTC breakout 1h") and other
agents subscribe. A Qwen-powered classifier sits on the bus to score and
filter noise.

The headline demo is **two cooperating agents**: one signals, one executes
— both visible in a small dashboard. Why it works: it turns solo agents
into teams without inventing a new framework each time.

### 1.2 Problem it solves

Every team building on Bitget Agent Hub eventually wants more than one
agent. Once you have a researcher, a strategist, a risk manager, and an
executor, you need:

- A standard way for them to **talk to each other** (not Slack, not a JSON file).
- **Typed contracts** so an agent can't accidentally send a `fill` where a `signal` was expected.
- **Traceability** so the team can replay any session, debug any bot.
- **Noise filtering** so the same breakout signal from three sources doesn't trigger three orders.

AgentBus gives you all four out of the box, with a Qwen classifier as the
default noise filter and a Redis transport so the bus can span machines.

### 1.3 How it uses Bitget Agent Hub

The `agentbus-bitget` package wraps the official
[Bitget Agent Hub](https://github.com/Bitget-AI/agent_hub):

- Reads `BITGET_API_KEY` / `BITGET_SECRET_KEY` / `BITGET_PASSPHRASE` from env.
- Forwards approved orders via the same MCP tool names
  (`futures_place_order`, `spot_place_order`).
- In paper mode, no network calls — same bus, same agents, deterministic
  simulated fills. This lets the runtime run in CI and on judges' machines
  with zero setup.
- An installable `agentbus-bitget` skill is shipped so any Claude Code /
  Cursor / Codex user can opt into bus-coordinated trading via
  `agentbus install-skill`.

The **Qwen classifier** uses the Bitget hackathon proxy
(`https://hackathon.bitgetops.com/v1`, model `qwen3.6-plus`) — same endpoint
every other Bitget Base Camp project uses.

### 1.4 My take on AI Trading

(Optional part 4.)

The frontier isn't bigger models, it's **better coordination**. A solo
LLM trader is always a monolith: one context window, one failure mode,
no separation between *what to do* and *whether to do it*. The teams that
win the next 18 months will look more like trading desks than chatbots —
small, specialized agents with crisp contracts, sharing state through a
bus like AgentBus instead of stuffing everything into one prompt. The
classifier is the proof: you can't easily add "score every signal for
quality before trading on it" to a monolithic agent, but you can plug a
classifier agent into a bus in 30 lines.

---

## 2. The 2-minute judge walkthrough

```bash
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus
pnpm install
pnpm -r build
pnpm -r test                  # 30 tests
node scripts/demo-two-agents.mjs --inject
# open http://localhost:8787
```

You see three panels updating live: Signaler publishing, Classifier
scoring (and dropping), Executor firing orders that produce paper fills.

Re-run with real Qwen:

```bash
export BITGET_QWEN_API_KEY=sk-...
node scripts/demo-two-agents.mjs --inject
# dashboard title bar now shows "classifier=qwen"
```

Re-run with Redis so the bus spans processes:

```bash
docker run --rm -p 6379:6379 redis:7-alpine &
REDIS_URL=redis://127.0.0.1:6379 node scripts/demo-two-agents.mjs --inject
# in another shell, publish into the same bus:
node scripts/publish-signal.mjs --symbol=ETHUSDT --direction=long --confidence=0.8 \
  --rationale="eth/btc ratio breakout, gas < 10 gwei, l2 inflows +15% 24h"
```

---

## 3. Verifiable usage record

The Track 2 brief asks for *"at least one verifiable usage record."* We
provide **two**:

1. **`examples/two-agent-demo/session.jsonl`** — recorded two-agent demo
   (signaler → classifier → executor → fills). Every line is a fully-typed
   `BusMessage` with timestamp, topic, kind, payload, producer agent id.

2. **`examples/paper-trading-session/session.jsonl`** — recorded 4-agent
   demo (researcher → strategist → risk-manager → executor → fills).

To regenerate:

```bash
pnpm install
pnpm -r build
node scripts/demo-two-agents.mjs --inject
node scripts/demo-paper-session.mjs
```

To replay through the backtest harness:

```bash
node scripts/run-backtest.mjs examples/two-agent-demo/session.jsonl
# → prints fills, orders, realizedPnlUsdt, finalPositions, avgCost
```

## 4. Runnability

```bash
pnpm install       # ~30s
pnpm -r build      # ~10s
pnpm -r test       # 30 tests, all green
pnpm smoke         # asserts plans, orders, AND fills emitted
node scripts/demo-two-agents.mjs --inject
```

All commands exit non-zero on failure. The two-agent demo injects a
5-signal sequence and asserts the bus state shows ≥1 fill (high-quality
signals) and a balanced dashboard view.

## 5. Completeness

- ✅ Ingestion — raw signals on `signal.raw.<sym>`
- ✅ Decision — Qwen classifier scores 0..1 with structured rubric
- ✅ Execution — only fires when classifier passes quality ≥ 0.6
- ✅ Exchange adapter — Bitget via MCP (live) + paper sim
- ✅ Bus transport — in-process default, optional Redis
- ✅ Observability — heartbeats, JSONL audit log, inspect, dashboard
- ✅ Reusability — every agent is a standalone package, installable skill, MCP server

## 6. Novelty

AgentBus is the first (publicly shipped) **typed message bus purpose-built
for AI trading agents** with a **production-grade Redis transport** and a
**Qwen classifier in the loop**. Adjacent work — LangGraph, AutoGen,
CrewAI — is generic multi-agent; adjacent trading infra — Bitget Agent
Hub, MuleRun, GetAgent Playbook — is single-agent with no bus. AgentBus
sits at the intersection and ships a tight, reproducible demo.

---

## Submission form fields

When filling out https://forms.gle/CEGB6fRtuobD3bCj8, use:

- **Track:** 2 — Trading Infra
- **Project name:** AgentBus
- **GitHub URL:** https://github.com/Peesounds9/Agentbus
- **Demo / usage record link:** https://github.com/Peesounds9/Agentbus/blob/main/examples/two-agent-demo/session.jsonl
- **Description:** *(paste section 1 above)*
- **Engagement tweet:** *(after posting the dev log with #BitgetHackathon @Bitget_AI)*
