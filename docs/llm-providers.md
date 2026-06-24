# LLM provider configuration

The classifier agent calls an **OpenAI-compatible Chat Completions** API.
That covers three providers out of the box:

| Provider | Endpoint | Model | Use case |
|---|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` (cheap) or `gpt-4o` | You have an OpenAI key |
| **Bitget hackathon Qwen proxy** | `https://hackathon.bitgetops.com/v1` | `qwen3.6-plus` or `qwen3.6-flash` | You're submitting to the Bitget hackathon |
| **Any other OpenAI-compatible endpoint** | your URL | your model | Azure OpenAI, OpenRouter, Together, Groq, local llama.cpp, etc. |

## Environment variables (in priority order)

The classifier checks these env vars and picks the first one that matches:

```
# Priority 1: OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # default if unset
OPENAI_MODEL=gpt-4o-mini                   # default if unset

# Priority 2: Bitget hackathon proxy (Qwen)
BITGET_QWEN_API_KEY=sk-...
# (endpoint defaults to https://hackathon.bitgetops.com/v1)
# (model defaults to qwen3.6-plus)

# Priority 3: generic Qwen
QWEN_API_KEY=sk-...
QWEN_ENDPOINT=https://your-qwen-proxy/v1
QWEN_MODEL=qwen3.6-plus
```

If **none** of these are set, the classifier falls back to a **heuristic**
(length + symbol + confidence alignment) so the demo never blocks.

## Programmatic options

```ts
import { startClassifier } from 'agentbus-classifier';

const c = startClassifier({
  bus,
  // endpoint, model, apiKey all default from env if omitted
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
});
```

## Recommended setup for the Bitget hackathon

If you're submitting to the Bitget hackathon, use the **Qwen proxy**
because it's free for the duration of the hackathon (per the brief):

```bash
export BITGET_QWEN_API_KEY=sk-the-key-from-your-registration-email
node scripts/demo-two-agents.mjs --inject
```

## Recommended setup if you don't have a Qwen key

OpenAI's `gpt-4o-mini` is dirt cheap — the classifier makes one call per
incoming signal. For a typical demo with 5-10 signals that's well under
a cent. Just set:

```bash
export OPENAI_API_KEY=sk-your-openai-key
node scripts/demo-two-agents.mjs --inject
```

The title bar in the dashboard will say `classifier=openai` and the
verdicts will look just as good as Qwen's.

## Even cheaper: use a local Ollama server

If you don't want any API costs:

```bash
# Install Ollama + a small model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b

# Point the classifier at it
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2:3b
export OPENAI_API_KEY=ollama                    # any non-empty string works
node scripts/demo-two-agents.mjs --inject
```

The rubric prompt is small enough that even a 3B model produces usable
verdicts.

## What the model receives

The system prompt is the **scoring rubric** (see `agents/classifier/src/index.ts`).
The user message is the JSON-serialized signal:

```json
{
  "symbol": "BTCUSDT",
  "direction": "long",
  "confidence": 0.85,
  "horizon": "intraday",
  "rationale": "1h breakout above 60.2k with volume 2.3x 20-period avg",
  "sources": ["ta", "volume"],
  "ttlMs": 1800000
}
```

The model returns strict JSON:

```json
{"score": 0.82, "reason": "specific price+volume data, aligned direction", "drop": false}
```

The classifier uses `response_format: { type: "json_object" }` and
`temperature: 0.1` so responses are deterministic-ish across providers.

## On Railway

Set **either** `OPENAI_API_KEY` (or both `OPENAI_BASE_URL` + `OPENAI_MODEL`)
**or** `BITGET_QWEN_API_KEY` in Railway → Variables.

Both work; pick whichever you have a key for.
