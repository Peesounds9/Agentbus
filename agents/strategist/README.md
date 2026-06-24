# @agentbus/strategist

Reference agent: converts `signal` messages into a `thesis` (with stop, target,
invalidation) plus an executable `plan`.

## Usage

```ts
import { AgentBus } from 'agentbus-core';
import { startStrategist } from 'agentbus-strategist';

const bus = new AgentBus();
const strategist = startStrategist({
  bus,
  atrPct: 0.02,        // 2% ATR for stop sizing
  rrTarget: 2.0,       // 2:1 reward:risk
  minConfidence: 0.55,  // ignore signals below this
});
```

The agent listens on `signal.>` and emits one `thesis` + one `plan` per
signal that crosses the confidence threshold.
