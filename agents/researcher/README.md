# @agentbus/researcher

Reference agent: converts raw perception events (macro / sentiment / news / onchain)
into actionable `signal` messages.

In production, call out to Bitget's Skill Hub (macro-analyst, sentiment-analyst,
technical-analysis, market-intel, news-briefing). In this reference impl we
apply a simple bias table so the demo runs without external skills.

## Usage

```ts
import { AgentBus } from 'agentbus-core';
import { startResearcher } from 'agentbus-researcher';

const bus = new AgentBus();
const researcher = startResearcher({
  bus,
  watchlist: ['BTCUSDT', 'ETHUSDT'],
});
```

The agent listens on `tick.>` for `macro`, `sentiment`, `news`, `onchain`
messages and emits one signal per watchlist symbol.
