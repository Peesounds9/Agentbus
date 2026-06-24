/**
 * Cooperating two-agent demo
 *
 * Two agents, one shared bus, one visible dashboard. This is the demo the
 * hackathon submission puts front-and-centre because it captures the
 * "solo agent → team" story in one screenful.
 *
 *   -signaler-       raw signals to `signal.raw.btc`
 *      │
 *      ▼
 *   -classifier-    (qwen3.6-plus via hackathon proxy) scores & filters
 *      │              emits `signal.scored.btc` or `signal.noise`
 *      ▼
 *   -executor-      only fires when classifier passes a high-quality signal;
 *      │              routes through Bitget adapter → `fill`
 *      ▼
 *   -dashboard-     a tiny HTTP server (see ./dashboard) that streams the
 *                   live bus state into a single HTML page.
 *
 * No risk manager, no plan stage, no thesis — the point is *visible
 * cooperation between two specialist agents*, not a production stack.
 */

import { AgentBus, Agent, type Signal, type Order } from 'agentbus-core';
import {
  BitgetAdapter,
  PaperSessionRecorder,
} from 'agentbus-bitget';
import { startClassifier } from 'agentbus-classifier';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export interface CoopDemoOptions {
  mode?: 'paper' | 'live';
  paperCashUsdt?: number;
  logPath?: string;
  watchlist?: string[];
  /** Qwen proxy key — if missing, classifier falls back to heuristic. */
  qwenApiKey?: string;
  /** Marks for paper execution. */
  marks?: Record<string, number>;
  /** Dashboard port. Default 8787. Set to 0 to disable. */
  dashboardPort?: number;
}

export class CoopDemo {
  readonly bus: AgentBus;
  readonly adapter: BitgetAdapter;
  readonly recorder: PaperSessionRecorder;
  private signaler: Agent;
  private classifier: ReturnType<typeof startClassifier>;
  private executor: Agent;
  private dashboard?: ReturnType<typeof createServer>;
  private marks: Record<string, number>;
  private started = false;
  private opts: Required<Omit<CoopDemoOptions, 'qwenApiKey'>> & { qwenApiKey?: string };

  constructor(opts: CoopDemoOptions = {}) {
    this.opts = {
      mode: opts.mode ?? 'paper',
      paperCashUsdt: opts.paperCashUsdt ?? 10_000,
      logPath: opts.logPath ?? './examples/two-agent-demo/session.jsonl',
      watchlist: opts.watchlist ?? ['BTCUSDT', 'ETHUSDT'],
      dashboardPort: opts.dashboardPort ?? 8787,
      marks: opts.marks ?? { BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 },
      qwenApiKey: opts.qwenApiKey,
    };
    this.marks = this.opts.marks;
    this.bus = new AgentBus({ persist: true, historySize: 2_000 });
    this.adapter = new BitgetAdapter({
      bus: this.bus,
      mode: this.opts.mode,
      paperCashUsdt: this.opts.paperCashUsdt,
    });
    this.recorder = new PaperSessionRecorder({
      bus: this.bus,
      outPath: this.opts.logPath,
    });
    this.signaler = this.makeSignaler();
    this.classifier = startClassifier({ bus: this.bus, apiKey: this.opts.qwenApiKey });
    this.executor = this.makeExecutor();
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.adapter.start();
    if (this.opts.dashboardPort > 0) this.startDashboard();
  }

  async stop(): Promise<void> {
    this.signaler.stop();
    this.classifier.stop();
    this.executor.stop();
    await this.recorder.stop();
    if (this.dashboard) await new Promise<void>((r) => this.dashboard!.close(() => r()));
    await this.adapter.stop();
  }

