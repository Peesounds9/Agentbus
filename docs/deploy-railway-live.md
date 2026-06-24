# Live deployment to Railway with real Bitget orders

**Read this whole doc before enabling live mode.** Live mode moves real
money on your real Bitget account. Three non-negotiables:

1. **NEVER** enable the **Withdraw** permission on the API key.
2. **ALWAYS** IP-whitelist the key to Railway's egress ranges.
3. **Start with a small fund** — Bitget sub-account with $20-50 USDT only.

The Track 2 brief accepts "sample input/output" and "paper trading log"
as verifiable usage records, so live mode is **optional**. The
committed `examples/two-agent-demo/session.jsonl` is in spec without it.

If you skip this doc, run paper mode. If you want a live log, follow
each step in order.

---

## Step 1 — Create a dedicated sub-account on Bitget

1. Log in to https://www.bitget.com
2. **Assets → Sub-accounts → Create sub-account**
3. Name it `agentbus-railway`
4. **Transfer $20-50 USDT** from main to sub-account (NOT to main wallet)
5. Done. The sub-account is now isolated from your main funds.

This protects you in three ways:
- Even if something goes wrong, only $20-50 is at risk.
- The sub-account's trade history is what judges will see in the log.
- You can wipe the sub-account with one click later.

## Step 2 — Create an API key on the sub-account

1. While logged in as the sub-account, **Settings → API Management → Create API Key**
2. Label it `agentbus-railway-key`
3. Permissions:
   - ✅ **Read** (view balances, positions, fills)
   - ✅ **Trade** (place and cancel orders — needed for live demo)
   - ❌ **Withdraw** — leave OFF. Never enable this for any agent.
   - ❌ **Transfer** (sub-account to sub-account) — leave OFF
4. Passphrase: pick something strong, save it somewhere safe
5. Bitget shows you the API Key, Secret Key, and Passphrase — **copy all three**

## Step 3 — IP-whitelist the key

Railway uses **dynamic outbound IPs** — they don't publish a static range.
This is the main risk of running live trading on Railway vs your own VPS.

Two options:

### Option A (safer): use your VPS as the live executor

Run the live Bitget adapter on **your VPS** (where the IP is static),
expose only the dashboard on Railway:

1. Keep the current Railway deploy as **paper mode** (dashboard + Qwen only).
2. On your VPS, run:
   ```bash
   export AGENTBUS_MODE=live
   export BITGET_API_KEY=...
   export BITGET_SECRET_KEY=...
   export BITGET_PASSPHRASE=...
   node scripts/demo-two-agents.mjs --port=8787 --inject
   ```
3. The VPS IP is static — whitelist that on Bitget.

But this means the live fill log won't be on Railway. To get the log back
into the repo, you have to copy the resulting session.jsonl into the repo
and push.

### Option B (simpler): accept the Railway IP risk

If you accept that Railway's IPs are dynamic and you cannot whitelist a
specific range, you can:

1. Leave the API key's IP whitelist **empty** (allowed from any IP).
2. Set the key's permissions to **Read + Trade**, NEVER Withdraw.
3. Cap the sub-account at $20-50 USDT.
4. Check the trade history on Bitget daily; if anything looks weird, delete
   the API key immediately.

Even in the worst case (key compromise, attacker trades with it), your
loss is capped at the $20-50 in the sub-account. They cannot withdraw.

## Step 4 — Set the env vars on Railway

In your Railway service → **Variables** → add:

```
AGENTBUS_MODE=live
BITGET_API_KEY=bg_your_actual_key_here
BITGET_SECRET_KEY=your_actual_secret_here
BITGET_PASSPHRASE=your_actual_passphrase_here
# Optional but recommended:
BITGET_QWEN_API_KEY=sk_your_qwen_key_here
```

**Do not commit these to git.** Railway's Variables panel is the right place.

Railway auto-restarts on env change. Watch the build log:

```
[agentbus-mcp] ready (mode=live, log=./examples/two-agent-demo/session.jsonl)
[dashboard] http://localhost:8787
```

## Step 5 — Trigger a live session

Open the dashboard URL Railway gave you. Click around or hit:

```bash
curl -X POST https://YOUR_RAILWAY_URL.up.railway.app/api/inject
```

This injects the 5-signal demo sequence. The classifier will score them,
and **4 of them will trigger real market orders on your Bitget sub-account**.

Each order is 0.01 BTC or 0.01 ETH at market — so ~$600 notional at
current prices. With $20-50 in the sub-account, **most orders will
reject for insufficient margin**. That's fine for the demo — the rejected
`order_update` messages still appear in the JSONL log and prove the
adapter is talking to real Bitget.

If you want orders that actually fill: deposit ~$500 USDT into the
sub-account.

## Step 6 — Pull the live log back into the repo

The live log gets written to `examples/two-agent-demo/session.jsonl`
**inside the Railway container**. To save it permanently:

```bash
# Either: scp from the container (Railway CLI)
railway run cat examples/two-agent-demo/session.jsonl > examples/two-agent-demo/session.jsonl
git add examples/two-agent-demo/session.jsonl
git commit -m "live: real Bitget order log from Railway deployment"
git push

# Or: set up a Railway Volume mounted at /app/logs so the file persists
# between redeploys. Then `railway run cat /app/logs/session.jsonl`.
```

## Step 7 — Disable live mode after the demo

Once you have the log:

```
# In Railway → Variables, set:
AGENTBUS_MODE=paper
```

The next deploy will be back in paper mode. No live trades will fire.

**Also recommended:** delete the API key on Bitget (Settings → API
Management → Delete). The key was scoped to the sub-account only, so
this is safe and reversible — you can re-create it later.

---

## Risk matrix

| Risk | Mitigation |
|---|---|
| API key leak via Railway env vars | Railway env vars are encrypted at rest; not exposed via API. Low risk. |
| API key leak via repo | Keys are NEVER committed — only set in Railway Variables. |
| Attacker guesses Railway URL and uses key | Key has Read+Trade only, sub-account is capped at $20-50, Withdraw is OFF. Worst case = $50 loss. |
| Bitget account lockout for API abuse | Unlikely with $20-50 / 4 small orders. Use the sub-account, not main. |
| Live log lost on container restart | Save the log (Step 6) or use a Railway Volume. |

## The committed paper log is already in spec

If at any point you feel uncomfortable — stop. The committed
`examples/two-agent-demo/session.jsonl` (4 fills, 8 order updates) is a
valid verifiable usage record per the brief. You can submit with that
and skip live mode entirely.
