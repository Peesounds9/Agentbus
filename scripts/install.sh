#!/usr/bin/env bash
# AgentBus — one-shot installer for beginners.
#
# What it does:
#   1. Checks for node >= 18 (installs via NodeSource if missing).
#   2. Checks for pnpm >= 9 (installs globally via npm if missing).
#   3. Runs pnpm install (with frozen lockfile).
#   4. Runs pnpm -r build (compiles all 12 packages).
#   5. Runs pnpm -r test (sanity-checks the build).
#   6. Runs pnpm smoke (asserts the bus is alive).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Peesounds9/Agentbus/main/scripts/install.sh | bash
#   # or
#   ./scripts/install.sh
#
# Safe to re-run. Re-runs are idempotent — detects existing installs and skips.

set -euo pipefail

NODE_MIN_MAJOR=18
PNPM_MIN_MAJOR=9
REPO_URL="https://github.com/Peesounds9/Agentbus.git"

# ─────────── colours ───────────
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
RED=$'\033[0;31m'
BLUE=$'\033[0;34m'
RESET=$'\033[0m'

info()  { printf "%b\n" "${BLUE}▸${RESET} $*"; }
ok()    { printf "%b\n" "${GREEN}✓${RESET} $*"; }
warn()  { printf "%b\n" "${YELLOW}!${RESET} $*"; }
fail()  { printf "%b\n" "${RED}✗${RESET} $*"; exit 1; }

# ─────────── 1. node ───────────
info "Checking for Node.js >= ${NODE_MIN_MAJOR}"
if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not found — installing via NodeSource (needs sudo)."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v brew >/dev/null 2>&1; then
    brew install node@20
    brew link --force node@20
  else
    fail "Please install Node.js >= ${NODE_MIN_MAJOR} from https://nodejs.org/"
  fi
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "$NODE_VERSION" | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt "$NODE_MIN_MAJOR" ]; then
  fail "Found Node $NODE_VERSION, need >= ${NODE_MIN_MAJOR}. Update from https://nodejs.org/"
fi
ok "Node $NODE_VERSION"

# ─────────── 2. pnpm ───────────
info "Checking for pnpm >= ${PNPM_MIN_MAJOR}"
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found — installing globally via npm (may need sudo)."
  if command -v sudo >/dev/null 2>&1; then
    sudo npm install -g pnpm@${PNPM_MIN_MAJOR}
  else
    npm install -g pnpm@${PNPM_MIN_MAJOR}
  fi
fi

PNPM_VERSION="$(pnpm --version)"
PNPM_MAJOR="$(echo "$PNPM_VERSION" | cut -d. -f1)"
if [ "$PNPM_MAJOR" -lt "$PNPM_MIN_MAJOR" ]; then
  warn "pnpm $PNPM_VERSION is too old — upgrading."
  npm install -g pnpm@${PNPM_MIN_MAJOR}
fi
ok "pnpm $PNPM_VERSION"

# ─────────── 3. clone ───────────
REPO_DIR="${AGENTBUS_DIR:-$HOME/Agentbus}"
if [ ! -d "$REPO_DIR" ]; then
  info "Cloning AgentBus to $REPO_DIR"
  git clone --depth 1 "$REPO_URL" "$REPO_DIR"
else
  info "Using existing repo at $REPO_DIR"
  cd "$REPO_DIR"
  git pull --ff-only origin main || warn "git pull failed — continuing with local checkout"
fi
cd "$REPO_DIR"

# ─────────── 4. install deps ───────────
info "Installing dependencies (pnpm install)"
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ─────────── 5. build ───────────
info "Building all packages (pnpm -r build)"
pnpm -r build
ok "Build complete"

# ─────────── 6. test ───────────
info "Running test suite"
pnpm -r test 2>&1 | tail -20

# ─────────── 7. smoke ───────────
info "Running smoke test (no network, no credentials)"
if pnpm smoke >/tmp/agentbus-smoke.log 2>&1; then
  ok "Smoke test passed"
else
  cat /tmp/agentbus-smoke.log
  fail "Smoke test failed — see /tmp/agentbus-smoke.log"
fi

# ─────────── done ───────────
echo
printf "%b\n" "${GREEN}AgentBus is ready.${RESET}"
echo
echo "Next steps:"
echo "  cd $REPO_DIR"
echo "  node scripts/demo-two-agents.mjs --inject         # 2-agent demo + dashboard"
echo "  node scripts/demo-paper-session.mjs               # 4-agent demo"
echo "  pnpm -r test                                     # full test suite"
echo
echo "Optional env vars (any one enables the LLM classifier):"
echo "  export BITGET_QWEN_API_KEY=sk-...                 # Bitget hackathon Qwen proxy"
echo "  export OPENAI_API_KEY=sk-...                      # or any OpenAI-compatible key"
echo "  export OPENAI_BASE_URL=http://localhost:11434/v1  # + OPENAI_MODEL=llama3.2  (Ollama)"
echo
echo "Full docs: $REPO_DIR/docs/"
echo "  README.md               — overview + quickstart"
echo "  docs/two-agent-demo.md  — what the dashboard shows"
echo "  docs/TROUBLESHOOTING.md — common install errors"
echo
