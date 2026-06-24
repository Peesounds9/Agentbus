#!/usr/bin/env node
/**
 * Demo paper-trading session.
 *
 * Starts the full AgentBusRuntime in paper mode, injects a small stream of
 * macro / sentiment ticks, lets the agents go to work, and writes a JSONL
 * log to /workspace/AgentBus/examples/paper-trading-session/session.jsonl
 *
 * This is the script the hackathon submission points at for the
 * "live trading record or paper trading log" requirement.
 */

import { AgentBusRuntime } from '../packages/agentbus-runtime/dist/index.js';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const out = resolve(ROOT, 'examples/paper-trading-session/session.jsonl');
mkdirSync(dirname(out), { recursive: true });
if (existsSync(out)) {
  // truncate so each run is reproducible
  await import('node:fs/promises').then((fs) => fs.writeFile(out, ''));
}

const marks = { BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 };

const rt = new AgentBusRuntime({
  mode: 'paper',
  paperCashUsdt: 10_000,
  logPath: out,
});
await rt.start();

console.log('[demo] runtime up; bus id =', rt.bus.id);

// Sequence of macro events to drive a believable session
const seq = [
  { bias: 'risk_on',  confidence: 0.55 }, // weak signal — no plan
  { bias: 'risk_on',  confidence: 0.80 }, // strong → long btc
  { bias: 'neutral',  confidence: 0.50 }, // breather
  { bias: 'risk_on',  confidence: 0.65 }, // add to btc thesis
  { bias: 'risk_off', confidence: 0.60 }, // short eth hedge
  { bias: 'neutral',  confidence: 0.50 },
  { bias: 'risk_off', confidence: 0.85 }, // strong short
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const t of seq) {
  rt.injectTick(t);
  await sleep(120);
}

// Give the async handlers a beat to drain
await sleep(300);

const stats = rt.recorder.markToMarket(marks);
console.log('[demo] stats:', stats);

// Tiny equity curve printer
const curve = [{ ts: stats.startTs, equity: 10_000 }];
let cash = 10_000;
const log = (await import('node:fs/promises')).readFile;
const text = await log(out, 'utf8');
const fills = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.kind === 'fill');
for (const m of fills) {
  const f = m.payload;
  cash -= f.side === 'buy' ? f.qty * f.price + (f.fee ?? 0) : -f.qty * f.price - (f.fee ?? 0);
  curve.push({ ts: m.ts, equity: round2(cash) });
}
console.log('[demo] equity curve:', curve);

await rt.stop();
console.log(`[demo] wrote ${out}`);

function round2(x) { return Math.round(x * 100) / 100; }
