/**
 * Bitget Skill — installs an AgentBus-aware skill description into
 * a Claude Code / Codex skill folder so an AI agent knows it can drive
 * Bitget through AgentBus.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SKILL_MD = `---
name: agentbus-bitget
description: |
  Trade on Bitget through AgentBus — the multi-agent message bus for AI
  trading. Use when the user wants to run a strategy that involves multiple
  specialist agents (researcher, strategist, executor, risk-manager)
  coordinating on a Bitget account via AgentBus.
version: 0.1.0
---

# agentbus-bitget

This skill lets any MCP-aware AI participate in an AgentBus session that
ends up trading on Bitget.

## When to use

- The user mentions AgentBus, multi-agent trading, or specialist trading agents
- The user wants to coordinate multiple strategies / agents on one Bitget account
- The user wants paper-trading runs to be auditable

## Capabilities

1. **Publish** typed messages to topics:
   - \`signal.<symbol>\` — short-term trading signals
   - \`thesis.<symbol>\` — long-form thesis with explicit invalidation
   - \`order.bitget.futures\` / \`order.bitget.spot\` — order instructions
2. **Subscribe** to:
   - \`fill\` / \`order_update\` — execution feedback
   - \`risk_alert\` — risk manager's warnings
3. **Read history** via the bus recorder (JSONL log)

## Example workflow

\`\`\`
# 1. Check active session
agentbus inspect

# 2. Watch fills in real time
agentbus tail --kind fill --limit 5

# 3. Publish a manual thesis
agentbus publish thesis.BTCUSDT --kind thesis --json '{
  "symbol":"BTCUSDT","side":"long","entry":{"kind":"market"},
  "stopLoss":58000,"takeProfit":72000,
  "invalidation":"4h close < 58k","conviction":0.7,"expectedHoldMs":86400000
}'
\`\`\`

## Bitget credentials

The bus's \`bitget-adapter\` reads \`BITGET_API_KEY\`, \`BITGET_SECRET_KEY\`,
\`BITGET_PASSPHRASE\` from the environment (set via the standard Bitget Agent
Hub flow). Paper mode does not require credentials.

## Safety

- All orders go through the risk-manager agent; orders that breach per-symbol
  cap are shrunk, not rejected.
- Heartbeats from every agent are emitted to \`heartbeat.<agentId>\`; if any
  agent goes silent for >30s the risk-manager flattens its open positions.
`;

export function installSkill(targetDir: string): string {
  const skillDir = join(targetDir, 'agentbus-bitget');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), SKILL_MD);
  return skillDir;
}
