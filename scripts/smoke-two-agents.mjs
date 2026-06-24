#!/usr/bin/env node
/**
 * Smoke test for the two-agent cooperating demo.
 *
 *   - boots CoopDemo with dashboard on a random port
 *   - injects the demo sequence
 *   - hits the dashboard over HTTP and asserts the live state has the expected shape
 *   - asserts the JSONL audit log has at least one fill and one order_update
 *   - exits non-zero on any failure
 */

import { CoopDemo } from '../agents/coop-demo/dist/index.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const logPath = join(tmpdir(), `agentbus-smoke-${Date.now()}.jsonl`);
const port = 8790 + Math.floor(Math.random() * 50);

const demo = new CoopDemo({
  mode: 'paper',
  paperCashUsdt: 10_000,
  logPath,
  dashboardPort: port,
});
await demo.start();
console.log(`[smoke] bus ${demo.bus.id} on http://localhost:${port}`);

demo.injectDemoSequence();
await new Promise((r) => setTimeout(r, 700));

// Hit the dashboard
const r = await fetch(`http://localhost:${port}/api/state`);
if (!r.ok) {
  console.error(`[smoke] FAIL: GET /api/state returned ${r.status}`);
  await demo.stop();
  process.exit(1);
}
const state = await r.json();

const fails = [];
if (state.busId !== demo.bus.id) fails.push('busId mismatch');
if (state.agents.length !== 3) fails.push(`expected 3 agents, got ${state.agents.length}`);
if (state.signals.length === 0) fails.push('no signals in history');
if (state.fills.length === 0) fails.push('no fills — high-quality signals should have executed');

// Read the JSONL log
const { readFileSync } = await import('node:fs');
const log = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
const kinds = log.map((l) => JSON.parse(l).kind);
const fillCount = kinds.filter((k) => k === 'fill').length;
const orderUpdateCount = kinds.filter((k) => k === 'order_update').length;
console.log(`[smoke] log lines: ${log.length}, fills: ${fillCount}, order_updates: ${orderUpdateCount}`);
if (fillCount === 0) fails.push('JSONL log has no fills');
if (orderUpdateCount === 0) fails.push('JSONL log has no order_updates');

await demo.stop();

if (fails.length) {
  console.error('[smoke] FAIL:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}

console.log('[smoke] PASS');
console.log(`  bus: ${state.busId}`);
console.log(`  agents: ${state.agents.map((a) => a.id).join(', ')}`);
console.log(`  signals: ${state.signals.length}, fills: ${state.fills.length}, log: ${logPath}`);
process.exit(0);
