/**
 * AgentBus — the central pub/sub bus.
 *
 * Pure in-process by default; the same instance can be used across multiple
 * agents running in one process. For cross-process / cross-machine traffic
 * the wire format is JSON (see {@link serialize} / {@link deserialize}) and
 * a transport (stdio, websocket, http) can be plugged in via
 * {@link AgentBus.attachTransport}.
 *
 * Design principles:
 *   - Topic strings are dot-separated, wildcards supported (`*`, `>`)
 *   - Every message has a typed `kind` and a `payload` of matching shape
 *   - Every message carries tracing fields (`correlationId`, `causationId`)
 *   - Subscribers can be sync or async; backpressure is per-subscriber queue
 *   - Optional persistence replays missed messages on subscribe
 */

import { nanoid } from 'nanoid';
import {
  BusMessage,
  Handler,
  MessageKind,
  OrderUpdate,
  Fill,
} from './types.js';
import type { BusTransport } from './transport.js';

export interface AgentBusOptions {
  /** When true, the bus keeps an in-memory ring buffer of recent messages. */
  persist?: boolean;
  /** Ring buffer size (only relevant when persist=true). */
  historySize?: number;
  /** Per-subscriber queue cap; messages beyond this are dropped with a warning. */
  maxQueuePerSubscriber?: number;
  /** Optional clock override for testing. */
  now?: () => number;
}

interface Subscriber {
  id: string;
  pattern: string;
  kinds?: Set<MessageKind>;
  handler: Handler;
  queue: BusMessage[];
  draining: boolean;
  meta?: Record<string, unknown>;
}

export class AgentBus {
  readonly id: string;
  readonly createdAt: number;
  private readonly opts: Required<AgentBusOptions>;
  private readonly subscribers = new Map<string, Subscriber>();
  private readonly history: BusMessage[] = [];
  private readonly transports = new Set<BusTransport>();
  private readonly registeredKinds = new Set<MessageKind>();
  private dropped = 0;

  constructor(opts: AgentBusOptions = {}) {
    this.id = nanoid(10);
    this.createdAt = (opts.now ?? Date.now)();
    this.opts = {
      persist: opts.persist ?? true,
      historySize: opts.historySize ?? 5000,
      maxQueuePerSubscriber: opts.maxQueuePerSubscriber ?? 1024,
      now: opts.now ?? Date.now,
    };
  }

  /** Register a custom message kind so other agents can rely on it. */
  registerKind(kind: MessageKind): void {
    this.registeredKinds.add(kind);
  }

  /** Attach a typed {@link BusTransport}. The bus will call start/stop and
   *  forward every published message through {@link BusTransport.send}.
   */
  attachTransport(t: BusTransport): void {
    this.transports.add(t);
    t.start(this);
  }

  detachTransport(t: BusTransport): void {
    if (this.transports.delete(t)) {
      void t.stop();
    }
  }

  /**
   * Publish a typed message.
   * @returns the assigned message id
   */
  publish<T>(
    topic: string,
    kind: MessageKind,
    payload: T,
    opts: {
      from: string;
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, string>;
      expiresAt?: number;
    },
  ): string {
    const msg: BusMessage<T> = {
      id: nanoid(12),
      ts: this.opts.now(),
      topic,
      kind,
      payload,
      from: opts.from,
      correlationId: opts.correlationId,
      causationId: opts.causationId,
      metadata: opts.metadata,
      expiresAt: opts.expiresAt,
    };
    this.dispatch(msg);
    return msg.id;
  }

