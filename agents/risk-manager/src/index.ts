/**
 * Risk Manager Agent
 *
 * Listens to every `plan` (and every fill) and emits either:
 *   - `order.bitget.futures` if the plan passes risk
 *   - `risk_alert` if it would breach a constraint
 *
 * Also runs a watchdog: if any heartbeating agent goes silent for >30s,
 * publish a `risk_alert` to flatten its open positions.
 */

import {
  Agent,
  evaluateOrder,
  type BusMessage,
  type Order,
  type PortfolioSnapshot,
  type RiskAlert,
  type Thesis,
} from 'agentbus-core';

export interface RiskManagerOptions {
  bus: import('agentbus-core').AgentBus;
  /** Snapshot provider — usually the Bitget adapter. */
  snapshot: () => PortfolioSnapshot;
  /** Where to publish approved orders. */
  orderTopic?: string;
  /** Risk config overrides. */
  config?: Parameters<typeof evaluateOrder>[2];
  /** Agent silence watchdog timeout (ms). */
  watchdogMs?: number;
  /** Reference mark prices for the snapshot. */
  marks: Record<string, number>;
  /** Demo order size (will be shrunk by the engine if needed). */
  demoOrderSize?: number;
  /** Demo leverage. */
  demoLeverage?: number;
}

export function startRiskManager(opts: RiskManagerOptions): Agent {
  const orderTopic = opts.orderTopic ?? 'order.bitget.futures';
  const cfg = opts.config ?? {
    defaultPerSymbolCap: 0.25,
    defaultPerpTotalCap: 0.7,
    defaultMaxSymbols: 4,
    minNotionalUsdt: 25,
  };
  const watchdogMs = opts.watchdogMs ?? 30_000;
  const demoSize = opts.demoOrderSize ?? 0.02;
  const demoLeverage = opts.demoLeverage ?? 2;

  const agent = new Agent({ bus: opts.bus, id: 'risk-manager' });
  const lastSeen = new Map<string, number>();

  agent.start({
    pattern: 'plan.>',
    kinds: ['plan'],
    handler: async (msg: BusMessage<Thesis>) => {
      const plan = msg.payload;
      const order: Order = {
        symbol: plan.symbol,
        side: plan.side === 'long' ? 'buy' : 'sell',
        type: plan.entry.kind,
        price: plan.entry.price,
        size: demoSize,
        leverage: demoLeverage,
        signalIds: [msg.causationId].filter(Boolean) as string[],
      };
      const check = evaluateOrder(order, opts.snapshot(), cfg);
      agent.publish('risk_check', 'risk_check', check, {
        from: agent.id,
        correlationId: msg.correlationId,
        causationId: msg.id,
      });
      if (check.decision === 'reject') {
        const alert: RiskAlert = {
          severity: 'warn',
          scope: 'symbol',
          symbol: plan.symbol,
          message: `risk rejected order: ${check.reason}`,
          action: 'none',
        };
        agent.publish('risk_alert', 'risk_alert', alert, {
          from: agent.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
        return;
      }
      const final: Order = { ...order };
      if (check.decision === 'shrink' && check.proposedSize) final.size = check.proposedSize;
      agent.publish(orderTopic, 'order', final, {
        from: agent.id,
        correlationId: msg.correlationId,
        causationId: msg.id,
      });
    },
    announce: true,
  });

  // Watchdog loop — scan heartbeats and alert if any agent is silent
  const wd = setInterval(() => {
    const now = Date.now();
    const hb = opts.bus.historySnapshot({ kind: 'heartbeat', limit: 200 });
    for (const m of hb) {
      const p = m.payload as { agentId: string };
      const prev = lastSeen.get(p.agentId) ?? 0;
      if (now - prev > watchdogMs) {
        const alert: RiskAlert = {
          severity: 'critical',
          scope: 'strategy',
          strategyId: p.agentId,
          message: `${p.agentId} silent for ${Math.round((now - prev) / 1000)}s — consider flatten`,
          action: 'flatten',
        };
        agent.publish('risk_alert', 'risk_alert', alert, { from: agent.id });
        lastSeen.set(p.agentId, now); // throttle
      } else if (m.ts > prev) {
        lastSeen.set(p.agentId, m.ts);
      }
    }
  }, 5_000);
  if (typeof wd.unref === 'function') wd.unref();

  return agent;
}
