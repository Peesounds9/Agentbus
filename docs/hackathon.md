# Hackathon Submission — AgentBus

**Event:** Bitget AI Base Camp · Hackathon Season 1
**Track:** 🟩 Track 2 — Trading Infra
**Submission window:** Jun 15, 2026 0:00 – Jun 25, 2026 24:00 (UTC+8)
**Repo:** https://github.com/Peesounds9/Agentbus
**UID:** *(to be filled in the submission form)*

---

## 1. Project description

Following the four-part structure required by the submission form:

### 1.1 Core idea

AgentBus is a **typed, persistent pub/sub message bus** that lets multiple
specialist AI agents — researcher, strategist, risk manager, executor —
coordinate on a single Bitget account. It wraps the Bitget Agent Hub and
turns "one AI calling 58 trading APIs" into "a team of agents with
distinct jobs, communicating over a structured bus."

### 1.2 Problem it solves

Every Bitget Agent Hub developer hits the same wall: a single LLM-driven
agent can call the 58 trading APIs, but production trading needs separation
of concerns. The current ecosystem forces every team to reinvent the bus
(usually as a Slack thread, a JSON file, or prayer). AgentBus provides a
*standard, typed, observable* layer — pluggable across exchanges, forkable
across teams, replayable for backtesting.

### 1.3 How it uses Bitget Agent Hub

The `agentbus-bitget` package wraps `bitget-mcp-server` from
[`Bitget-AI/agent_hub`](https://github.com/Bitget-AI/agent_hub):

- Reads `BITGET_API_KEY` / `BITGET_SECRET_KEY` / `BITGET_PASSPHRASE` from env.
- Forwards approved orders via the same MCP tool names
  (`futures_place_order`, `spot_place_order`) used by every other Agent
  Hub project.
- In paper mode, no network calls — same bus, same agents, deterministic
  simulated fills. This lets the runtime run in CI and on the judges'
  machines with zero setup.
- An installable `agentbus-bitget` skill is shipped so any Claude Code /
  Cursor / Codex user can opt into bus-coordinated trading via
  `agentbus install-skill`.

### 1.4 My take on AI Trading

(Part 4 — optional but encouraged by the judges.)

The interesting frontier isn't bigger models, it's **better coordination**.
A solo LLM trader will always be a monolith: one context window, one
failure mode, no separation between *what to do* and *whether to do it*.
The teams that win the next 18 months will look more like trading desks
than chatbots — small, specialized agents with crisp contracts, sharing
state through a bus like AgentBus instead of stuffing everything into
one prompt. We're trying to make that architecture cheap to adopt.

---

## 2. What ships in this repo

| Component | Files |
|---|---|
| **Core bus** (typed pub/sub, Agent lifecycle, Risk engine) | `packages/agentbus-core/` |
| **Bitget adapter** (live MCP + paper sim + Skill installer) | `packages/agentbus-bitget/` |
| **Runtime** (wires 4 reference agents on one bus; backtest) | `packages/agentbus-runtime/` |
| **CLI** (`agentbus inspect / publish / tail / run / backtest / install-skill`) | `packages/agentbus-cli/` |
| **MCP server** (Claude Code / Cursor / Codex integration) | `packages/agentbus-mcp/` |
| **4 reference agents** | `agents/researcher`, `agents/strategist`, `agents/risk-manager`, `agents/executor` |
| **Paper-trading session log** (verifiable usage record) | `examples/paper-trading-session/session.jsonl` |
| **22 unit tests** | `packages/agentbus-core/test/`, `packages/agentbus-bitget/test/` |
| **Smoke + demo scripts** | `scripts/smoke.mjs`, `scripts/demo-paper-session.mjs`, `scripts/run-backtest.mjs` |
| **Docs** | `docs/architecture.md`, `docs/messages.md`, `docs/bitget.md`, `docs/mcp.md` |

## 3. Verifiable usage record

The hackathon requires *"At least one verifiable usage record"* for Track 2.

We provide a JSONL audit log of a complete paper-trading session at
[`examples/paper-trading-session/session.jsonl`](../examples/paper-trading-session/session.jsonl).
Each line is a fully-typed `BusMessage` from the running bus — timestamp,
topic, kind, payload, producer agent id.

To regenerate:

```bash
pnpm install
pnpm -r build
pnpm demo
cat examples/paper-trading-session/session.jsonl
```

To replay through the backtest harness:

```bash
pnpm backtest examples/paper-trading-session/session.jsonl
```

→ prints `fills`, `orders`, `realizedPnlUsdt`, `finalPositions`, `avgCost`.

## 4. Runnability

The README has a 6-step quickstart that takes the repo from `git clone`
to a working bus + paper session in under 2 minutes:

```bash
pnpm install
pnpm -r build
pnpm -r test       # 22 tests
pnpm smoke         # boots runtime, injects ticks, asserts fills emitted
pnpm demo          # runs a 7-tick paper session, writes JSONL
pnpm backtest <log>
```

All commands exit non-zero on failure. The smoke script asserts that
plans, orders, AND fills were emitted — if any agent in the chain breaks,
the smoke fails.

## 5. Completeness

End-to-end MVP:

- ✅ Ingestion: macro / sentiment / news / onchain events
- ✅ Decision: signal → thesis → plan with explicit invalidation
- ✅ Risk: per-symbol cap, reduce-only guard, max-symbols cap, dust filter
- ✅ Execution: paper sim + live MCP bridge to Bitget
- ✅ Observability: heartbeats, JSONL audit log, `inspect`, `tail`
- ✅ Replayability: backtest harness against the recorded log
- ✅ Reusability: 4 standalone agent packages, installable Skill, MCP server

## 6. Novelty

AgentBus is the first (publicly shipped) **typed message bus purpose-built
for AI trading agents**. Adjacent work — LangGraph, AutoGen, CrewAI —
is generic multi-agent; adjacent trading infra — Bitget Agent Hub, MuleRun,
GetAgent Playbook — is single-agent. AgentBus sits at the intersection
and ships a concrete reference impl, a backtest harness, and a paper-mode
default that lets anyone reproduce the demo without an account.

---

## Submission form fields

When filling out https://forms.gle/CEGB6fRtuobD3bCj8, use:

- **Track:** 2 — Trading Infra
- **Project name:** AgentBus
- **GitHub URL:** https://github.com/Peesounds9/Agentbus
- **Demo / usage record link:** https://github.com/Peesounds9/Agentbus/blob/main/examples/paper-trading-session/session.jsonl
- **Description:** *(paste section 1 above)*
- **Engagement tweet:** *(after posting the dev log with #BitgetHackathon @Bitget_AI)*
