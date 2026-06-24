#!/usr/bin/env node
/**
 * Run the backtest replay against a recorded session.
 *
 *   node scripts/run-backtest.mjs examples/paper-trading-session/session.jsonl
 *
 * Prints realized PnL, final positions, and average cost basis.
 */

import { replaySession } from '../packages/agentbus-runtime/dist/index.js';
import { resolve } from 'node:path';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/run-backtest.mjs <log.jsonl>');
  process.exit(1);
}

const path = resolve(process.cwd(), arg);
const marks = { BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 };
const result = replaySession(path, marks);
console.log(JSON.stringify(result, null, 2));
