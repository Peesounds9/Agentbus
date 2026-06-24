/**
 * BusTransport — pluggable cross-process delivery for AgentBus.
 *
 * The default {@link InProcessTransport} runs entirely in-memory and has
 * zero dependencies. When the bus needs to span processes / machines, a
 * different transport (Redis, WebSocket, HTTP SSE, …) can be attached
 * via {@link AgentBus.attachTransport}.
 *
 * Wire protocol (JSON over a newline-delimited stream):
 *
 *   {"type":"publish","msg":{...BusMessage...}}\n
 *   {"type":"subscribe","pattern":"signal.>","subId":"..."}\n
 *   {"type":"unsubscribe","subId":"..."}\n
 *
 * The wire envelope is intentionally tiny so transports stay cheap.
 */

import { AgentBus } from './bus.js';
import type { BusMessage } from './types.js';

export interface WirePublish {
  type: 'publish';
  msg: BusMessage;
}
export interface WireSubscribe {
  type: 'subscribe';
  pattern: string;
  subId: string;
}
export interface WireUnsubscribe {
  type: 'unsubscribe';
  subId: string;
}
export interface WireHello {
  type: 'hello';
  busId: string;
  ts: number;
}
export type Wire = WirePublish | WireSubscribe | WireUnsubscribe | WireHello;

export interface BusTransport {
  /** Unique transport id (so the same bus can fan out to many transports). */
  readonly id: string;
  /** Begin listening / producing. */
  start(bus: AgentBus): Promise<void> | void;
  /** Send a published message to the other side. */
  send(msg: BusMessage): Promise<void> | void;
  /** Stop the transport cleanly. */
  stop(): Promise<void> | void;
  /** Diagnostic stats — surfaced in bus.inspect(). */
  stats(): Record<string, unknown>;
}

/**
 * No-op transport for the default in-process bus. Useful as a base class.
 */
export class InProcessTransport implements BusTransport {
  readonly id = `inproc_${Math.random().toString(36).slice(2, 8)}`;
  private sent = 0;
  start(): void {
    /* nothing */
  }
  async send(): Promise<void> {
    this.sent++;
  }
  async stop(): Promise<void> {
    /* nothing */
  }
  stats(): Record<string, unknown> {
    return { kind: 'in-process', sent: this.sent };
  }
}

/**
 * Encode / decode helpers — shared by all transports so they speak the
 * same wire format.
 */
export const encode = (msg: BusMessage): string => JSON.stringify({ type: 'publish', msg });
export const encodeHello = (busId: string): string =>
  JSON.stringify({ type: 'hello', busId, ts: Date.now() });
export const decode = (line: string): Wire | null => {
  try {
    const j = JSON.parse(line) as Wire;
    if (j && typeof j === 'object' && 'type' in j) return j;
    return null;
  } catch {
    return null;
  }
};

/**
 * Lazy loader for the Redis transport. Returns null if `ioredis` is not
 * installed, so callers can degrade gracefully.
 */
export async function tryLoadRedisTransport(
  opts: import('./transport-redis.js').RedisTransportOptions,
): Promise<BusTransport | null> {
  try {
    const mod = await import('./transport-redis.js');
    return new mod.RedisTransport(opts);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw err;
  }
}
