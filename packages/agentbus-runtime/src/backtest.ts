/**
 * Backtest — replays a recorded JSONL session through the bus and
 * reconstructs equity curve + simple stats. No live trading, no network.
 */

import { readFileSync } from 'node:fs';
import type { BusMessage, Fill, OrderUpdate } from 'agentbus-core';

export interface BacktestResult {
  fills: number;
  orders: number;
  startTs: number;
  endTs: number;
  /** Realized PnL computed from buy/sell round trips per symbol. */
  realizedPnlUsdt: number;
  /** Final position sizes per symbol. */
  finalPositions: Record<string, number>;
  /** Average price paid per symbol (for unrealized PnL). */
  avgCost: Record<string, number>;
}

export function replaySession(logPath: string, marks: Record<string, number>): BacktestResult {
  const lines = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  const fills: Fill[] = [];
  const orders: OrderUpdate[] = [];
  for (const line of lines) {
    const m = JSON.parse(line) as BusMessage<Fill | OrderUpdate>;
    if (m.kind === 'fill') fills.push(m.payload as Fill);
    else if (m.kind === 'order_update') orders.push(m.payload as OrderUpdate);
  }

  // Average-cost accounting
  const pos: Record<string, number> = {};
  const cost: Record<string, number> = {};
  let realized = 0;
  for (const f of fills) {
    const cur = pos[f.symbol] ?? 0;
    const curCost = cost[f.symbol] ?? 0;
    const sideSign = f.side === 'buy' ? 1 : -1;
    const newQty = cur + sideSign * f.qty;
    if ((cur >= 0 && newQty >= 0) || (cur <= 0 && newQty <= 0)) {
      // same side: average in
      const newCost = curCost + sideSign * f.qty * f.price;
      pos[f.symbol] = newQty;
      cost[f.symbol] = newCost;
    } else {
      // crossing zero: realize PnL on the closed portion
      const closingQty = Math.min(Math.abs(cur), f.qty) * sideSign;
      realized += closingQty * (f.price - curCost / Math.max(Math.abs(cur), 1e-9));
      pos[f.symbol] = newQty;
      // carry cost basis forward
      if (Math.sign(newQty) !== Math.sign(cur)) {
        cost[f.symbol] = newQty * f.price; // flipped side, reset basis
      } else {
        cost[f.symbol] = curCost + sideSign * (f.qty - Math.abs(cur)) * f.price;
      }
    }
  }

  const startTs = fills[0]?.ts ?? 0;
  const endTs = fills[fills.length - 1]?.ts ?? 0;

  return {
    fills: fills.length,
    orders: orders.length,
    startTs,
    endTs,
    realizedPnlUsdt: round2(realized),
    finalPositions: roundMap(pos, 6),
    avgCost: roundMap(cost, 2),
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function roundMap(m: Record<string, number>, p: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) {
    out[k] = Math.round(v * 10 ** p) / 10 ** p;
  }
  return out;
}
