# AgentBus

> **A typed, Redis-backed pub/sub message bus for AI trading agents — built on top of Bitget Agent Hub.**
>
> Submission for **Bitget AI Base Camp · Hackathon S1** · Track 2 — Trading Infra
>
> Repo: https://github.com/Peesounds9/Agentbus

---

## What is this?

AgentBus turns **solo LLM trading agents into teams** by giving them a
typed pub/sub bus to publish signals and subscribe to each other — with a
Qwen-powered classifier in the loop to filter noise.

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

Open `http://localhost:8787` after running the demo and you'll see all
three panels updating live. No login, no credentials required for the
default paper-mode demo.

---

## Table of contents

1. [Quick start — copy-paste this](#quick-start)
2. [What you should see when it works](#what-you-should-see)
3. [Available demos](#available-demos)
4. [Project layout](#project-layout)
5. [LLM provider setup (Qwen / OpenAI / Ollama)](#llm-provider-setup)
6. [Bitget live trading (optional)](#bitget-live-trading-optional)
7. [Deploying to Railway](#deploying-to-railway)
8. [Deployment to your own VPS](#deployment-to-your-own-vps)
9. [Documentation index](#documentation-index)
10. [Troubleshooting](#troubleshooting)
11. [Hackathon compliance](#hackathon-compliance)

---

## Quick start

You need **Node.js 18+** and **git**. Everything else (pnpm, dependencies,
build) is handled automatically.

### One-liner install (recommended for beginners)

```bash
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus
./scripts/install.sh
```

This script:

1. Installs Node.js 18+ if missing (via NodeSource apt repo on Linux).
2. Installs pnpm 9+ if missing (via npm).
3. Runs `pnpm install` (uses the committed `pnpm-lock.yaml`).
4. Runs `pnpm -r build` (compiles all 12 packages).
5. Runs `pnpm -r test` (sanity-checks the build).
6. Runs `pnpm smoke` (asserts the bus works).

Expected output at the end:

```
✓ Node v20.x.x
✓ pnpm 9.x.x
✓ Dependencies installed
✓ Build complete
✓ 34 tests passed
✓ Smoke test passed
AgentBus is ready.
```

### Manual install (if the script won't run on your platform)

```bash
# 1. Get the code
git clone https://github.com/Peesounds9/Agentbus.git
cd Agentbus

# 2. Install pnpm if you don't have it
npm install -g pnpm@9

# 3. Install dependencies (uses the committed lockfile)
pnpm install --frozen-lockfile

# 4. Build all 12 packages
pnpm -r build

# 5. Run the test suite (34 tests, ~10 seconds)
pnpm -r test

# 6. Run the smoke test (no network, no credentials)
pnpm smoke
```

If `pnpm -r test` shows `Tests  34 passed (34)` and `pnpm smoke` ends
with `[smoke] PASS`, the install worked.

### Run the headline demo

```bash
node scripts/demo-two-agents.mjs --inject
```

You'll see:

```
[demo] bus id = xxxxx
[demo] dashboard: http://localhost:8787
[dashboard] http://localhost:8787
[demo] scored=4 noise=1 fills=4
[demo] open http://localhost:8787 to watch the bus live.
```

Open <http://localhost:8787> in a browser. You should see three panels:
**Signaler** (raw signals), **Classifier** (scored + noise drops),
**Executor** (orders + fills). The page auto-refreshes every 1.5s.

Press **Ctrl+C** in the terminal to stop the server.

---

## What you should see when it works

### `pnpm -r test`

```
packages/agentbus-core test:    Tests  23 passed (23)
packages/agentbus-bitget test:  Tests  2 passed (2)
agents/classifier test:         Tests  10 passed (10)
                              ─────────────────
                              Total  35 passed (35)
```

If you see anything other than "passed", see [Troubleshooting](#troubleshooting).

### `pnpm smoke`

```
[smoke] plans emitted: 1
[smoke] orders emitted: 2
[smoke] fills emitted: 1
[smoke] PASS
```

If `[smoke] FAIL`, the script exits non-zero. The output above the FAIL
will tell you which check failed (usually a missing subscriber).

### `node scripts/demo-two-agents.mjs --inject`

Look for these lines:

```
[demo] agents: 4 subscribers, classifier=heuristic   (no LLM key set)
[demo] scored=4 noise=1 fills=4
```

If you set `OPENAI_API_KEY` or `BITGET_QWEN_API_KEY` before running,
the line will say `classifier=openai (key set)` or `classifier=qwen (key set)`.

### Browser dashboard at `http://localhost:8787`

You should see:

- A dark-themed header: **"AgentBus — two cooperating agents"** + a bus id
- Three panels side-by-side
- Within 1-2 seconds of hitting `--inject`, the panels populate with
  scored signals, a noise drop, and 4 fills

If the page is blank, check the terminal — the most common cause is the
demo process exited (look for `[demo] stopping…` followed by `done`).

---

## Available demos

| Script | What it does | Default port |
|---|---|---|
| `node scripts/demo-two-agents.mjs --inject` | **The headline demo.** Signaler + classifier + executor + dashboard. | 8787 |
| `node scripts/demo-paper-session.mjs` | 4-agent paper session (researcher → strategist → risk → executor). | n/a |
| `node scripts/smoke-two-agents.mjs` | Headless smoke test of the two-agent demo. Asserts dashboard + JSONL log. | random |
| `node scripts/smoke.mjs` | Headless smoke test of the 4-agent runtime. | n/a |
| `node scripts/publish-signal.mjs --symbol=BTCUSDT --direction=long --confidence=0.9 --rationale="..."` | Inject a single signal into a fresh bus. Prints the classifier verdict. | n/a |
| `node scripts/run-backtest.mjs <log.jsonl>` | Replay a recorded session, print stats. | n/a |

For the headline demo, see [`docs/two-agent-demo.md`](./docs/two-agent-demo.md).
For what each message kind means, see [`docs/messages.md`](./docs/messages.md).

---

## Project layout

```
Agentbus/
├── Dockerfile              # container image (Railway / Fly / Render)
├── railway.toml            # Railway config-as-code
├── .dockerignore
├── package.json            # workspace root — runs pnpm scripts across all packages
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── pnpm-lock.yaml          # committed lockfile for reproducible installs
├── README.md               # you are here
├── LICENSE
│
├── packages/               # 6 reusable libraries
│   ├── agentbus-core/      # typed pub/sub bus, Agent lifecycle, risk engine, transports
│   ├── agentbus-bitget/    # Bitget adapter (live + paper) + skill installer
│   ├── agentbus-runtime/   # 4-agent reference runtime + backtest harness
│   ├── agentbus-cli/       # command-line tool
│   ├── agentbus-mcp/       # MCP server for Claude Code / Cursor / Codex
│   └── agentbus-bitget/test, packages/agentbus-core/test   # unit tests
│
├── agents/                 # 5 standalone agent implementations
│   ├── researcher/         # macro/sentiment → signal
│   ├── strategist/         # signal → thesis + plan
│   ├── risk-manager/       # plan → risk_check → approve/shrink/reject
│   ├── executor/           # order → Bitget → fill
│   ├── classifier/         # **NEW** Qwen-based signal classifier on the bus
│   └── coop-demo/          # **NEW** two-agent demo runtime with built-in dashboard
│
├── scripts/                # 7 ready-to-run scripts (start here)
│   ├── install.sh          # one-shot installer for beginners
│   ├── demo-two-agents.mjs # the headline demo
│   ├── demo-paper-session.mjs
│   ├── publish-signal.mjs
│   ├── smoke.mjs
│   ├── smoke-two-agents.mjs
│   └── run-backtest.mjs
│
├── examples/               # recorded sessions (verifiable usage records)
│   ├── two-agent-demo/
│   │   ├── session.jsonl   # 4 fills + 8 order_updates
│   │   └── README.md
│   └── paper-trading-session/
│       ├── session.jsonl   # 3 fills + 6 order_updates
│       └── README.md
│
└── docs/                   # 12 docs covering every angle
    ├── architecture.md
    ├── messages.md
    ├── bitget.md
    ├── mcp.md
    ├── redis.md
    ├── qwen.md
    ├── llm-providers.md
    ├── two-agent-demo.md
    ├── deploy-railway.md
    ├── deploy-railway-live.md
    ├── TROUBLESHOOTING.md
    └── hackathon.md
```

---

## LLM provider setup

The classifier agent uses an **OpenAI-compatible Chat Completions API**.
Pick whichever you have:

| Priority | Provider | Env vars | Cost |
|---|---|---|---|
| 1 (default) | **Bitget hackathon Qwen proxy** | `BITGET_QWEN_API_KEY=sk-...` | Free for hackathon |
| 2 | **OpenAI** | `OPENAI_API_KEY=sk-...` (uses `gpt-4o-mini` by default) | ~$0.0001 per signal |
| 3 | **OpenRouter, Azure, Together, Groq** | `OPENAI_BASE_URL` + `OPENAI_API_KEY` + `OPENAI_MODEL` | varies |
| 4 | **Local Ollama** | `OPENAI_BASE_URL=http://localhost:11434/v1` + `OPENAI_MODEL=llama3.2` + `OPENAI_API_KEY=ollama` | Free |
| 5 (fallback) | **Heuristic** (no API call) | none | Free, less accurate |

Full details in [`docs/llm-providers.md`](./docs/llm-providers.md).

### With Qwen (recommended for the Bitget hackathon)

```bash
export BITGET_QWEN_API_KEY=sk-your-qwen-key
node scripts/demo-two-agents.mjs --inject
```

Get the key from your registration email or the Telegram community
(see the hackathon GitBook).

### With OpenAI

```bash
export OPENAI_API_KEY=sk-your-openai-key
node scripts/demo-two-agents.mjs --inject
```

### Without any key (heuristic fallback)

```bash
node scripts/demo-two-agents.mjs --inject
# → classifier=heuristic in the console
# → 5 signals → 4 scored + 1 noise (the empty-rationale one)
```

The demo always works without a key. The LLM classifier is a quality
upgrade, not a hard dependency.

---

## Bitget live trading (optional)

The default mode is **paper** — fills are simulated in-memory, no network.
**You don't need a Bitget account or any funds to run the demos or submit
the project.** The committed JSONL logs are valid verifiable usage records.

If you want real orders on Bitget (e.g. for a live demo), read
[`docs/deploy-railway-live.md`](./docs/deploy-railway-live.md) carefully
before turning on `AGENTBUS_MODE=live`. The minimum safe setup:

1. Create a **sub-account** on Bitget with **$20-50 USDT**.
2. Create an API key with `Read + Trade` permissions (NEVER Withdraw).
3. Set `AGENTBUS_MODE=live` + the three `BITGET_*` vars.

---

## Deploying to Railway

Easiest deploy path — gets you a public URL the judges can open.

1. Sign in to https://railway.app (GitHub OAuth).
2. **New Project → Deploy from GitHub repo → Peesounds9/Agentbus**.
3. Railway auto-detects the `Dockerfile` and builds (~2-3 min).
4. (Optional) Add `OPENAI_API_KEY` or `BITGET_QWEN_API_KEY` in **Variables**.
5. Click the public URL Railway gives you → dashboard loads.

Full guide: [`docs/deploy-railway.md`](./docs/deploy-railway.md).
Live-trading variant: [`docs/deploy-railway-live.md`](./docs/deploy-railway-live.md).

---

## Deployment to your own VPS

You already cloned the repo. To run as a long-lived service:

```bash
# On the VPS:
cd ~/Agentbus
pnpm -r build
node scripts/demo-two-agents.mjs --port=8787 --inject
```

Open firewall port 8787 or SSH-tunnel it:

```bash
# From your laptop:
ssh -L 8787:localhost:8787 root@YOUR_VPS_IP
# Then open http://localhost:8787
```

For systemd-managed auto-restart, see [`docs/deploy-vps.md`](./docs/deploy-vps.md).

---

## Documentation index

Every angle is covered. Pick what you need:

| Doc | What's in it |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | Goals, topology, message lifecycle, tracing fields, modes |
| [`docs/messages.md`](./docs/messages.md) | All message kinds + topic naming conventions |
| [`docs/bitget.md`](./docs/bitget.md) | Bitget adapter details, paper vs live, MCP wiring |
| [`docs/mcp.md`](./docs/mcp.md) | MCP server setup for Claude Code / Cursor / Codex |
| [`docs/redis.md`](./docs/redis.md) | Redis transport for multi-process / multi-machine bus |
| [`docs/qwen.md`](./docs/qwen.md) | Classifier rubric, endpoint wiring, fallbacks |
| [`docs/llm-providers.md`](./docs/llm-providers.md) | OpenAI / Qwen / OpenRouter / Ollama — all providers |
| [`docs/two-agent-demo.md`](./docs/two-agent-demo.md) | What the dashboard shows, judge walkthrough |
| [`docs/deploy-railway.md`](./docs/deploy-railway.md) | Step-by-step Railway deploy |
| [`docs/deploy-railway-live.md`](./docs/deploy-railway-live.md) | Live Bitget trading on Railway (safety checklist) |
| [`docs/deploy-vps.md`](./docs/deploy-vps.md) | systemd + nginx + firewalls on your own VPS |
| [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) | **Common install errors and fixes — read this if anything fails** |
| [`docs/hackathon.md`](./docs/hackathon.md) | The 4-part submission description, form fields |

---

## Troubleshooting

**Quick checks first:**

```bash
node --version    # should be >= 18
pnpm --version    # should be >= 9
```

**Most common issues:**

1. **`pnpm: command not found`** → `npm install -g pnpm@9`
2. **`pnpm install` fails with "lockfile out of date"** → `pnpm install` (without `--frozen-lockfile`)
3. **`node: --openssl-legacy-provider is not allowed`** → upgrade Node to 18+ (you might be on 16)
4. **Port 8787 already in use** → `node scripts/demo-two-agents.mjs --port=9000 --inject`
5. **`Cannot find module 'agentbus-core'`** → `pnpm install` (forgot to link workspaces)
6. **Dashboard loads but is empty** → wait 2 seconds for the first /api/state poll, then it populates
7. **`pnpm -r test` says "Cannot use && with ?? without parentheses"** → upgrade Node to 18+

Full troubleshooting: [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md).

---

## Hackathon compliance

This repo satisfies the **Track 2 — Trading Infra** submission requirements:

| Requirement | Where it lives |
|---|---|
| Public GitHub repo | ✅ this repo |
| Project description (4-part structure) | [`docs/hackathon.md`](./docs/hackathon.md) |
| README with install + usage | ✅ this file + per-package READMEs |
| Verifiable usage record | [`examples/two-agent-demo/session.jsonl`](./examples/two-agent-demo/session.jsonl) + [`examples/paper-trading-session/session.jsonl`](./examples/paper-trading-session/session.jsonl) |
| Demo (no login required) | `pnpm smoke` / `node scripts/demo-two-agents.mjs --inject` |
| Uses Bitget Agent Hub | ✅ `agentbus-bitget` wraps `bitget-mcp-server` |

**Submission form link**: https://forms.gle/CEGB6fRtuobD3bCj8

Fill in:

- Track: **2 — Trading Infra**
- Project name: **AgentBus**
- GitHub URL: **https://github.com/Peesounds9/Agentbus**
- Demo / usage record: link to `examples/two-agent-demo/session.jsonl`
- Description: paste section 1 of `docs/hackathon.md`

---

## License

MIT — see [LICENSE](./LICENSE).

Built for **Bitget AI Base Camp Hackathon S1** (May 27 – Jun 30, 2026).
