# syntax=docker/dockerfile:1.7
# AgentBus — Dockerfile for Railway / Fly / Render / any container host.
#
# Two stages:
#   builder  : pnpm install + tsc build all 12 packages
#   runtime  : minimal node:20-alpine, runs the two-agent demo + dashboard
#
# Set these env vars on the host (Railway → Variables):
#   AGENTBUS_MODE   = paper (default) | live
#   PORT            = 8787 (Railway sets this automatically; we honor it)
#   BITGET_QWEN_API_KEY  (optional — enables real Qwen classifier)
#   BITGET_API_KEY / BITGET_SECRET_KEY / BITGET_PASSPHRASE (only for live)
#   REDIS_URL       (optional — enables Redis transport)

ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=9

# ────────── builder ──────────
FROM node:${NODE_VERSION} AS builder
ARG PNPM_VERSION

# Corepack gives us a pinned pnpm without a global install.
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy lockfile + manifests first for cache reuse.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/agentbus-core/package.json       packages/agentbus-core/
COPY packages/agentbus-bitget/package.json     packages/agentbus-bitget/
COPY packages/agentbus-runtime/package.json   packages/agentbus-runtime/
COPY packages/agentbus-cli/package.json        packages/agentbus-cli/
COPY packages/agentbus-mcp/package.json        packages/agentbus-mcp/
COPY agents/researcher/package.json           agents/researcher/
COPY agents/strategist/package.json           agents/strategist/
COPY agents/risk-manager/package.json         agents/risk-manager/
COPY agents/executor/package.json             agents/executor/
COPY agents/classifier/package.json           agents/classifier/
COPY agents/coop-demo/package.json            agents/coop-demo/
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile

# Now copy the rest of the source.
COPY packages/ ./packages/
COPY agents/   ./agents/
COPY scripts/  ./scripts/

RUN pnpm -r build

# ────────── runtime ──────────
FROM node:${NODE_VERSION} AS runtime
ARG PNPM_VERSION

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy only what's needed at runtime: built artifacts + the demo script.
COPY --from=builder /app/package.json               ./
COPY --from=builder /app/pnpm-lock.yaml             ./
COPY --from=builder /app/pnpm-workspace.yaml        ./
COPY --from=builder /app/tsconfig.base.json         ./

# Workspace package.jsons
COPY --from=builder /app/packages/agentbus-core/package.json     packages/agentbus-core/
COPY --from=builder /app/packages/agentbus-bitget/package.json   packages/agentbus-bitget/
COPY --from=builder /app/packages/agentbus-runtime/package.json packages/agentbus-runtime/
COPY --from=builder /app/packages/agentbus-mcp/package.json     packages/agentbus-mcp/
COPY --from=builder /app/packages/agentbus-cli/package.json     packages/agentbus-cli/
COPY --from=builder /app/agents/researcher/package.json         agents/researcher/
COPY --from=builder /app/agents/strategist/package.json         agents/strategist/
COPY --from=builder /app/agents/risk-manager/package.json       agents/risk-manager/
COPY --from=builder /app/agents/executor/package.json           agents/executor/
COPY --from=builder /app/agents/classifier/package.json         agents/classifier/
COPY --from=builder /app/agents/coop-demo/package.json          agents/coop-demo/

# Built JS + source TS so transitive type resolution works at runtime if needed
COPY --from=builder /app/packages/   ./packages/
COPY --from=builder /app/agents/     ./agents/

# Install production-only deps (drops devDependencies like vitest/typescript).
RUN pnpm install --frozen-lockfile --prod

# Demo + dashboard scripts.
COPY scripts/ ./scripts/

# Default ports
ENV PORT=8787
ENV AGENTBUS_MODE=paper
ENV NODE_ENV=production

EXPOSE 8787

# Healthcheck — dashboard root must return 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Run the two-agent demo with the dashboard. Railway sets $PORT.
CMD ["sh", "-c", "node scripts/demo-two-agents.mjs --port=${PORT:-8787}"]
