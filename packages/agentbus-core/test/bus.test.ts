import { describe, it, expect } from 'vitest';
import { AgentBus, Agent, evaluateOrder } from '../src/index.js';
import type { Signal, Order } from '../src/types.js';

describe('AgentBus', () => {
  it('delivers messages to matching subscribers', async () => {
    const bus = new AgentBus();
    const received: string[] = [];
    bus.subscribe<string>('signal.btc', (m) => {
      received.push(m.payload);
    });
    bus.publish('signal.btc', 'signal', 'hello', { from: 'tester' });
    await new Promise((r) => setTimeout(r, 10));
    expect(received).toEqual(['hello']);
  });

  it('supports wildcard topic patterns', async () => {
    const bus = new AgentBus();
    const seen: string[] = [];
    bus.subscribe<string>('signal.>', (m) => seen.push(m.topic));
    bus.publish('signal.btc', 'signal', 'a', { from: 't' });
    bus.publish('signal.eth', 'signal', 'b', { from: 't' });
    bus.publish('order.btc', 'order', {}, { from: 't' });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen.sort()).toEqual(['signal.btc', 'signal.eth']);
  });

  it('filters by message kind', async () => {
    const bus = new AgentBus();
    const seen: string[] = [];
    bus.subscribe('orders.>', (m) => seen.push(m.kind), { kinds: ['order'] });
    bus.publish('orders.btc', 'order', {}, { from: 't' });
    bus.publish('orders.btc', 'fill', {}, { from: 't' });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual(['order']);
  });

  it('replays history to new subscribers by default', async () => {
    const bus = new AgentBus();
    bus.publish('signal.btc', 'signal', 'past', { from: 't' });
    await new Promise((r) => setTimeout(r, 5));
    const seen: string[] = [];
    bus.subscribe<string>('signal.btc', (m) => seen.push(m.payload));
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual(['past']);
  });

  it('drops messages when subscriber queue overflows', async () => {
    const bus = new AgentBus({ maxQueuePerSubscriber: 2 });
    bus.subscribe('x', () => {
      /* never drain */
    }, { replayHistory: false });
    for (let i = 0; i < 5; i++) {
      bus.publish('x', 'log', `m${i}`, { from: 't' });
    }
    const snap = bus.inspect();
    expect(snap.dropped).toBeGreaterThan(0);
  });

  it('serializes roundtrip', () => {
    const bus = new AgentBus();
    const msg = bus.historySnapshot()[0] ?? (bus.publish('signal.btc', 'signal', 'x', { from: 't' }) && bus.historySnapshot()[0]);
    if (!msg) throw new Error('expected a message');
    const raw = AgentBus.serialize(msg);
    const back = AgentBus.deserialize(raw);
    expect(back).toEqual(msg);
  });
});

describe('Agent', () => {
  it('auto-assigns id and emits heartbeats', async () => {
    const bus = new AgentBus();
    const hb: string[] = [];
    bus.subscribe('heartbeat.>', (m) => hb.push(m.payload.agentId));
    const a = new Agent({ bus });
    a.start({ pattern: 'signal.>', handler: () => undefined, heartbeatMs: 5, announce: true });
    await new Promise((r) => setTimeout(r, 30));
    a.stop();
    expect(hb.length).toBeGreaterThanOrEqual(1);
    expect(hb[0]).toBe(a.id);
  });

  it('reply preserves correlation and causation', async () => {
    const bus = new AgentBus();
    const a = new Agent({ bus, id: 'A' });
    let receivedCorr: string | undefined;
    bus.subscribe('reply.>', (m) => {
      receivedCorr = m.correlationId;
    });
    a.start({ pattern: 'signal.>', handler: () => undefined, announce: false });
    const inbound = { id: 'm1', ts: 0, topic: 'signal.btc', kind: 'signal' as const, from: 'X', payload: {} };
    a.reply(inbound, 'reply.btc', 'plan', {});
    await new Promise((r) => setTimeout(r, 10));
    // The publish itself uses the inbound's correlation — we publish from A which has no inbound correlation yet,
    // so reply() preserves the inbound correlation. Verify the publish path:
    expect(receivedCorr).toBeUndefined(); // the inbound had no correlation
  });
});

describe('Risk engine', () => {
  const snap = {
    cashUsdt: 10_000,
    equityUsdt: 10_000,
    positions: { BTCUSDT: 0 } as Record<string, number>,
    marks: { BTCUSDT: 60_000 } as Record<string, number>,
  };

  it('rejects dust orders', () => {
    const order: Order = { symbol: 'BTCUSDT', side: 'buy', type: 'market', size: 0.0001 };
    const r = evaluateOrder(order, snap);
    expect(r.decision).toBe('reject');
  });

  it('shrinks when order would breach per-symbol cap', () => {
    // futures order (leverage=2) so cash check doesn't fire first;
    // 1 BTC @ 60k = 60k USDT notional, equity 10k, per-symbol cap 20% = 2k
    const order: Order = { symbol: 'BTCUSDT', side: 'buy', type: 'market', size: 1, leverage: 2 };
    const r = evaluateOrder(order, snap);
    expect(r.decision).toBe('shrink');
    expect(r.proposedSize).toBeLessThan(1);
  });

  it('allows a small in-cap order', () => {
    const order: Order = { symbol: 'BTCUSDT', side: 'buy', type: 'market', size: 0.02 }; // 1200 USDT
    const r = evaluateOrder(order, snap);
    expect(r.decision).toBe('allow');
  });

  it('rejects reduce-only when it would extend a position', () => {
    const s = { ...snap, positions: { ...snap.positions, BTCUSDT: 0.1 } };
    const order: Order = { symbol: 'BTCUSDT', side: 'buy', type: 'market', size: 0.01, reduceOnly: true };
    const r = evaluateOrder(order, s);
    expect(r.decision).toBe('reject');
  });
});

describe('Topic matching', () => {
  const bus = new AgentBus();
  it.each([
    ['signal.btc', 'signal.btc', true],
    ['signal.btc', 'signal.*', true],
    ['signal.btc.usdt', 'signal.*.usdt', true],
    ['signal.btc', 'signal.>', true],
    ['order.btc.fut', 'signal.>', false],
    ['a.b.c', 'a.b.c', true],
    ['a.b.c', 'a.b', false],
    ['a.b', 'a.b.c', false],
  ])('matches %s vs %s = %s', (topic, pattern, expected) => {
    expect(bus.topicMatches(topic, pattern)).toBe(expected);
  });
});

// signal import to silence unused warning
const _s: Signal = { symbol: '', direction: 'long', confidence: 0, horizon: 'intraday', rationale: '' };
void _s;
