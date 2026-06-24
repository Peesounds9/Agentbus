/**
 * Executor Agent — converts approved `order` messages into actual
 * exchange calls via the BitgetAdapter.
 *
 * The executor is intentionally dumb: it does not invent orders, does
 * not size, does not decide direction. It only routes.
 */

import { Agent, type BusMessage, type Order } from 'agentbus-core';
import { BitgetAdapter } from 'agentbus-bitget';

export interface ExecutorOptions {
  bus: import('agentbus-core').AgentBus;
  adapter: BitgetAdapter;
  pattern?: string;
  /** Function returning the reference price for a given order (default: meta or 60k). */
  refPrice?: (o: Order) => number;
}

export function startExecutor(opts: ExecutorOptions): Agent {
  const pattern = opts.pattern ?? 'order.bitget.>';
  const refPrice = opts.refPrice ?? ((o: Order) => Number(o.price ?? 60_000));
  const agent = new Agent({ bus: opts.bus, id: 'executor' });
  agent.start({
    pattern,
    kinds: ['order'],
    handler: async (msg: BusMessage<Order>) => {
      const o = msg.payload;
      try {
        await opts.adapter.submitOrder(o, refPrice(o));
      } catch (err) {
        agent.publish('order.bitget.futures', 'order_update', {
          clientOrderId: o.clientOrderId,
          symbol: o.symbol,
          status: 'rejected',
          filledQty: 0,
          reason: (err as Error).message,
        }, { from: agent.id, causationId: msg.id });
      }
    },
    announce: true,
  });
  return agent;
}
