# Deploying AgentBus to Railway

Railway is the fastest way to get AgentBus running with a public URL so
judges (or anyone) can open the dashboard without SSHing into your VPS.

## 1. One-time setup

1. Sign in to https://railway.app (GitHub OAuth is fine).
2. Click **New Project → Deploy from GitHub repo**.
3. Select `Peesounds9/Agentbus` from the list.
4. Railway auto-detects the `Dockerfile` and starts the build.

That's it. No CLI required.

## 2. Wait for the build

First build takes ~2-3 minutes (pnpm install + tsc build all 12 packages).
You'll see the build log in the Railway dashboard. Once it's green, the
service auto-starts.

## 3. Set env vars (optional)

In your service → **Variables**, add whichever of these you want:

| Var | Default | Purpose |
|---|---|---|
| `AGENTBUS_MODE` | `paper` | `paper` (sim) or `live` (real Bitget orders) |
| `BITGET_QWEN_API_KEY` | unset | Enables the real Qwen classifier via hackathon proxy |
| `REDIS_URL` | unset | Enables the Redis transport (needs a Redis service too) |
| `BITGET_API_KEY` | unset | Only for `AGENTBUS_MODE=live` |
| `BITGET_SECRET_KEY` | unset | Only for `AGENTBUS_MODE=live` |
| `BITGET_PASSPHRASE` | unset | Only for `AGENTBUS_MODE=live` |

Railway injects `PORT` automatically — we honor it.

## 4. Open the dashboard

Railway gives you a public URL like `https://agentbus-production.up.railway.app`.
Open it. You should see the dark-themed 3-panel dashboard.

To verify it's healthy:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_RAILWAY_URL.up.railway.app/
# → 200

curl -s https://YOUR_RAILWAY_URL.up.railway.app/api/state | python3 -m json.tool | head
# → JSON dump with bus id, agents, signals, fills
```

## 5. (Optional) Inject signals via the public URL

```bash
# From anywhere on the internet:
curl -X POST https://YOUR_RAILWAY_URL.up.railway.app/api/publish \
  -H 'content-type: application/json' \
  -d '{"symbol":"BTCUSDT","direction":"long","confidence":0.92,"rationale":"whale 1.2k BTC, CVD positive 18m, 4h close above 60k"}'

# Or replay the built-in demo sequence:
curl -X POST https://YOUR_RAILWAY_URL.up.railway.app/api/inject
```

Open the dashboard in a browser and you'll see the signals stream in
live — judge-friendly.

## How the build works

The `Dockerfile` is two-stage:

1. **Builder** — uses `node:20-alpine` + corepack-pinned `pnpm@9`, copies
   the manifests first (for cache reuse), runs `pnpm install`, then
   `pnpm -r build`.
2. **Runtime** — copies only the built `dist/` artifacts + `scripts/`,
   installs production deps only (no vitest, no typescript), and starts
   `node scripts/demo-two-agents.mjs --port=$PORT`.

Result: the runtime image is ~150 MB and starts in ~3 seconds.

## Costs

Railway's free trial gives $5 of credit. AgentBus in paper mode uses
~50 MB RAM and negligible CPU, so you'll fit in the free tier easily
for the duration of the hackathon.

## Logs and persistence

The JSONL audit log is written to `examples/two-agent-demo/session.jsonl`
**inside the container**. Railway containers have ephemeral filesystems,
so the log resets on every redeploy.

For persistent logs, two options:

1. **Use the committed log** — `examples/two-agent-demo/session.jsonl`
   is in the GitHub repo. Anyone who clones gets the same record.
2. **Add a Railway Volume** — in the service → Settings → add a
   volume mounted at `/app/logs`, change the script to write there.

For the hackathon submission the in-repo log is what matters. Judges
clone and `pnpm -r build` to reproduce.

## If the build fails

The most common cause is a missing package.json in one of the COPY lines.
If you add a new agent package to `agents/`, you must add it to the
Dockerfile's COPY list too — or it won't be in the image.

## Alternative: deploy via `railway up` CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

This uses the same `Dockerfile` and `railway.toml` already in the repo.
