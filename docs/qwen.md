# Qwen Classifier — wiring details

The classifier agent sits between any signal producer and any signal
consumer. It calls `qwen3.6-plus` via the Bitget hackathon proxy and asks
the model to score + filter each signal.

## Endpoint

The hackathon brief specifies:

| Setting | Value |
|---|---|
| Base URL | `https://hackathon.bitgetops.com/v1` |
| Model | `qwen3.6-plus` (fast: `qwen3.6-flash`) |
| Env var | `BITGET_QWEN_API_KEY` |
| Compat | OpenAI Chat Completions |

The classifier posts to `${endpoint}/chat/completions` with:

```json
{
  "model": "qwen3.6-plus",
  "messages": [
    { "role": "system", "content": "<rubric — see source>" },
    { "role": "user", "content": "<serialized Signal JSON>" }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.1
}
```

The model is expected to return:

```json
{ "score": 0.0..1.0, "reason": "<=140 chars", "drop": false }
```

## Rubric (system prompt)

```
You are a quality-control filter for crypto trading signals on AgentBus.
Score 0..1 on quality and decide if it should pass.

Strong signal (0.7-1.0):
  - Rationale cites specific data (price level, indicator reading, on-chain metric).
  - Direction is internally consistent with the rationale.
  - Confidence is calibrated — high for clear setups, low for murky.
  - Horizon is realistic for the signal type.

Weak signal (0.4-0.6):
  - Rationale is generic ("market is bullish") without specific data.
  - Confidence does not match the depth of the rationale.

Noise (< 0.4):
  - Empty rationale, contradictory direction, or obvious duplicate of another.

Output strict JSON only:
{"score": 0.0, "reason": "<=140 chars", "drop": false}
```

## Fallback behaviour

If the env var is missing, the classifier uses a **heuristic** so the demo
never blocks:

```
score = 0.5
if rationale.length > 60 → +0.2
if rationale.length > 120 → +0.1
if symbol present → +0.1
if rationale is empty → drop
if rationale.length < 30 and confidence > 0.7 → -0.2
drop if score < 0.4
```

If the call fails (timeout, 5xx, network), the heuristic kicks in for that
one message and a warning is logged.

## Outputs

| Topic | Kind | When |
|---|---|---|
| `signal.scored` | `signal` | Signal accepted, enriched with `quality`, `sourceFrom`, `sourceCorrelationId` |
| `signal.noise` | `log` | Signal rejected; payload `{ signal, reason, score }` |

Subscribers can pattern-match:

- `signal.scored` (exact) — only the freshly scored ones
- `signal.scored.*` — symbol-tagged (future)
- `signal.noise` (exact) — only the rejected ones

## Anti-loop guard

The classifier subscribes to `signal.raw.>` (only *raw* signals). It also
explicitly drops messages with `from === classifier.agent.id` or
`from.endsWith(':classifier')` so it never re-scores its own output. This
prevents the infinite-loop failure mode where a published output would
match its own subscription.

## Customizing

```ts
import { startClassifier } from 'agentbus-classifier';

const c = startClassifier({
  bus,
  endpoint: process.env.QWEN_ENDPOINT,
  model: 'qwen3.6-flash',   // faster, slightly less accurate
  apiKey: process.env.BITGET_QWEN_API_KEY,
  dropThreshold: 0.5,       // stricter
  pattern: 'my.raw.signals.>',
  timeoutMs: 5_000,
});
```