  /** Publish a raw signal on behalf of the signaler agent. */
  publishSignal(input: {
    symbol: string;
    direction: 'long' | 'short' | 'flat';
    confidence: number;
    horizon?: 'scalp' | 'intraday' | 'swing' | 'position';
    rationale: string;
    sources?: string[];
  }): string {
    const sym = input.symbol.toUpperCase();
    const sig: Signal = {
      symbol: sym,
      direction: input.direction,
      confidence: input.confidence,
      horizon: input.horizon ?? 'intraday',
      rationale: input.rationale,
      sources: input.sources ?? ['signaler'],
      ttlMs: 30 * 60_000,
    };
    return this.signaler.publish(`signal.raw.${sym.toLowerCase()}`, 'signal', sig, {
      from: this.signaler.id,
      metadata: { clientOrderId: `sig_${randomUUID().slice(0, 8)}` },
    });
  }

  /** Inject a believable sequence of signals — used by the dashboard demo. */
  injectDemoSequence(): void {
    const seq: Array<Parameters<CoopDemo['publishSignal']>[0]> = [
      { symbol: 'BTCUSDT', direction: 'flat', confidence: 0.3, rationale: '', sources: ['signaler'] }, // noise (empty rationale)
      { symbol: 'BTCUSDT', direction: 'long', confidence: 0.85, rationale: '1h breakout above 60.2k with volume 2.3x 20-period avg; RSI 64 not overbought', sources: ['ta', 'volume'] },
      { symbol: 'ETHUSDT', direction: 'long', confidence: 0.55, rationale: 'btc beta', sources: ['signaler'] }, // weak — heuristic should pass
      { symbol: 'BTCUSDT', direction: 'short', confidence: 0.4, rationale: 'funding flipped positive but price stalled at 60.4k resistance', sources: ['funding'] },
      { symbol: 'BTCUSDT', direction: 'long', confidence: 0.95, rationale: 'whale wallet 0x9f..ab added 1,200 BTC in last hour; spot CVD positive 18m straight; 4h close above 60k', sources: ['onchain:whale', 'cvd', 'ta'] },
    ];
    for (const s of seq) this.publishSignal(s);
  }

  private makeSignaler(): Agent {
    const a = new Agent({ bus: this.bus, id: 'signaler' });
    a.start({
      pattern: 'never', // purely on-demand publisher
      handler: async () => undefined,
      announce: true,
    });
    return a;
  }

  private makeExecutor(): Agent {
    const a = new Agent({ bus: this.bus, id: 'executor' });
    a.start({
      pattern: 'signal.scored',
      kinds: ['signal'],
      handler: async (msg) => {
        const sig = msg.payload as Signal & { quality?: number };
        const quality = sig.quality ?? 0;
        if (sig.direction === 'flat') return;
        if (quality < 0.6) return; // only high-quality
        const order: Order = {
          symbol: sig.symbol,
          side: sig.direction === 'short' ? 'sell' : 'buy',
          type: 'market',
          size: 0.01, // demo size
          leverage: 2,
          clientOrderId: `ex_${randomUUID().slice(0, 8)}`,
        };
        const refPrice = this.marks[sig.symbol] ?? 60_000;
        try {
          await this.adapter.submitOrder(order, refPrice);
        } catch (err) {
          a.publish('order.bitget.futures', 'order_update', {
            clientOrderId: order.clientOrderId,
            symbol: order.symbol,
            status: 'rejected',
            filledQty: 0,
            reason: (err as Error).message,
          }, { from: a.id, causationId: msg.id });
        }
      },
      announce: true,
    });
    return a;
  }

  private startDashboard(): void {
    const srv = createServer((req, res) => this.handleDashboard(req, res));
    srv.listen(this.opts.dashboardPort, () => {
      // eslint-disable-next-line no-console
      console.log(`[dashboard] http://localhost:${this.opts.dashboardPort}`);
    });
    this.dashboard = srv;
  }

