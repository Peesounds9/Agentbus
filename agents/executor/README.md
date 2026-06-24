# @agentbus/executor

Reference agent: routes approved `order` messages to the Bitget adapter and
re-publishes `fill` / `order_update` events on the bus.

The executor is intentionally dumb — no invention, no sizing, no direction.
It only routes.

## Usage

```ts
import { AgentBus } from 'agentbus-core';
import { BitgetAdapter } from 'agentbus-bitget';
import { startExecutor } from 'agentbus-executor';

const bus = new AgentBus();
const adapter = new BitgetAdapter({ bus, mode: 'paper' });

startExecutor({
  bus,
  adapter,
  // Optional: per-order refPrice lookup
  refPrice: (order) => Number(order.price ?? 60_000),
});
```
