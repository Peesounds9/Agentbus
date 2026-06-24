import { describe, it, expect } from 'vitest';
import { AgentBus } from 'agentbus-core';
import { BitgetAdapter } from '../src/index.js';
import type { Fill, OrderUpdate } from 'agentbus-core';

describe('BitgetAdapter (paper)', () => {
  it('executes a paper market buy and emits fill + order_update', async () => {
    const bus = new AgentBus();
    const fills: Fill[] = [];
    const updates: OrderUpdate[] = [];
    bus.subscribe<Fill>('order.bitget.>', (m) => fills.push(m.payload), { kinds: ['fill'] });
    bus.subscribe<OrderUpdate>('order.bitget.>', (m) => updates.push(m.payload), { kinds: ['order_update'] });

    const adapter = new BitgetAdapter({ bus, mode: 'paper', paperCashUsdt: 10_000 });
    await adapter.submitOrder(
      { symbol: 'BTCUSDT', side: 'buy', type: 'market', size: 0.01 },
      60_000,
    );
    await new Promise((r) => setTimeout(r, 30));

    expect(fills.length).toBe(1);
    expect(updates.find((u) => u.status === 'filled')).toBeTruthy();
    const snap = adapter.snapshot({ BTCUSDT: 60_000 });
    expect(snap.positions.BTCUSDT).toBeCloseTo(0.01, 8);
    expect(snap.cashUsdt).toBeLessThan(10_000); // paid for the BTC + fee
  });

  it('short selling reduces cash and opens a negative position', async () => {
    const bus = new AgentBus();
    const adapter = new BitgetAdapter({ bus, mode: 'paper', paperCashUsdt: 10_000 });
    await adapter.submitOrder({ symbol: 'ETHUSDT', side: 'sell', type: 'market', size: 1 }, 3_000);
    await new Promise((r) => setTimeout(r, 10));
    const snap = adapter.snapshot({ ETHUSDT: 3_100 });
    expect(snap.positions.ETHUSDT).toBeCloseTo(-1, 8);
    // Cash should increase (proceeds of the short) net of fee
    expect(snap.cashUsdt).toBeGreaterThan(7_000);
  });
});
