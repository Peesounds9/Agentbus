# @agentbus/risk-manager

Reference agent: validates each `plan` against the live portfolio snapshot
and emits either an approved `order` or a `risk_alert`.

Checks performed (in order):

1. **Notional floor** — reject dust orders below the minimum USDT size.
2. **Cash available** — spot orders must be self-funded from cash.
3. **Reduce-only guard** — never widen a reduce-only order.
4. **Per-symbol cap** — shrink the order to fit the per-symbol exposure cap.
5. **Max symbols** — don't open a new symbol beyond the cap.
6. **Watchdog** — flag any agent whose heartbeats go silent for >30s.

## Usage

```ts
import { AgentBus } from 'agentbus-core';
import { startRiskManager } from 'agentbus-risk-manager';
import { BitgetAdapter } from 'agentbus-bitget';

const bus = new AgentBus();
const adapter = new BitgetAdapter({ bus, mode: 'paper' });

startRiskManager({
  bus,
  snapshot: () => adapter.snapshot({ BTCUSDT: 60_000 }),
  marks: { BTCUSDT: 60_000 },
});
```
