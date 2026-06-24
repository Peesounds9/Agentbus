#!/usr/bin/env node
/**
 * Helper — publish a signal into a running CoopDemo via the bus file.
 *
 * This script boots a tiny standalone bus, publishes a signal, and exits.
 * To see it in a running dashboard, run the dashboard with REDIS transport
 * so both processes share the bus. See docs/redis.md.
 *
 * Without Redis, this script just prints how the dashboard would have
 * received it (useful for sanity-checking the heuristic).
 */

import { AgentBus } from '../packages/agentbus-core/dist/index.js';
import { startClassifier } from '../agents/classifier/dist/index.js';

const arg = (n, d) => {
  const f = process.argv.find((a) => a.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3) : d;
};

const sym = (arg('symbol', 'BTCUSDT')).toUpperCase();
const dir = arg('direction', 'long');
const conf = Number(arg('confidence', '0.7'));
const why = arg('rationale', 'demo signal from publish-signal.mjs');

const bus = new AgentBus();
const classifier = startClassifier({ bus });

bus.publish(`signal.raw.${sym.toLowerCase()}`, 'signal', {
  symbol: sym,
  direction: dir,
  confidence: conf,
  horizon: 'intraday',
  rationale: why,
  sources: ['publish-signal-cli'],
}, { from: 'cli' });

await new Promise((r) => setTimeout(r, 500));

const scored = bus.historySnapshot({ topic: 'signal.scored', limit: 5 });
const noise = bus.historySnapshot({ topic: 'signal.noise', limit: 5 });

if (scored.length) {
  const m = scored[0];
  console.log(`PASSED classifier (q=${m.payload.quality.toFixed(2)}):`);
  console.log(`  ${m.payload.symbol} ${m.payload.direction} conf=${m.payload.confidence}`);
  console.log(`  reason: ${m.metadata?.classifierReason}`);
} else if (noise.length) {
  const m = noise[0];
  console.log(`DROPPED by classifier:`);
  console.log(`  reason: ${m.payload.reason} (score=${m.payload.score.toFixed(2)})`);
} else {
  console.log('(no verdict yet)');
}

classifier.stop();
process.exit(0);
