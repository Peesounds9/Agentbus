/**
 * Bitget Adapter
 *
 * Wraps the Bitget Agent Hub (`bitget-mcp-server`) so an AgentBus agent
 * can drive Bitget via the bus without caring about MCP plumbing.
 *
 * Two execution modes:
 *   - **live**: spawns `npx -y bitget-mcp-server` over stdio and forwards
 *               JSON-RPC tool calls. Requires BITGET_API_KEY etc. env vars.
 *   - **paper**: deterministic local sim — no network calls, returns
 *               simulated fills so the rest of the system can run end-to-end.
 *
 * Both modes publish the same `order_update` and `fill` messages to the bus.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { AgentBus } from 'agentbus-core';
import type { Order, OrderUpdate, Fill, BusMessage } from 'agentbus-core';

export interface BitgetAdapterOptions {
  bus: AgentBus;
  mode: 'live' | 'paper';
  /** topic prefix for outgoing orders, e.g. "order.bitget.futures" */
  orderTopic?: string;
  /** venue label written into fills */
  venue?: string;
  /** when mode=paper: starting cash in USDT */
  paperCashUsdt?: number;
}

interface McpRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}
interface McpResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class BitgetAdapter {
  readonly mode: 'live' | 'paper';
  private readonly bus: AgentBus;
  private readonly orderTopic: string;
  private readonly venue: string;
  private proc?: ChildProcessWithoutNullStreams;
  private nextRpcId = 1;
  private pending = new Map<number, (resp: McpResponse) => void>();
  private readonly paper: { cash: number; positions: Record<string, number>; fills: Fill[] };

  constructor(opts: BitgetAdapterOptions) {
    this.mode = opts.mode;
    this.bus = opts.bus;
    this.orderTopic = opts.orderTopic ?? 'order.bitget.futures';
    this.venue = opts.venue ?? 'bitget';
    this.paper = {
      cash: opts.paperCashUsdt ?? 10_000,
      positions: {},
      fills: [],
    };
  }

  /** Start the underlying MCP server (live mode only). */
  async start(): Promise<void> {
    if (this.mode !== 'live') return;
    this.proc = spawn('npx', ['-y', 'bitget-mcp-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.proc.stdout.on('data', (chunk) => this.onStdout(chunk.toString('utf8')));
    this.proc.stderr.on('data', () => undefined);
  }

  async stop(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      this.proc = undefined;
    }
  }

  /**
   * Submit an order to Bitget. Publishes an `order_update` (accepted) and
   * (later) a `fill` to the bus. Returns the clientOrderId.
   *
   * In `paper` mode, fill is immediate at the provided reference price
   * (or a deterministic mark if none).
   */
  async submitOrder(order: Order, refPrice: number): Promise<string> {
    const clientOrderId = order.clientOrderId ?? `ab_${randomUUID().slice(0, 8)}`;
    const fullOrder: Order = { ...order, clientOrderId };
    const topic = this.orderTopic;

    // 1. Acknowledge the order immediately
    const accepted: OrderUpdate = {
      clientOrderId,
      symbol: order.symbol,
      status: 'new',
      filledQty: 0,
    };
    this.bus.publish(topic, 'order_update', accepted, {
      from: 'bitget-adapter',
      metadata: { mode: this.mode },
    });

    // 2. Execute
    try {
      if (this.mode === 'live') {
        const res = await this.rpc('tools/call', {
          name: order.leverage ? 'futures_place_order' : 'spot_place_order',
          arguments: this.toBitgetArgs(fullOrder),
        });
        const exchangeOrderId = String((res as { orderId?: string })?.orderId ?? '');
        const filled: OrderUpdate = {
          clientOrderId,
          exchangeOrderId,
          symbol: order.symbol,
          status: 'filled',
          filledQty: order.size,
          avgFillPrice: refPrice,
          fee: order.size * refPrice * 0.0006, // taker fee ~0.06%
          feeCurrency: 'USDT',
        };
        this.bus.publish(topic, 'order_update', filled, { from: 'bitget-adapter' });
      } else {
        // paper
        const fill = this.executePaper(fullOrder, refPrice);
        this.bus.publish(topic, 'fill', fill, { from: 'bitget-adapter' });
        const filled: OrderUpdate = {
          clientOrderId,
          symbol: order.symbol,
          status: 'filled',
          filledQty: fill.qty,
          avgFillPrice: fill.price,
          fee: fill.fee,
          feeCurrency: fill.feeCurrency,
        };
        this.bus.publish(topic, 'order_update', filled, { from: 'bitget-adapter' });
      }
      return clientOrderId;
    } catch (err) {
      const rejected: OrderUpdate = {
        clientOrderId,
        symbol: order.symbol,
        status: 'rejected',
        filledQty: 0,
        reason: (err as Error).message,
      };
      this.bus.publish(topic, 'order_update', rejected, { from: 'bitget-adapter' });
      throw err;
    }
  }

  /** Paper-only snapshot used by the risk engine. */
  snapshot(marks: Record<string, number>): {
    cashUsdt: number;
    equityUsdt: number;
    positions: Record<string, number>;
    marks: Record<string, number>;
  } {
    let posNotional = 0;
    for (const [sym, qty] of Object.entries(this.paper.positions)) {
      const m = marks[sym] ?? 0;
      posNotional += Math.abs(qty) * m;
    }
    return {
      cashUsdt: this.paper.cash,
      equityUsdt: this.paper.cash + posNotional,
      positions: { ...this.paper.positions },
      marks,
    };
  }

  // ─────────── internals ───────────

  private executePaper(order: Order, price: number): Fill {
    const qty = order.sizeIsQuote ? order.size / Math.max(price, 1e-9) : order.size;
    const sideSign = order.side === 'buy' ? 1 : -1;
    const cur = this.paper.positions[order.symbol] ?? 0;
    const next = cur + sideSign * qty;
    const fill: Fill = {
      symbol: order.symbol,
      side: order.side,
      qty,
      price,
      fee: qty * price * 0.0006,
      feeCurrency: 'USDT',
      ts: Date.now(),
      venue: this.venue,
    };
    this.paper.positions[order.symbol] = next;
    this.paper.cash -= sideSign * qty * price + fill.fee!;
    this.paper.fills.push(fill);
    return fill;
  }

  private toBitgetArgs(o: Order): Record<string, unknown> {
    return {
      symbol: o.symbol,
      side: o.side,
      orderType: o.type,
      price: o.price,
      size: o.size,
      sizeIsQuote: o.sizeIsQuote ?? false,
      leverage: o.leverage,
      reduceOnly: o.reduceOnly ?? false,
      clientOrderId: o.clientOrderId,
    };
  }

  private rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.proc) throw new Error('mcp server not started');
    const id = this.nextRpcId++;
    const req: McpRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, (resp) => {
        if (resp.error) reject(new Error(resp.error.message));
        else resolve(resp.result);
      });
      this.proc!.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  private onStdout(text: string): void {
    // very small JSON-RPC line parser (assumes one JSON object per line)
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const resp = JSON.parse(line) as McpResponse;
        const cb = this.pending.get(resp.id);
        if (cb) {
          this.pending.delete(resp.id);
          cb(resp);
        }
      } catch {
        // ignore non-JSON lines (notifications etc.)
      }
    }
  }
}

/** Helper: subscribe to fills published by any adapter on a given topic. */
export function onFill(
  bus: AgentBus,
  topic: string,
  cb: (fill: BusMessage<Fill>) => void,
): string {
  return bus.subscribe<Fill>(topic, cb as never, { kinds: ['fill'] });
}
