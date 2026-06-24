/**
 * Researcher Agent — turns raw perception events (macro / sentiment /
 * news / onchain) into actionable `signal` messages.
 *
 * In production this would call out to the Bitget Skill Hub skills
 * (macro-analyst, sentiment-analyst, technical-analysis, market-intel,
 * news-briefing). In this reference impl we apply a simple bias table
 * so the demo can run without those skills installed.
 */

import { Agent, type BusMessage, type Signal } from 'agentbus-core';

interface PerceptionEvent {
  bias?: 'risk_on' | 'risk_off' | 'neutral';
  confidence?: number;
}

export interface ResearcherOptions {
  bus: import('agentbus-core').AgentBus;
  watchlist?: string[];
  /** Optional override for the perception → signal mapping. */
  rules?: PerceptionRules;
}

export interface PerceptionRules {
  /** Maps a (source-kind, bias) → direction for a given symbol. */
  resolve(symbol: string, source: string, bias: string): { direction: Signal['direction']; rationale: string };
}

const DEFAULT_RULES: PerceptionRules = {
  resolve(symbol, _source, bias) {
    if (bias === 'risk_on') return { direction: 'long', rationale: `${_source} risk-on → ${symbol} beta positive` };
    if (bias === 'risk_off') return { direction: 'short', rationale: `${_source} risk-off → ${symbol} beta negative` };
    return { direction: 'flat', rationale: 'no clear bias' };
  },
};

export function startResearcher(opts: ResearcherOptions): Agent {
  const watchlist = opts.watchlist ?? ['BTCUSDT', 'ETHUSDT'];
  const rules = opts.rules ?? DEFAULT_RULES;
  const agent = new Agent({ bus: opts.bus, id: 'researcher' });
  agent.start({
    pattern: 'tick.>',
    kinds: ['macro', 'sentiment', 'news', 'onchain'],
    handler: async (msg: BusMessage<PerceptionEvent>) => {
      const bias = msg.payload.bias ?? 'neutral';
      const confidence = msg.payload.confidence ?? 0.5;
      for (const symbol of watchlist) {
        const out = rules.resolve(symbol, msg.kind, bias);
        if (out.direction === 'flat' || confidence < 0.4) continue;
        const signal: Signal = {
          symbol,
          direction: out.direction,
          confidence,
          horizon: 'intraday',
          rationale: out.rationale,
          sources: [msg.from],
          ttlMs: 30 * 60_000,
        };
        agent.publish(`signal.${symbol.toLowerCase()}`, 'signal', signal, {
          from: agent.id,
          correlationId: msg.correlationId,
          causationId: msg.id,
        });
      }
    },
    announce: true,
  });
  return agent;
}
