#!/usr/bin/env node
/**
 * Smoke test for AgentBus.
 *
 * Runs without a real exchange connection. Boots an in-process bus,
 * injects a few macro ticks, prints the bus state + a snippet of the
 * history, and exits non-zero on failure.
 */

import { AgentBusRuntime } from '../packages/agentbus-runtime/dist/index.js';

const marks = { BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 };
const rt = new AgentBusRuntime({ mode: 'paper', paperCashUsdt: 10_000, logPath: './logs/smoke.jsonl' });
await rt.start();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
rt.injectTick({ bias: 'risk_on', confidence: 0.8 });
await sleep(50);
rt.injectTick({ bias: 'risk_off', confidence: 0.6 });
await sleep(200);

const inspect = rt.bus.inspect();
const fills = rt.bus.historySnapshot({ kind: 'fill', limit: 10 });
const orders = rt.bus.historySnapshot({ kind: 'order_update', limit: 10 });
const plans = rt.bus.historySnapshot({ kind: 'plan', limit: 10 });

console.log('[smoke] bus inspect:', inspect);
console.log('[smoke] plans emitted:', plans.length);
console.log('[smoke] orders emitted:', orders.length);
console.log('[smoke] fills emitted:', fills.length);

if (plans.length === 0) {
  console.error('[smoke] FAIL: no plans emitted');
  await rt.stop();
  process.exit(1);
}
if (fills.length === 0) {
  console.error('[smoke] FAIL: no fills emitted');
  await rt.stop();
  process.exit(1);
}

await rt.stop();
console.log('[smoke] PASS');
