/**
 * Risk engine — pure functions used by the risk-manager agent.
 *
 * Inputs are orders + a snapshot of current portfolio state; outputs are
 * RiskCheck verdicts. The engine never calls the exchange — it only decides.
 */

import { Order, RiskCheck } from './types.js';

export interface PortfolioSnapshot {
  /** Current cash (USDT) available for new positions. */
  cashUsdt: number;
  /** Total account equity in USDT. */
  equityUsdt: number;
  /** Per-symbol open position qty (signed: + long, - short). */
  positions: Record<string, number>;
  /** Per-symbol mark price (USDT). */
  marks: Record<string, number>;
  /** Optional exposure caps, fraction of equity (0..1). */
  caps?: {
    /** Max fraction of equity in any single symbol. */
    perSymbol?: number;
    /** Max fraction of equity in perpetuals total. */
    perpTotal?: number;
    /** Max number of open symbols. */
    maxSymbols?: number;
  };
}

export interface RiskConfig {
  defaultPerSymbolCap: number; // 0..1
  defaultPerpTotalCap: number;
  defaultMaxSymbols: number;
  /** Order notional floor — anything smaller is rejected as dust. */
  minNotionalUsdt: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  defaultPerSymbolCap: 0.2,
  defaultPerpTotalCap: 0.6,
  defaultMaxSymbols: 5,
  minNotionalUsdt: 10,
};

export function evaluateOrder(
  order: Order,
  snap: PortfolioSnapshot,
  cfg: RiskConfig = DEFAULT_RISK_CONFIG,
): RiskCheck {
  const checks: RiskCheck['checks'] = [];
  const mark = snap.marks[order.symbol] ?? 0;
  const price = order.type === 'limit' && order.price ? order.price : mark;
  const notional = order.sizeIsQuote
    ? order.size
    : order.size * price;

  const curQty = snap.positions[order.symbol] ?? 0;

  // 1. Notional sanity
  checks.push({
    name: 'notional_floor',
    ok: notional >= cfg.minNotionalUsdt,
    detail: `notional=${notional.toFixed(2)} USDT`,
  });
  if (notional < cfg.minNotionalUsdt) {
    return reject(order, 'below minimum notional', checks);
  }

  // 2. Cash check (spot orders must be self-funded from cash)
  if (order.leverage === undefined) {
    checks.push({
      name: 'cash_available',
      ok: notional <= snap.cashUsdt,
      detail: `need=${notional.toFixed(2)} have=${snap.cashUsdt.toFixed(2)}`,
    });
    if (notional > snap.cashUsdt) return reject(order, 'insufficient cash', checks);
  }

  // 3. Reduce-only guard — runs BEFORE sizing caps so a reduce-only order
  //    is never widened into a position-extending one.
  if (order.reduceOnly) {
    const closes = order.side === 'buy' ? curQty < 0 : curQty > 0;
    checks.push({ name: 'reduce_only_closes', ok: closes, detail: `pos=${curQty}` });
    if (!closes) return reject(order, 'reduce-only order would open or extend', checks);
  }

  // 4. Per-symbol cap (post-trade)
  const cap = snap.caps?.perSymbol ?? cfg.defaultPerSymbolCap;
  const sideSign = order.side === 'buy' ? 1 : -1;
  const newQty = curQty + sideSign * (order.sizeIsQuote ? order.size / Math.max(price, 1e-9) : order.size);
  const projectedNotional = Math.abs(newQty) * price;
  const projectedPct = projectedNotional / Math.max(snap.equityUsdt, 1e-9);
  checks.push({
    name: 'per_symbol_cap',
    ok: projectedPct <= cap,
    detail: `projected=${(projectedPct * 100).toFixed(1)}% cap=${(cap * 100).toFixed(0)}%`,
  });
  if (projectedPct > cap) {
    // Try to shrink the order to fit the cap
    const allowedQty = (cap * snap.equityUsdt) / Math.max(price, 1e-9);
    const shrunkenQty = order.sizeIsQuote ? order.size : Math.abs(allowedQty - Math.abs(curQty)) * sideSign;
    if (Math.abs(shrunkenQty) * price < cfg.minNotionalUsdt) {
      return reject(order, 'would breach per-symbol cap and cannot shrink meaningfully', checks);
    }
    return {
      order,
      decision: 'shrink',
      reason: `shrunk to fit per-symbol cap ${(cap * 100).toFixed(0)}%`,
      proposedSize: order.sizeIsQuote ? shrunkenQty : Math.abs(shrunkenQty),
      checks,
    };
  }

  // 5. Diversity cap
  const maxSym = snap.caps?.maxSymbols ?? cfg.defaultMaxSymbols;
  const wouldOpenNew = curQty === 0 && newQty !== 0;
  if (wouldOpenNew) {
    const opened = Object.values(snap.positions).filter((q) => Math.abs(q) > 1e-9).length;
    checks.push({
      name: 'max_symbols',
      ok: opened < maxSym,
      detail: `opened=${opened} cap=${maxSym}`,
    });
    if (opened >= maxSym) return reject(order, 'max symbols reached', checks);
  }

  return { order, decision: 'allow', reason: 'all checks passed', checks };
}

function reject(order: Order, reason: string, checks: RiskCheck['checks']): RiskCheck {
  return { order, decision: 'reject', reason, checks };
}
