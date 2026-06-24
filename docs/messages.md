# Message Kinds & Topic Conventions

## Canonical kinds

The AgentBus core registers these built-in kinds (extensible via
`bus.registerKind`):

| Kind | Producer | Consumer(s) | Notes |
|---|---|---|---|
| `signal` | researcher | strategist | Short-horizon directional view |
| `thesis` | strategist | risk-manager | Full setup with stop / target / invalidation |
| `plan` | strategist | risk-manager | Executable handoff |
| `risk_check` | risk-manager | anyone (audit) | Verdict on a plan |
| `risk_alert` | risk-manager | anyone (audit, executor) | Critical — may include `flatten` action |
| `order` | risk-manager / executor | executor | Approved order to submit |
| `order_update` | bitget-adapter | anyone (audit) | new / partial / filled / cancelled / rejected |
| `fill` | bitget-adapter | risk-manager, recorder | One fill event |
| `metric` | any | dashboard | PnL, drawdown, exposure, winrate, etc. |
| `log` | any | recorder | Free-form log |
| `heartbeat` | every agent | risk-manager (watchdog) | Liveness proof |
| `macro`, `sentiment`, `news`, `onchain` | any | researcher | Perception inputs |

## Topic patterns

Topics are dot-separated. Wildcards:

- `*` matches exactly one segment (`signal.*` matches `signal.btc` but not `signal.btc.usdt`)
- `>` matches one or more trailing segments (`signal.>` matches both)

Recommended conventions:

```
tick.<source>                  # raw perception: tick.macro, tick.news, tick.onchain
signal.<symbol_lower>          # signal.btc, signal.eth
thesis.<symbol_lower>          # thesis.btc
plan.futures                   # actionable plans on futures
plan.spot                      # actionable plans on spot
order.bitget.futures           # orders to Bitget futures
order.bitget.spot              # orders to Bitget spot
risk_check                     # all verdicts
risk_alert                     # all alerts
heartbeat.<agent_id>           # per-agent liveness
metric.<name>                  # tagged metrics
fill                           # all fills (one topic — symbol in payload)
order_update                   # all order updates (one topic — symbol in payload)
```

## Tracing fields

Every message has:

```ts
{
  id: string;          // unique
  ts: number;          // wall-clock ms
  topic: string;
  kind: MessageKind;
  from: string;        // agent id
  correlationId?: string;  // workflow group
  causationId?: string;    // direct parent message
  payload: unknown;
  metadata?: Record<string, string>;
  expiresAt?: number;
}
```

To reconstruct a session as a DAG, draw edges from `causationId → id`.

## Examples

### Manual signal

```ts
bus.publish('signal.btc', 'signal', {
  symbol: 'BTCUSDT',
  direction: 'long',
  confidence: 0.8,
  horizon: 'intraday',
  rationale: 'macro risk-on + on-chain whale buy',
  ttlMs: 30 * 60_000,
}, { from: 'human', correlationId: 'wf-42' });
```

### Risk rejection → alert

```ts
bus.publish('risk_alert', 'risk_alert', {
  severity: 'warn',
  scope: 'symbol',
  symbol: 'BTCUSDT',
  message: 'order shrunk 70% to fit per-symbol cap',
  action: 'none',
}, { from: 'risk-manager', correlationId: 'wf-42', causationId: plan.id });
```

### Watchdog

```ts
bus.subscribe('heartbeat.>', (m) => {
  lastSeen.set(m.payload.agentId, m.ts);
}, { kinds: ['heartbeat'] });
```
