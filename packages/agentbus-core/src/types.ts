/**
 * AgentBus Core — Typed Message Types
 *
 * The set of canonical message kinds that flow through the bus. Every agent
 * in the AgentBus ecosystem publishes / subscribes to these. Extensions can
 * add custom kinds via {@link AgentBus.registerKind}.
 */

/** All built-in message kinds. Adding a kind here is a breaking change — extend via registerKind. */
export type MessageKind =
  // perception / research
  | 'signal'
  | 'thesis'
  | 'macro'
  | 'sentiment'
  | 'news'
  | 'onchain'
  // decision
  | 'plan'
  | 'risk_check'
  | 'risk_alert'
  // execution
  | 'order'
  | 'order_update'
  | 'fill'
  | 'position_update'
  // post-trade
  | 'metric'
  | 'log'
  | 'heartbeat'
  // generic escape hatch
  | 'custom';

/** A single market signal produced by an analyst agent. */
export interface Signal {
  symbol: string;            // e.g. "BTCUSDT"
  venue?: string;            // default "bitget"
  direction: 'long' | 'short' | 'flat';
  confidence: number;        // 0..1
  horizon: 'scalp' | 'intraday' | 'swing' | 'position';
  rationale: string;
  sources?: string[];        // e.g. ["macro-analyst", "onchain:whale"]
  ttlMs?: number;            // signal expires after this many ms
}

/** A long-form thesis with explicit entry / exit / invalidation. */
export interface Thesis {
  symbol: string;
  venue?: string;
  side: 'long' | 'short';
  entry: { kind: 'market' | 'limit'; price?: number };
  stopLoss: number;
  takeProfit: number;
  invalidation: string;      // human readable: "BTC closes < 58k on 4h"
  conviction: number;        // 0..1
  expectedHoldMs: number;
}

/** An executable order instruction produced by the executor agent. */
export interface Order {
  symbol: string;
  venue?: string;            // default "bitget"
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  size: number;              // base units (BTC) or quote units if sizeIsQuote
  sizeIsQuote?: boolean;     // true = size is in USDT
  leverage?: number;         // for futures
  reduceOnly?: boolean;
  price?: number;            // required when type=limit
  clientOrderId?: string;
  thesisId?: string;         // links back to the Thesis
  signalIds?: string[];
}

/** An order update (accepted, partially-filled, filled, cancelled, rejected). */
export interface OrderUpdate {
  clientOrderId?: string;
  exchangeOrderId?: string;
  symbol: string;
  status: 'new' | 'partial' | 'filled' | 'cancelled' | 'rejected' | 'expired';
  filledQty: number;
  avgFillPrice?: number;
  fee?: number;
  feeCurrency?: string;
  reason?: string;
}

/** An executed fill. */
export interface Fill {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  fee?: number;
  feeCurrency?: string;
  ts: number;
  venue?: string;
}

/** A risk alert raised by the risk manager. */
export interface RiskAlert {
  severity: 'info' | 'warn' | 'critical';
  scope: 'account' | 'symbol' | 'strategy';
  symbol?: string;
  strategyId?: string;
  message: string;
  action?: 'reduce' | 'flatten' | 'pause_new_orders' | 'none';
  metric?: { name: string; value: number; threshold: number };
}

/** A risk check verdict on a proposed order. */
export interface RiskCheck {
  order: Order;
  decision: 'allow' | 'reject' | 'shrink';
  reason: string;
  proposedSize?: number;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

/** Generic metric emission (PnL, drawdown, exposure, winrate, etc). */
export interface Metric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

/** Heartbeat — proves an agent is alive. */
export interface Heartbeat {
  agentId: string;
  status: 'idle' | 'working' | 'degraded' | 'down';
  uptimeMs: number;
  loadHint?: { queueDepth?: number; lastWorkMs?: number };
}

/** The fully-typed envelope that wraps every bus message. */
export interface BusMessage<T = unknown> {
  id: string;                // unique message id
  ts: number;                // wall clock ms
  topic: string;             // e.g. "signal.btc" or "order.bitget.futures"
  kind: MessageKind;
  from: string;              // producer agent id
  correlationId?: string;    // groups related messages
  causationId?: string;      // the message that caused this one
  payload: T;
  metadata?: Record<string, string>;
  expiresAt?: number;        // optional TTL
}

export type Handler<T = unknown> = (msg: BusMessage<T>) => void | Promise<void>;
