/**
 * Redis-backed BusTransport.
 *
 * Use when the bus needs to span processes / machines. Falls back to
 * in-process if `ioredis` is not installed (the loader in
 * transport.ts handles that).
 *
 * Two channels per bus:
 *   - `agentbus:<busId>:publish`  — fan-out of published messages
 *   - `agentbus:<busId>:hello`    — bus-id announcement (presence)
 *
 * Optional persistence: messages are also `RPUSH`'d onto a per-bus
 * stream (`agentbus:<busId>:log`, capped via `LTRIM`) so new joiners
 * can replay history just like in-process mode.
 */

import type Redis from 'ioredis';
import type { BusTransport } from './transport.js';
import { decode, encode, encodeHello } from './transport.js';
import type { AgentBus } from './bus.js';
import type { BusMessage } from './types.js';

export interface RedisTransportOptions {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  /** Persist messages to a per-bus stream so new joiners replay. */
  persist?: boolean;
  /** Max stream length when persist=true. */
  historySize?: number;
  /** Channel prefix. Default "agentbus". */
  prefix?: string;
}

export class RedisTransport implements BusTransport {
  readonly id: string;
  private readonly opts: Required<Pick<RedisTransportOptions, 'prefix' | 'historySize'>> & {
    url?: string; host?: string; port?: number; password?: string; persist: boolean;
  };
  private pub: Redis;
  private sub: Redis;
  private bus?: AgentBus;
  private sent = 0;
  private received = 0;
  private helloTimer?: NodeJS.Timeout;

  constructor(opts: RedisTransportOptions = {}) {
    const id = `redis_${Math.random().toString(36).slice(2, 8)}`;
    this.id = id;
    this.opts = {
      url: opts.url,
      host: opts.host,
      port: opts.port,
      password: opts.password,
      persist: opts.persist ?? true,
      historySize: opts.historySize ?? 5_000,
      prefix: opts.prefix ?? 'agentbus',
    };

    // Dynamic import so the package is optional
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require('ioredis');
    const sub: Redis = this.opts.url
      ? new IORedis(this.opts.url)
      : new IORedis({
          host: this.opts.host,
          port: this.opts.port,
          password: this.opts.password,
        });
    const pub: Redis = this.opts.url
      ? new IORedis(this.opts.url)
      : new IORedis({
          host: this.opts.host,
          port: this.opts.port,
          password: this.opts.password,
        });
    this.sub = sub;
    this.pub = pub;
  }

  async start(bus: AgentBus): Promise<void> {
    this.bus = bus;
    const channel = this.channel('publish');
    await this.sub.subscribe(channel);
    this.sub.on('message', (_ch: string, raw: string) => {
      const wire = decode(raw);
      if (!wire || wire.type !== 'publish') return;
      this.received++;
      // Re-inject into the local bus, but mark from a synthetic peer id so
      // we don't loop. We skip persistence on the re-injected message
      // because the Redis log already has it.
      bus.publish(wire.msg.topic, wire.msg.kind, wire.msg.payload, {
        from: wire.msg.from.startsWith('redis:') ? wire.msg.from : `redis:${wire.msg.from}`,
        correlationId: wire.msg.correlationId,
        causationId: wire.msg.causationId,
        metadata: { ...(wire.msg.metadata ?? {}), via: this.id },
      });
    });
    // Announce ourselves so peers see us in `inspect()`
    await this.pub.publish(this.channel('hello'), encodeHello(bus.id));
    this.helloTimer = setInterval(() => {
      this.pub.publish(this.channel('hello'), encodeHello(bus.id)).catch(() => undefined);
    }, 5_000);
    if (typeof this.helloTimer.unref === 'function') this.helloTimer.unref();

    // Replay history if persistence is on
    if (this.opts.persist) {
      const log = this.logKey();
      const items = await this.sub.lrange(log, -this.opts.historySize, -1);
      for (const raw of items) {
        const wire = decode(raw);
        if (wire?.type !== 'publish') continue;
        bus.publish(wire.msg.topic, wire.msg.kind, wire.msg.payload, {
          from: wire.msg.from,
          correlationId: wire.msg.correlationId,
          causationId: wire.msg.causationId,
        });
      }
    }
  }

  async send(msg: BusMessage): Promise<void> {
    const raw = encode(msg);
    await this.pub.publish(this.channel('publish'), raw);
    if (this.opts.persist) {
      const log = this.logKey();
      await this.pub.rpush(log, raw);
      await this.pub.ltrim(log, -this.opts.historySize, -1);
    }
    this.sent++;
  }

  async stop(): Promise<void> {
    if (this.helloTimer) clearInterval(this.helloTimer);
    try {
      await this.sub.unsubscribe();
    } catch {
      /* ignore */
    }
    this.sub.disconnect();
    this.pub.disconnect();
  }

  stats(): Record<string, unknown> {
    return {
      kind: 'redis',
      sent: this.sent,
      received: this.received,
      prefix: this.opts.prefix,
      persist: this.opts.persist,
    };
  }

  private channel(name: string): string {
    const busId = this.bus?.id ?? 'global';
    return `${this.opts.prefix}:${busId}:${name}`;
  }

  private logKey(): string {
    const busId = this.bus?.id ?? 'global';
    return `${this.opts.prefix}:${busId}:log`;
  }
}