  private handleDashboard(req: IncomingMessage, res: ServerResponse): void {
    if (!req.url) {
      res.writeHead(400).end('bad request');
      return;
    }
    if (req.method === 'POST' && req.url.startsWith('/api/publish')) {
      // POST /api/publish  body: {"symbol":"BTCUSDT","direction":"long","confidence":0.9,"rationale":"..."}
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as Parameters<CoopDemo['publishSignal']>[0];
          const id = this.publishSignal(payload);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, id }));
        } catch (err) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
        }
      });
      return;
    }
    if (req.url === '/' || req.url.startsWith('/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(dashboardHtml(this.bus.id, this.signaler.id, this.classifier.agent.id, this.executor.id));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/inject') {
      this.injectDemoSequence();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url === '/api/state') {
      const state = {
        busId: this.bus.id,
        agents: [
          { id: this.signaler.id, role: 'signaler' },
          { id: this.classifier.agent.id, role: 'classifier' },
          { id: this.executor.id, role: 'executor' },
        ],
        inspect: this.bus.inspect(),
        signals: this.bus.historySnapshot({ kind: 'signal', limit: 20 }).map((m) => ({
          topic: m.topic,
          from: m.from,
          ts: m.ts,
          payload: m.payload,
        })),
        orders: this.bus.historySnapshot({ kind: 'order', limit: 20 }).map((m) => ({
          topic: m.topic,
          from: m.from,
          ts: m.ts,
          payload: m.payload,
        })),
        fills: this.bus.historySnapshot({ kind: 'fill', limit: 20 }).map((m) => ({
          ts: m.ts,
          from: m.from,
          payload: m.payload,
        })),
        noise: this.bus.historySnapshot({ topic: 'signal.noise', limit: 20 }).map((m) => ({
          ts: m.ts,
          payload: m.payload,
        })),
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }
    res.writeHead(404).end('not found');
  }
}

// ─────────── dashboard HTML ───────────

