/**
 * Strategist Agent — converts `signal` messages into a `thesis` + `plan`.
 *
 * A thesis adds risk structure (stop, target, invalidation) on top of
 * a raw signal. A plan is the executable handoff to the risk manager.
 */

import { Agent, type BusMessage, type Signal, type Thesis } from 'agentbus-core';

export interface StrategistOptions {
  bus: import('agentbus-core').AgentBus;
  /** Per-symbol ATR% (used to size stops/targets). */
  atrPct?: number;
  /** Default risk-reward ratio for take-profit distance. */
  rrTarget?: number;
  /** Min signal confidence required to emit a plan. */
  minConfidence?: number;
}

export function startStrategist(opts: StrategistOptions): Agent {
  const atrPct = opts.atrPct ?? 0.02;
  const rrTarget = opts.rrTarget ?? 2.0;
  const minConfidence = opts.minConfidence ?? 0.55;
  const agent = new Agent({ bus: opts.bus, id: 'strategist' });

  agent.start({
    pattern: 'signal.>',
    kinds: ['signal'],
    handler: async (msg: BusMessage<Signal>) => {
      const s = msg.payload;
      if (s.confidence < minConfidence) return;

      // Heuristic: assume the signal has a reference price from metadata
      // (a real agent would fetch the latest ticker from Bitget).
      const refPrice = Number(msg.metadata?.refPrice ?? 60_000);
      const stopDistance = refPrice * atrPct;
      const tpDistance = stopDistance * rrTarget;

      const thesis: Thesis = {
        symbol: s.symbol,
        side: s.direction === 'short' ? 'short' : 'long',
        entry: { kind: 'market' },
        stopLoss: s.direction === 'short' ? refPrice + stopDistance : refPrice - stopDistance,
        takeProfit: s.direction === 'short' ? refPrice - tpDistance : refPrice + tpDistance,
        invalidation: `${refPrice} cross on the wrong side closes the thesis`,
        conviction: s.confidence,
        expectedHoldMs: 6 * 3600_000,
      };
      agent.publish(`thesis.${s.symbol.toLowerCase()}`, 'thesis', thesis, {
        from: agent.id,
        correlationId: msg.correlationId,
        causationId: msg.id,
        metadata: { refPrice: String(refPrice) },
      });
      // Also publish an actionable plan
      agent.publish('plan.futures', 'plan', thesis, {
        from: agent.id,
        correlationId: msg.correlationId,
        causationId: msg.id,
        metadata: { refPrice: String(refPrice) },
      });
    },
    announce: true,
  });
  return agent;
}