  /** Subscribe to a topic. Pattern supports `*` (one segment) and `>` (trailing). */
  subscribe<T = unknown>(
    pattern: string,
    handler: Handler<T>,
    opts: { kinds?: MessageKind[]; replayHistory?: boolean; meta?: Record<string, unknown> } = {},
  ): string {
    const id = nanoid(8);
    const sub: Subscriber = {
      id,
      pattern,
      handler: handler as Handler,
      kinds: opts.kinds ? new Set(opts.kinds) : undefined,
      queue: [],
      draining: false,
      meta: opts.meta,
    };
    this.subscribers.set(id, sub);
    if (opts.replayHistory !== false && this.opts.persist) {
      // Replay matching history items (most recent first backwards)
      for (let i = this.history.length - 1; i >= 0; i--) {
        const h = this.history[i]!;
        if (this.matches(h, sub)) sub.queue.unshift(h);
        if (sub.queue.length >= this.opts.maxQueuePerSubscriber) break;
      }
      // Drain queued replays async
      queueMicrotask(() => this.drain(sub));
    }
    return id;
  }

  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  /** Inspect history (snapshot, safe to iterate). */
  historySnapshot(filter?: { topic?: string; kind?: MessageKind; limit?: number }): BusMessage[] {
    let out = this.history.slice();
    if (filter?.topic) out = out.filter((m) => this.topicMatches(m.topic, filter.topic!));
    if (filter?.kind) out = out.filter((m) => m.kind === filter.kind);
    if (filter?.limit) out = out.slice(-filter.limit);
    return out;
  }

  /** Diagnostics: list subscribers + counters. */
  inspect(): {
    id: string;
    subscribers: number;
    historySize: number;
    dropped: number;
    transports: number;
    queues: Array<{ id: string; pattern: string; depth: number }>;
    transportStats: Array<{ id: string; stats: Record<string, unknown> }>;
  } {
    return {
      id: this.id,
      subscribers: this.subscribers.size,
      historySize: this.history.length,
      dropped: this.dropped,
      transports: this.transports.size,
      queues: Array.from(this.subscribers.values()).map((s) => ({
        id: s.id,
        pattern: s.pattern,
        depth: s.queue.length,
      })),
      transportStats: Array.from(this.transports).map((t) => ({ id: t.id, stats: t.stats() })),
    };
  }

  /** Serialize a message for wire transport. */
  static serialize(msg: BusMessage): string {
    return JSON.stringify(msg);
  }

  /** Deserialize a message from wire transport. */
  static deserialize(raw: string): BusMessage {
    return JSON.parse(raw) as BusMessage;
  }

  // ─────────────────────────── internals ───────────────────────────

  private dispatch(msg: BusMessage): void {
    if (msg.expiresAt && msg.expiresAt < msg.ts) return;

    if (this.opts.persist) {
      this.history.push(msg);
      if (this.history.length > this.opts.historySize) {
        this.history.splice(0, this.history.length - this.opts.historySize);
      }
    }

    for (const sub of this.subscribers.values()) {
      if (!this.matches(msg, sub)) continue;
      sub.queue.push(msg);
      if (sub.queue.length > this.opts.maxQueuePerSubscriber) {
        this.dropped++;
        sub.queue.splice(0, sub.queue.length - this.opts.maxQueuePerSubscriber);
      }
      queueMicrotask(() => this.drain(sub));
    }

    // fan out to transports (fire and forget)
    for (const t of this.transports) {
      Promise.resolve(t.send(msg)).catch(() => undefined);
    }
  }

  private async drain(sub: Subscriber): Promise<void> {
    if (sub.draining) return;
    sub.draining = true;
    try {
      while (sub.queue.length) {
        const m = sub.queue.shift()!;
        try {
          await sub.handler(m);
        } catch (err) {
          // Don't let one bad subscriber poison the queue
          // (in production: push to a dead-letter topic)
          // eslint-disable-next-line no-console
          console.error(`[agentbus] subscriber ${sub.id} error:`, err);
        }
      }
    } finally {
      sub.draining = false;
    }
  }

  private matches(msg: BusMessage, sub: Subscriber): boolean {
    if (sub.kinds && !sub.kinds.has(msg.kind)) return false;
    return this.topicMatches(msg.topic, sub.pattern);
  }

  /** Wildcard match: `*` matches one segment, `>` matches one or more trailing segments. */
  topicMatches(topic: string, pattern: string): boolean {
    if (pattern === '>') return true;
    if (pattern === topic) return true;
    const t = topic.split('.');
    const p = pattern.split('.');
    for (let i = 0; i < p.length; i++) {
      const seg = p[i]!;
      if (seg === '>') return true;
      if (seg === '*') {
        if (t[i] === undefined) return false;
        continue;
      }
      if (seg !== t[i]) return false;
    }
    return t.length === p.length;
  }
}

/** Re-export message shapes that callers commonly need at runtime. */
export type { OrderUpdate, Fill };
