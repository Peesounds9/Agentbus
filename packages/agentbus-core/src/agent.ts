/**
 * Agent — a thin lifecycle wrapper around an AgentBus subscription.
 *
 * Agents declare:
 *   - id (so other agents can trace who said what)
 *   - topics they listen on (with optional kind filter)
 *   - a handler
 *
 * The agent emits heartbeats every `heartbeatMs` (default 5000ms) to the
 * topic `heartbeat.<agentId>` so the rest of the system can detect silence.
 */

import { nanoid } from 'nanoid';
import { AgentBus } from './bus.js';
import { BusMessage, Heartbeat } from './types.js';

export interface AgentOptions<T = unknown> {
  id?: string;
  bus: AgentBus;
  pattern: string;
  kinds?: AgentBus extends never ? never : Parameters<AgentBus['subscribe']>[2] extends infer O
    ? O extends { kinds?: infer K }
      ? K
      : never
    : never;
  handler: (msg: BusMessage<T>, agent: Agent) => void | Promise<void>;
  heartbeatMs?: number;
  /** Auto-publish heartbeat on startup. */
  announce?: boolean;
}

export class Agent {
  readonly id: string;
  readonly bus: AgentBus;
  readonly startedAt: number;
  private subId?: string;
  private hb?: NodeJS.Timeout;
  private stopped = false;
  private _status: Heartbeat['status'] = 'idle';

  constructor(opts: { id?: string; bus: AgentBus } & Pick<AgentOptions, 'heartbeatMs'>) {
    this.id = opts.id ?? `agent_${nanoid(6)}`;
    this.bus = opts.bus;
    this.startedAt = Date.now();
  }

  get status(): Heartbeat['status'] {
    return this._status;
  }

  get uptimeMs(): number {
    return Date.now() - this.startedAt;
  }

  setStatus(s: Heartbeat['status']): void {
    this._status = s;
  }

  /** Begin consuming messages matching `pattern`. */
  start<T>(opts: Omit<AgentOptions<T>, 'id' | 'bus'>): this {
    if (this.subId) throw new Error(`agent ${this.id} already started`);
    this.subId = this.bus.subscribe<T>(
      opts.pattern,
      async (msg) => {
        this.setStatus('working');
        try {
          await opts.handler(msg, this as unknown as Agent);
        } finally {
          this.setStatus('idle');
        }
      },
      { kinds: opts.kinds, replayHistory: false },
    );
    const interval = opts.heartbeatMs ?? 5000;
    this.hb = setInterval(() => this.emitHeartbeat(), interval);
    if (typeof this.hb.unref === 'function') this.hb.unref();
    if (opts.announce !== false) this.emitHeartbeat();
    return this;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.subId) this.bus.unsubscribe(this.subId);
    if (this.hb) clearInterval(this.hb);
  }

  /** Publish a message as this agent. */
  publish<T>(
    topic: string,
    kind: import('./types.js').MessageKind,
    payload: T,
    extra: Parameters<AgentBus['publish']>[3] = { from: this.id },
  ): string {
    return this.bus.publish(topic, kind, payload, { ...extra, from: this.id });
  }

  /** Reply to a received message, preserving correlation/causation. */
  reply<T>(
    inbound: BusMessage,
    topic: string,
    kind: import('./types.js').MessageKind,
    payload: T,
    extras: Partial<Parameters<AgentBus['publish']>[3]> = {},
  ): string {
    return this.publish(topic, kind, payload, {
      ...extras,
      from: this.id,
      correlationId: inbound.correlationId,
      causationId: inbound.id,
    });
  }

  private emitHeartbeat(): void {
    const hb: Heartbeat = {
      agentId: this.id,
      status: this._status,
      uptimeMs: this.uptimeMs,
    };
    this.bus.publish(`heartbeat.${this.id}`, 'heartbeat', hb, { from: this.id });
  }
}
