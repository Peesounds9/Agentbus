# @agentbus/classifier

Qwen-based signal classifier. Subscribes to `signal.raw.>`, scores each
incoming signal 0..1 via an LLM, and re-publishes to either `signal.scored`
or `signal.noise`.

## LLM provider priority

1. `BITGET_QWEN_API_KEY` — Bitget hackathon Qwen proxy (recommended for the hackathon)
2. `QWEN_API_KEY` — generic Qwen-compatible endpoint
3. `OPENAI_API_KEY` — OpenAI or any OpenAI-compatible endpoint
4. (no key) — heuristic fallback

Set the matching endpoint / model via env vars:

```bash
# Bitget Qwen (default endpoint: https://hackathon.bitgetops.com/v1, model: qwen3.6-plus)
export BITGET_QWEN_API_KEY=sk-...

# OpenAI (default endpoint: https://api.openai.com/v1, model: gpt-4o-mini)
export OPENAI_API_KEY=sk-...

# OpenRouter / Azure / local Ollama
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_MODEL=meta-llama/llama-3.3-70b-instruct
export OPENAI_API_KEY=sk-or-...

# Local Ollama
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3.2
export OPENAI_API_KEY=ollama  # any non-empty string
```

## Install

```bash
pnpm add agentbus-classifier
```

## Minimal example

```ts
import { AgentBus } from 'agentbus-core';
import { startClassifier } from 'agentbus-classifier';

const bus = new AgentBus({ persist: true });
const c = startClassifier({
  bus,
  // apiKey / endpoint / model auto-discovered from env
  dropThreshold: 0.4,
});
```

## Rubric

The system prompt scores signals on:

- **Specificity** — does the rationale cite concrete data (price level, indicator, on-chain metric)?
- **Direction alignment** — is `direction` consistent with the rationale?
- **Confidence calibration** — is `confidence` calibrated to the depth of the rationale?
- **Horizon realism** — is `horizon` realistic for the signal type?

Output: `{ score: 0..1, reason: string, drop: boolean }`.

## Anti-loop guard

Subscribes to `signal.raw.>` (only raw signals) and ignores messages from
itself. Prevents infinite feedback loops if the bus pattern ever widens.

## Docs

- [`docs/qwen.md`](../../docs/qwen.md) — Qwen endpoint details
- [`docs/llm-providers.md`](../../docs/llm-providers.md) — all providers