function dashboardHtml(busId: string, signalerId: string, classifierId: string, executorId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AgentBus — two-agent cooperating demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d;
    --fg: #e6edf3; --muted: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --red: #f85149; --yellow: #d29922; --purple: #bc8cff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system, system-ui, sans-serif; }
  header { padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 24px; }
  header h1 { margin: 0; font-size: 18px; font-weight: 600; }
  header .bus { color: var(--muted); font-size: 12px; font-family: ui-monospace, monospace; }
  main { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 16px 24px; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; min-height: 320px; }
  .panel h2 { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .agent-id { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 8px; border-bottom: 1px solid var(--border); font-family: ui-monospace, monospace; font-size: 12px; }
  li:last-child { border-bottom: none; }
  .topic { color: var(--accent); }
  .from { color: var(--muted); }
  .payload { color: var(--fg); white-space: pre-wrap; word-break: break-word; max-height: 80px; overflow: auto; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px; }
  .badge.green { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge.red { background: rgba(248,81,73,0.15); color: var(--red); }
  .badge.yellow { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .badge.purple { background: rgba(188,140,255,0.15); color: var(--purple); }
  .stats { display: flex; gap: 16px; margin: 8px 0 16px; font-size: 12px; color: var(--muted); }
  .stat { padding: 4px 10px; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); }
  .stat strong { color: var(--fg); font-weight: 600; }
  .footer { padding: 12px 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); }
</style>
</head>
<body>
  <header>
    <h1>AgentBus <span style="color:var(--muted);font-weight:400">— two cooperating agents</span></h1>
    <span class="bus">bus: ${busId}</span>
  </header>
  <main>
    <section class="panel">
      <h2>📡 Signaler <span class="agent-id">${signalerId}</span></h2>
      <p style="color:var(--muted);font-size:12px;margin:0 0 12px">Publishes raw signals on <code>signal.raw.&lt;sym&gt;</code>.</p>
      <div class="stats" id="stats-signaler"></div>
      <ul id="list-signaler"></ul>
    </section>
    <section class="panel">
      <h2>🤖 Classifier <span class="agent-id">${classifierId}</span></h2>
      <p style="color:var(--muted);font-size:12px;margin:0 0 12px">Qwen 3.6-plus via hackathon proxy → score &amp; filter. Falls back to heuristic if no key.</p>
      <div class="stats" id="stats-classifier"></div>
      <ul id="list-scored"></ul>
      <h2 style="margin-top:16px">🚫 Noise</h2>
      <ul id="list-noise"></ul>
    </section>
    <section class="panel">
      <h2>⚡ Executor <span class="agent-id">${executorId}</span></h2>
      <p style="color:var(--muted);font-size:12px;margin:0 0 12px">Listens to <code>signal.scored</code> (quality ≥ 0.6). Submits orders via Bitget adapter (paper).</p>
      <div class="stats" id="stats-executor"></div>
      <ul id="list-orders"></ul>
      <h2 style="margin-top:16px">💰 Fills</h2>
      <ul id="list-fills"></ul>
    </section>
  </main>
  <div class="footer">Auto-refresh every 1.5s · JSON state at <code>/api/state</code></div>
<script>
const fmt = (x) => JSON.stringify(x, null, 2);
async function refresh() {
  try {
    const res = await fetch('/api/state');
    const s = await res.json();
    document.getElementById('stats-signaler').innerHTML =
      '<span class="stat"><strong>' + s.signals.length + '</strong> signals</span>' +
      '<span class="stat">bus <strong>' + s.inspect.historySize + '</strong> msgs</span>';
    document.getElementById('list-signaler').innerHTML = s.signals
      .filter(m => m.topic.startsWith('signal.raw.'))
      .map(m => '<li><span class="topic">' + m.topic + '</span> <span class="from">from ' + m.from + '</span><div class="payload">' + fmt(m.payload) + '</div></li>')
      .join('') || '<li><span class="from">no signals yet — POST a signal or use the demo script</span></li>';
    document.getElementById('stats-classifier').innerHTML =
      '<span class="stat"><strong>' + s.signals.filter(m => m.topic === 'signal.scored').length + '</strong> passed</span>' +
      '<span class="stat"><strong>' + s.noise.length + '</strong> dropped</span>';
    document.getElementById('list-scored').innerHTML = s.signals
      .filter(m => m.topic === 'signal.scored')
      .map(m => {
        const q = (m.payload && m.payload.quality) || 0;
        const cls = q >= 0.7 ? 'green' : q >= 0.5 ? 'yellow' : 'red';
        return '<li><span class="badge ' + cls + '">q=' + q.toFixed(2) + '</span> <span class="topic">' + m.payload.symbol + '</span> ' + m.payload.direction + ' <span class="from">conf=' + m.payload.confidence + '</span><div class="payload">' + fmt(m.payload) + '</div></li>';
      })
      .join('') || '<li><span class="from">waiting for scored signals…</span></li>';
    document.getElementById('list-noise').innerHTML = s.noise
      .map(m => '<li><span class="badge red">drop</span> ' + m.payload.reason + '<div class="payload">' + fmt(m.payload.signal) + '</div></li>')
      .join('') || '<li><span class="from">none dropped yet</span></li>';
    document.getElementById('stats-executor').innerHTML =
      '<span class="stat"><strong>' + s.orders.length + '</strong> orders</span>' +
      '<span class="stat"><strong>' + s.fills.length + '</strong> fills</span>';
    document.getElementById('list-orders').innerHTML = s.orders
      .map(m => '<li><span class="badge purple">' + m.payload.side + '</span> <span class="topic">' + m.payload.symbol + '</span> size=' + m.payload.size + ' <span class="from">cid=' + m.payload.clientOrderId + '</span></li>')
      .join('') || '<li><span class="from">no orders yet — the executor only fires on q ≥ 0.6</span></li>';
    document.getElementById('list-fills').innerHTML = s.fills
      .map(m => '<li><span class="badge green">fill</span> ' + m.payload.symbol + ' ' + m.payload.side + ' ' + m.payload.qty + ' @ ' + m.payload.price + '</li>')
      .join('') || '<li><span class="from">no fills yet</span></li>';
  } catch (e) {
    console.error(e);
  }
}
refresh();
setInterval(refresh, 1500);
</script>
</body>
</html>`;
}
