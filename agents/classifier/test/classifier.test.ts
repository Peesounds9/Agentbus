import { describe, it, expect } from 'vitest';
import { AgentBus } from 'agentbus-core';
import { startClassifier, QwenClassifier } from '../src/index.js';
import type { Signal } from 'agentbus-core';

function makeSignal(over: Partial<Signal> = {}): Signal {
  return {
    symbol: 'BTCUSDT',
    direction: 'long',
    confidence: 0.7,
    horizon: 'intraday',
    rationale: 'some concrete rationale here',
    sources: ['test'],
    ttlMs: 60_000,
    ...over,
  };
}

describe('QwenClassifier (provider selection)', () => {
  it('prefers OpenAI over Qwen when both keys are set', () => {
    const c = new QwenClassifier({
      bus: new AgentBus(),
      apiKey: 'sk-test',
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });
    // @ts-expect-error access private for test
    expect(c.endpoint).toBe('https://api.openai.com/v1');
    // @ts-expect-error
    expect(c.model).toBe('gpt-4o-mini');
    // @ts-expect-error
    expect(c.apiKey).toBe('sk-test');
  });

  it('reads OPENAI_API_KEY from env when no explicit apiKey', () => {
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env-openai';
    try {
      const c = new QwenClassifier({ bus: new AgentBus() });
      // @ts-expect-error
      expect(c.apiKey).toBe('sk-env-openai');
      // @ts-expect-error
      expect(c.endpoint).toBe('https://api.openai.com/v1');
    } finally {
      if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevKey;
    }
  });

  it('uses heuristic when no key in any form', () => {
    const prevOpenai = process.env.OPENAI_API_KEY;
    const prevQwen = process.env.BITGET_QWEN_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.BITGET_QWEN_API_KEY;
    try {
      const c = new QwenClassifier({ bus: new AgentBus() });
      // @ts-expect-error
      expect(c.apiKey).toBe('');
    } finally {
      if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai;
      if (prevQwen !== undefined) process.env.BITGET_QWEN_API_KEY = prevQwen;
    }
  });

  it('classifies via a custom endpoint when one is provided', async () => {
    // Spin up a fake OpenAI-compatible server on a random port.
    const http = await import('node:http');
    let receivedBody: Record<string, unknown> | null = null;
    let receivedAuthHeader: string | null = null;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        receivedBody = JSON.parse(body) as Record<string, unknown>;
        receivedAuthHeader = req.headers.authorization ?? null;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { content: '{"score":0.91,"reason":"mocked-good","drop":false}' } }],
        }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;
    try {
      const c = new QwenClassifier({
        bus: new AgentBus(),
        endpoint: `http://127.0.0.1:${port}/v1`,
        model: 'mock-model',
        apiKey: 'sk-mock',
      });
      const v = await c.classify(makeSignal());
      expect(v.score).toBeCloseTo(0.91, 2);
      expect(v.drop).toBe(false);
      expect(receivedAuthHeader).toBe('Bearer sk-mock');
      expect((receivedBody as { model: string }).model).toBe('mock-model');
    } finally {
      server.close();
    }
  });
});

describe('QwenClassifier (heuristic fallback when no key)', () => {
  const c = new QwenClassifier({ bus: new AgentBus() }); // no apiKey → heuristic

  it('drops signal with empty rationale', async () => {
    const v = await c.classify(makeSignal({ rationale: '' }));
    expect(v.score).toBeLessThan(0.4);
    expect(v.drop).toBe(true);
  });

  it('passes a signal with substantive rationale and aligned confidence', async () => {
    const v = await c.classify(makeSignal({
      rationale: '1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64 not overbought',
      confidence: 0.8,
    }));
    expect(v.drop).toBe(false);
    expect(v.score).toBeGreaterThanOrEqual(0.4);
  });

  it('penalizes over-confident thin rationale', async () => {
    const v = await c.classify(makeSignal({ rationale: 'ok', confidence: 0.95 }));
    expect(v.score).toBeLessThan(0.7);
  });
});

describe('startClassifier integration', () => {
  it('emits signal.scored and signal.noise as appropriate', async () => {
    const bus = new AgentBus();
    const c = startClassifier({ bus });
    const scored: unknown[] = [];
    const noise: unknown[] = [];
    bus.subscribe('signal.scored', (m) => scored.push(m.payload), { kinds: ['signal'] });
    bus.subscribe('signal.noise', (m) => noise.push(m.payload));

    // empty rationale → drop
    bus.publish('signal.raw.btc', 'signal', makeSignal({ rationale: '' }), { from: 'cli' });
    // strong rationale → pass
    bus.publish('signal.raw.btc', 'signal', makeSignal({
      rationale: 'whale 1.2k BTC, CVD positive 18m, 4h close above 60k, breakout confirmed on volume 2.3x avg',
      confidence: 0.95,
    }), { from: 'cli' });

    await new Promise((r) => setTimeout(r, 50));
    c.stop();
    expect(noise.length).toBe(1);
    expect(scored.length).toBe(1);
    const s = scored[0] as { quality: number; sourceFrom: string };
    expect(s.quality).toBeGreaterThan(0.4);
    expect(s.sourceFrom).toBe('cli');
  });

  it('does not re-classify its own output (no infinite loop)', async () => {
    const bus = new AgentBus();
    const c = startClassifier({ bus });
    let calls = 0;
    bus.subscribe('signal.scored', () => calls++, { kinds: ['signal'] });
    bus.publish('signal.raw.btc', 'signal', makeSignal(), { from: 'cli' });
    await new Promise((r) => setTimeout(r, 100));
    c.stop();
    expect(calls).toBe(1); // only the original signal triggered classification
  });
});
