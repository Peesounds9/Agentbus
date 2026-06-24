/**
 * Qwen Classifier Agent
 *
 * Subscribes to `signal.>` topics and asks `qwen3.6-plus` (via the Bitget
 * hackathon proxy at https://hackathon.bitgetops.com/v1) to score each
 * incoming signal for quality. Re-publishes high-quality signals on
 * `signal.scored` and publishes `risk_alert` for low-quality / noise.
 *
 * Why this exists: in a real multi-agent setup the bus gets noisy fast —
 * the same breakout signal may fire from three different agents at once,
 * with slightly different confidence numbers. This classifier collapses
 * the noise into a single quality score per signal.
 *
 * Scoring rubric (in the prompt):
 *   - Does the rationale reference concrete data (price level, indicator,
 *     on-chain metric)?
 *   - Is the direction internally consistent with the rationale?
 *   - Is the confidence calibrated (high for clear setups, low for murky)?
 *   - Is the horizon realistic for the signal type?
 *
 * The model returns JSON: { score: 0..1, reason: string, drop: boolean }
 * Drop means the signal is rejected outright (noise, duplicate, spam).
 */

import { Agent, type BusMessage, type Signal } from 'agentbus-core';

export interface ClassifierOptions {
  bus: import('agentbus-core').AgentBus;
  /** OpenAI-compatible endpoint. Defaults to Bitget hackathon Qwen proxy. */
  endpoint?: string;
  /** Model id. Default "qwen3.6-plus". */
  model?: string;
  /** API key (env var BITGET_QWEN_API_KEY used if not provided). */
  apiKey?: string;
  /** Drop threshold — signals below this score are routed to a 'noise' topic. */
  dropThreshold?: number;
  /** Patterns to subscribe to. Default: signal.> */
  pattern?: string;
  /** Optional timeout per call (ms). */
  timeoutMs?: number;
}

export interface ClassifiedSignal extends Signal {
  /** LLM-assigned quality score 0..1. */
  quality: number;
  /** LLM's reasoning for the score. */
  reason: string;
  /** Original agent id that emitted the signal. */
  sourceFrom: string;
  /** Correlation id of the original signal. */
  sourceCorrelationId?: string;
}

interface ClassifierVerdict {
  score: number;
  reason: string;
  drop: boolean;
}

const SYSTEM_PROMPT = `You are a quality-control filter for crypto trading signals on AgentBus.
You will receive JSON describing a signal. Score it 0..1 on quality and decide if it should pass.

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
{"score": 0.0, "reason": "<=140 chars", "drop": false}`;

export class QwenClassifier {
  private endpoint: string;
  private model: string;
  private apiKey: string;
  private dropThreshold: number;
  private timeoutMs: number;

  constructor(opts: ClassifierOptions) {
    // ── Provider priority ──
    // 1. Qwen (Bitget hackathon proxy) — preferred
    // 2. Qwen (generic) — same model family
    // 3. OpenAI / OpenAI-compatible — fallback
    // 4. Heuristic — last resort, no network

    const qwenKey = opts.apiKey
      ?? process.env.BITGET_QWEN_API_KEY
      ?? process.env.QWEN_API_KEY;
    const openaiKey = qwenKey ? undefined : (opts.apiKey ?? process.env.OPENAI_API_KEY);

    const qwenEndpoint = opts.endpoint
      ?? process.env.BITGET_QWEN_ENDPOINT
      ?? process.env.QWEN_ENDPOINT
      ?? (process.env.BITGET_QWEN_API_KEY ? 'https://hackathon.bitgetops.com/v1' : undefined);
    const openaiEndpoint = qwenEndpoint ? undefined : (
      opts.endpoint
      ?? process.env.OPENAI_BASE_URL
      ?? (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : undefined)
    );

    this.endpoint = qwenEndpoint ?? openaiEndpoint ?? '';
    this.apiKey = qwenKey ?? openaiKey ?? '';

    this.model = opts.model
      ?? process.env.BITGET_QWEN_MODEL
      ?? process.env.QWEN_MODEL
      ?? process.env.OPENAI_MODEL
      ?? (qwenKey ? 'qwen3.6-plus' : 'gpt-4o-mini');
    this.dropThreshold = opts.dropThreshold ?? 0.4;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  /**
   * Score a single signal. Returns the LLM verdict, or a heuristic fallback
   * if the call fails (so the demo never blocks).
   */
  async classify(signal: Signal): Promise<ClassifierVerdict> {
    if (!this.apiKey) {
      // No key — fall back to a heuristic so the demo runs offline
      return heuristic(signal);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(signal) },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`qwen http ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as Partial<ClassifierVerdict>;
      const score = clamp01(Number(parsed.score ?? 0.5));
      return {
        score,
        reason: String(parsed.reason ?? '').slice(0, 200),
        drop: parsed.drop === true || score < this.dropThreshold,
      };
    } catch (err) {
      // Don't block the bus on Qwen outages — log + fall back.
      // eslint-disable-next-line no-console
      console.warn(`[classifier] qwen call failed, using heuristic: ${(err as Error).message}`);
      return heuristic(signal);
    } finally {
      clearTimeout(timer);
    }
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function heuristic(s: Signal): ClassifierVerdict {
  // Cheap offline proxy: rationale length + symbol present + confidence alignment.
  const len = (s.rationale ?? '').trim().length;
  let score = 0.5;
  if (len > 60) score += 0.2;
  if (len > 120) score += 0.1;
  if (s.symbol) score += 0.1;
  // Empty or trivial rationale is noise
  if (len === 0) {
    return { score: 0.1, reason: 'empty rationale', drop: true };
  }
  if (len < 30 && s.confidence > 0.7) score -= 0.2;
  score = clamp01(score);
  return {
    score,
    reason: len < 30 ? 'thin rationale' : 'heuristic ok',
    drop: score < 0.4,
  };
}

export function startClassifier(opts: ClassifierOptions): { agent: Agent; classifier: QwenClassifier; stop: () => void } {
  const classifier = new QwenClassifier(opts);
  const pattern = opts.pattern ?? 'signal.raw.>';
  const agent = new Agent({ bus: opts.bus, id: 'qwen-classifier' });

  agent.start({
    pattern,
    kinds: ['signal'],
    handler: async (msg: BusMessage<Signal>) => {
      // Don't re-classify signals we (or any classifier) produced.
      if (msg.from === agent.id || msg.from.endsWith(':classifier')) return;
      const verdict = await classifier.classify(msg.payload);
      if (verdict.drop) {
        agent.publish('signal.noise', 'log', {
          signal: msg.payload,
          reason: verdict.reason,
          score: verdict.score,
        }, {
          from: agent.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
        return;
      }
      const enriched: ClassifiedSignal = {
        ...msg.payload,
        quality: verdict.score,
        reason: msg.payload.rationale,
        sourceFrom: msg.from,
        sourceCorrelationId: msg.correlationId,
      };
      agent.publish('signal.scored', 'signal', enriched, {
        from: agent.id,
        correlationId: msg.correlationId,
        causationId: msg.id,
        metadata: {
          classifierScore: String(verdict.score.toFixed(2)),
          classifierReason: verdict.reason.slice(0, 60),
        },
      });
    },
    announce: true,
  });

  return {
    agent,
    classifier,
    stop: () => agent.stop(),
  };
}
