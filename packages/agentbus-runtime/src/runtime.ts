/**
 * AgentBus Runtime — wires up the four reference agents on a single bus
 * and runs them as a long-lived daemon.
 *
 * The reference topology:
 *
 *   Researcher  ─signal/thesis─▶  Strategist
 *                                  │
 *                                  ▼  plan
 *                               Executor ─order─▶ Bitget Adapter ─fill/ack─▶ (back to bus)
 *                                  │                                            │
 *                                  ▼                                            │
 *                              Risk Manager ◀───risk_alert───────────────────┘
 *                                  │
 *                                  ▼  (rejects / shrinks orders)
 *                              Executor
 *
 * The runtime also runs a PaperSessionRecorder that writes a JSONL log
 * of every order_update and fill for the hackathon submission.
 */

import {
  AgentBus,
  Agent,
  evaluateOrder,
  type PortfolioSnapshot,
  type RiskCheck,
  type Order,
} from 'agentbus-core';
import {
  BitgetAdapter,
  PaperSessionRecorder,
} from 'agentbus-bitget';

export interface RuntimeOptions {
  mode: 'paper' | 'live';
  paperCashUsdt?: number;
  logPath?: string;
  /** Hook to inject reference prices for paper mode (deterministic replay). */
  priceFeed?: PriceFeed;
  /** Override risk config. */
  risk?: Parameters<typeof evaluateOrder>[2];
}

export interface PriceFeed {
  price(symbol: string): number;
}

class StaticPriceFeed implements PriceFeed {
  constructor(private readonly map: Record<string, number>) {}
  price(symbol: string): number {
    return this.map[symbol] ?? 0;
  }
}

export class AgentBusRuntime {
  readonly bus: AgentBus;
  readonly adapter: BitgetAdapter;
  readonly recorder: PaperSessionRecorder;
  private agents: Agent[] = [];
  private riskConfig: Parameters<typeof evaluateOrder>[2];
  private started = false;

  constructor(opts: RuntimeOptions) {
    this.bus = new AgentBus({ persist: true, historySize: 10_000 });
    this.adapter = new BitgetAdapter({
      bus: this.bus,
      mode: opts.mode,
      paperCashUsdt: opts.paperCashUsdt ?? 10_000,
    });
    this.recorder = new PaperSessionRecorder({
      bus: this.bus,
      outPath: opts.logPath ?? './logs/session.jsonl',
    });
    this.riskConfig = opts.risk ?? {
      defaultPerSymbolCap: 0.25,
      defaultPerpTotalCap: 0.7,
      defaultMaxSymbols: 4,
      minNotionalUsdt: 25,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.adapter.start();
    this.agents = [
      this.makeResearcher(),
      this.makeStrategist(),
      this.makeRiskManager(),
      this.makeExecutor(),
    ];
  }

  async stop(): Promise<void> {
    for (const a of this.agents) a.stop();
    this.recorder.stop();
    await this.adapter.stop();
  }

  // ────────── agent factories (lightweight; full impls in /agents) ──────────

  private makeResearcher(): Agent {
    const a = new Agent({ bus: this.bus, id: 'researcher' });
    a.start({
      pattern: 'tick.>',
      kinds: ['macro', 'sentiment', 'news', 'onchain'],
      handler: async (msg) => {
        // Naive demo: every "macro up" tick produces a long bias for BTC
        const payload = msg.payload as { bias?: string; confidence?: number };
        if (payload.bias === 'risk_on') {
          a.publish(
            'signal.btc',
            'signal',
            {
              symbol: 'BTCUSDT',
              direction: 'long',
              confidence: Math.min(1, payload.confidence ?? 0.5),
              horizon: 'intraday',
              rationale: 'macro risk-on, btc beta positive',
              sources: [msg.from],
              ttlMs: 30 * 60_000,
            },
            { from: a.id, correlationId: msg.correlationId, causationId: msg.id },
          );
        }
      },
    });
    return a;
  }

  private makeStrategist(): Agent {
    const a = new Agent({ bus: this.bus, id: 'strategist' });
    a.start({
      pattern: 'signal.>',
      kinds: ['signal'],
      handler: async (msg) => {
        const sig = msg.payload as {
          symbol: string;
          direction: 'long' | 'short' | 'flat';
          confidence: number;
          rationale: string;
        };
        if (sig.direction === 'flat' || sig.confidence < 0.4) return;
        const thesis = {
          symbol: sig.symbol,
          side: sig.direction,
          entry: { kind: 'market' as const },
          stopLoss: 0,    // would come from a real model
          takeProfit: 0,
          invalidation: 'review on next signal',
          conviction: sig.confidence,
          expectedHoldMs: 6 * 3600_000,
        };
        a.publish(`thesis.${sig.symbol}`, 'thesis', thesis, {
          from: a.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
        // emit a plan for the executor to act on
        a.publish('plan.futures', 'plan', thesis, {
          from: a.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
      },
    });
    return a;
  }

  private makeRiskManager(): Agent {
    const a = new Agent({ bus: this.bus, id: 'risk-manager' });
    a.start({
      pattern: 'plan.>',
      kinds: ['plan'],
      handler: async (msg) => {
        const plan = msg.payload as {
          symbol: string;
          side: 'long' | 'short';
          entry: { kind: 'market' | 'limit'; price?: number };
          conviction: number;
        };
        const order: Order = {
          symbol: plan.symbol,
          side: plan.side === 'long' ? 'buy' : 'sell',
          type: plan.entry.kind,
          price: plan.entry.price,
          size: 0.02, // demo size — sized by risk engine
          leverage: 2,
          signalIds: [msg.causationId].filter(Boolean) as string[],
        };
        const snap = this.adapter.snapshot({
          BTCUSDT: 60_000,
          ETHUSDT: 3_000,
          SOLUSDT: 150,
        });
        const check: RiskCheck = evaluateOrder(order, snap, this.riskConfig);
        a.publish('risk_check', 'risk_check', check, {
          from: a.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
        if (check.decision === 'reject') return;
        const final: Order = { ...order };
        if (check.decision === 'shrink' && check.proposedSize) {
          final.size = check.proposedSize;
        }
        a.publish('order.bitget.futures', 'order', final, {
          from: a.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
      },
    });
    return a;
  }

  private makeExecutor(): Agent {
    const a = new Agent({ bus: this.bus, id: 'executor' });
    a.start({
      pattern: 'order.bitget.>',
      kinds: ['order'],
      handler: async (msg) => {
        const order = msg.payload as Order;
        const refPrice = order.price ?? 60_000; // would fetch ticker in live
        await this.adapter.submitOrder(order, refPrice);
      },
    });
    return a;
  }

  // expose a tiny helper for demos
  injectTick(payload: { bias: 'risk_on' | 'risk_off' | 'neutral'; confidence: number }): void {
    this.bus.publish('tick.macro', 'macro', payload, { from: 'human' });
  }

  staticPriceFeed(map: Record<string, number>): PriceFeed {
    return new StaticPriceFeed(map);
  }
}

/** Re-export so callers can grab a portfolio snapshot. */
export type { PortfolioSnapshot };
