# Troubleshooting

Common install + runtime errors, with the exact fix for each.

## Install phase

### `pnpm: command not found`

```bash
npm install -g pnpm@9
# or if you don't have npm either:
sudo apt install -y nodejs npm
sudo npm install -g pnpm@9
```

Verify: `pnpm --version` should print `9.x.x`.

### `Node.js v16.x.x is not supported`

pnpm 9 needs Node 18+. Update Node:

```bash
# Linux (Debian/Ubuntu) via NodeSource:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS via Homebrew:
brew install node@20
brew link --force node@20

# Windows:
# Download from https://nodejs.org/ — pick the 20.x LTS .msi
```

Verify: `node --version` should print `v20.x.x` or `v22.x.x`.

### `pnpm install` fails with "Lockfile is incompatible"

Means the committed `pnpm-lock.yaml` was made with a different pnpm
major version. Either:

```bash
# Option A — use a pnpm version compatible with the lockfile:
pnpm install   # without --frozen-lockfile
```

```bash
# Option B — bump the lockfile to your pnpm version:
rm pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: regenerate pnpm lockfile"
```

### `Cannot find module 'agentbus-core'` at runtime

Workspace symlinks weren't created. Run:

```bash
rm -rf node_modules packages/*/node_modules agents/*/node_modules
pnpm install
```

### `EACCES: permission denied` during `npm install -g`

You need sudo on Linux or to fix npm's prefix:

```bash
# Option A — use sudo:
sudo npm install -g pnpm@9

# Option B — fix npm prefix (no sudo needed after):
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g pnpm@9
```

### `gyp ERR! find Python` or `node-gyp` errors

Some optional native deps (esbuild, sharp, etc.) need a C++ toolchain.
On Debian/Ubuntu:

```bash
sudo apt-get install -y python3 build-essential
```

On macOS: `xcode-select --install`

On Windows: install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

If you don't actually need the failing package, install only what you need:

```bash
pnpm install --ignore-scripts
# then re-run with the missing toolchain if needed
```

## Build phase

### `error TS2881: This expression is never nullish`

TypeScript inferred a string literal where `??` was used. Run:

```bash
cd packages/agentbus-classifier
pnpm typecheck    # should print errors with line numbers
```

If it's our code, we already fixed this. If you edited the classifier,
re-run `pnpm install` to pick up your changes.

### `error TS2307: Cannot find module 'ioredis'`

Means the optional peer dep wasn't installed. Run:

```bash
pnpm add -D ioredis -w
```

ioredis is **optional** — AgentBus falls back to in-process transport
without it. Install only if you want multi-process bus via Redis.

### `Cannot use "&&" with "??" without parentheses`

This is an esbuild parser quirk on Node 16. Upgrade to Node 18+ — see
the Node.js v16 entry above.

## Runtime phase

### Dashboard loads but stays empty (no agents, no signals)

The demo process exited. Check the terminal where you ran the demo — you
should see `[demo] open http://localhost:...` and it should keep running.
If you see `[demo] done`, you ran it with `--once` which exits after one
cycle. Drop `--once` for a long-lived dashboard.

### `Error: listen EADDRINUSE: address already in use :::8787`

Port 8787 is taken. Either:

```bash
# Find and kill the process holding it:
sudo lsof -i :8787
sudo kill $(lsof -t -i :8787)

# Or use a different port:
node scripts/demo-two-agents.mjs --port=9000 --inject
```

### `Error: connect ECONNREFUSED 127.0.0.1:6379` (when using Redis)

Redis isn't running. Either:

```bash
# Local Redis via Docker:
docker run --rm -p 6379:6379 redis:7-alpine

# Local Redis via apt:
sudo apt install redis-server
sudo systemctl start redis

# Or skip Redis entirely (in-process mode works):
unset REDIS_URL
node scripts/demo-two-agents.mjs --inject
```

### Classifier never produces scored signals (everything is `noise`)

Means the LLM call is failing. Check:

```bash
# Test your key manually:
curl -X POST https://hackathon.bitgetops.com/v1/chat/completions \
  -H "Authorization: Bearer $BITGET_QWEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3.6-plus","messages":[{"role":"user","content":"hi"}]}'
```

If that fails with 401, your key is wrong/expired. Re-fetch from your
hackathon registration email or Telegram community.

### Classifier produces `score=0.5, drop=true` for every signal

The Qwen call succeeded but returned `drop: true`. The heuristic fallback
also drops aggressively. Try the demo with verbose output:

```bash
DEBUG=agentbus:* node scripts/demo-two-agents.mjs --inject
```

(we don't actually wire debug output yet — but if you see `[classifier] qwen call failed`
messages, the call is failing and we're falling back to heuristic).

### `pnpm -r test` hangs forever

One of the tests is hitting a network endpoint (e.g. trying to connect
to a Redis that doesn't exist). The transport test has a 5-second
timeout and will skip if no local Redis is reachable, so this should
self-resolve. If it doesn't, kill and re-run:

```bash
# Wait 30 seconds then Ctrl+C, then:
pnpm -r test -- --reporter=verbose
```

### `pnpm smoke` says `[smoke] FAIL: no fills emitted`

Means the chain broke somewhere. Run `pnpm -r build` again and check
the output. Most common cause: a TypeScript file failed to compile but
the build script returned 0 due to `--watch` mode being left on.

## Railway / Docker phase

### `Dockerfile build failed` on Railway

Most common cause: missing package.json in the COPY list. If you added
a new agent package to `agents/`, add it to the Dockerfile's `COPY`
list too:

```dockerfile
COPY agents/your-new-agent/package.json agents/your-new-agent/
```

### `Railway: Build successful, Deploy crashed`

Check the Railway logs for the runtime error. Common causes:

1. **`AGENTBUS_MODE=live` but no Bitget creds** — switch back to paper or add the three env vars.
2. **Port mismatch** — Railway injects `$PORT`. We honor it. If you overrode it, unset.
3. **Out of memory** — Railway free tier has 512 MB. The runtime uses ~80 MB so should fit.

### `Railway: dashboard URL returns 502`

The container is still starting up. Wait 30 seconds, refresh.

## Reset everything

If all else fails, nuke and reinstall:

```bash
cd ~/Agentbus
git pull origin main
rm -rf node_modules packages/*/node_modules agents/*/node_modules
rm -rf packages/*/dist agents/*/dist
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r test
```

If `pnpm -r test` still fails, copy the output and open an issue:
https://github.com/Peesounds9/Agentbus/issues
