#!/usr/bin/env node
/**
 * Two-agent cooperating demo with dashboard.
 *
 * Boots the CoopDemo runtime, injects a demo sequence of raw signals,
 * serves the dashboard on http://localhost:8787, and writes a JSONL
 * audit log to ./examples/two-agent-demo/session.jsonl.
 *
 * Usage:
 *   node scripts/demo-two-agents.mjs
 *   node scripts/demo-two-agents.mjs --port=8787 --cash=10000 --inject
 *   BITGET_QWEN_API_KEY=sk-xxx node scripts/demo-two-agents.mjs  # uses real Qwen
 */

import { CoopDemo } from '../agents/coop-demo/dist/index.js';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const arg = (n, d) => {
  const f = process.argv.find((a) => a.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3) : d;
};

const port = Number(arg('port', process.env.PORT ?? '8787'));
const cash = Number(arg('cash', '10000'));
const log = resolve(ROOT, arg('log', 'examples/two-agent-demo/session.jsonl'));
const inject = process.argv.includes('--inject');
const runOnce = process.argv.includes('--once');

mkdirSync(dirname(log), { recursive: true });
if (existsSync(log)) {
  await import('node:fs/promises').then((fs) => fs.writeFile(log, ''));
}

const demo = new CoopDemo({
  mode: 'paper',
  paperCashUsdt: cash,
  logPath: log,
  dashboardPort: runOnce ? 0 : port,
  qwenApiKey: process.env.BITGET_QWEN_API_KEY,
});
console.log('[demo] before start');
await demo.start();
console.log('[demo] after start');

console.log(`[demo] bus id = ${demo.bus.id}`);
console.log(`[demo] dashboard: http://localhost:${port}`);
console.log(`[demo] log: ${log}`);
console.log(`[demo] agents: ${demo.bus.inspect().subscribers} subscribers, classifier=${!!process.env.BITGET_QWEN_API_KEY ? 'qwen' : 'heuristic'}`);

if (inject || runOnce) {
  console.log('[demo] injecting…');
  demo.injectDemoSequence();
  console.log('[demo] sleeping 600ms…');
  await new Promise((r) => setTimeout(r, 600));
  console.log('[demo] collecting…');
  const fills = demo.bus.historySnapshot({ kind: 'fill', limit: 10 });
  const noise = demo.bus.historySnapshot({ topic: 'signal.noise', limit: 10 });
  const scored = demo.bus.historySnapshot({ topic: 'signal.scored', limit: 10 });
  console.log(`[demo] scored=${scored.length} noise=${noise.length} fills=${fills.length}`);
  console.log(`[demo] inspect:`, JSON.stringify(demo.bus.inspect(), null, 2));
}

if (runOnce) {
  console.log('[demo] stopping…');
  await demo.stop();
  console.log('[demo] done');
  process.exit(0);
}

// Otherwise: park forever, refresh on dashboard
console.log('[demo] open http://localhost:' + port + ' to watch the bus live.');
console.log('[demo] from another shell:');
console.log('       curl -X POST http://localhost:' + port + '/api/inject   # not implemented — use the API instead:');
console.log('       node -e "import(\'./agents/coop-demo/dist/index.js\').then(m => { const d = new m.CoopDemo({dashboardPort:0}); d.start().then(()=>{ d.publishSignal({symbol:\'BTCUSDT\',direction:\'long\',confidence:0.9,rationale:\'whale 1.2k BTC, CVD+, breakout 60.2k\'}); setTimeout(()=>d.stop(),1500) }); })"');

process.on('SIGINT', async () => {
  console.log('\n[demo] shutting down…');
  await demo.stop();
  process.exit(0);
});
// park forever
await new Promise(() => undefined);
