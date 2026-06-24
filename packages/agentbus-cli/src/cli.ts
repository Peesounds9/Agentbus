#!/usr/bin/env node
/**
 * AgentBus CLI — `agentbus <command> [args]`
 *
 * Commands:
 *   inspect                       — show bus state, subscribers, queue depths
 *   tail [--kind=fill] [-n=10]    — print recent messages
 *   publish <topic> --kind=...    — publish a message (JSON from --json or stdin)
 *   run [--mode=paper|live]       — start the runtime (researcher, strategist,
 *                                    risk-manager, executor + bitget adapter)
 *   backtest <log.jsonl>          — replay a session, print stats
 *   install-skill <dir>           — drop the agentbus-bitget skill into a folder
 */

import { AgentBusRuntime } from 'agentbus-runtime';
import { replaySession } from 'agentbus-runtime';
import { installSkill } from 'agentbus-bitget';
import { AgentBus, type BusMessage } from 'agentbus-core';
import { readFileSync } from 'node:fs';

const HELP = `AgentBus CLI

Usage:
  agentbus inspect
  agentbus tail [--kind=fill] [-n=10] [--topic=order.>]
  agentbus publish <topic> --kind=<kind> [--from=agent_x] [--json='{"k":1}']
  agentbus run [--mode=paper|live] [--cash=10000] [--log=./logs/session.jsonl]
  agentbus backtest <log.jsonl> [--marks=BTCUSDT:60000,ETHUSDT:3000]
  agentbus install-skill <dir>
`;

function arg(name: string, def?: string): string | undefined {
  const f = process.argv.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : def;
}
function positional(i: number): string | undefined {
  // skip "node", "cli.js", and the command verb
  return process.argv[i + 3];
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'inspect':
      return cmdInspect();
    case 'tail':
      return cmdTail();
    case 'publish':
      return cmdPublish();
    case 'run':
      return cmdRun();
    case 'backtest':
      return cmdBacktest();
    case 'install-skill':
      return cmdInstallSkill();
    case '-h':
    case '--help':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`unknown command: ${cmd}\n${HELP}`);
      process.exit(2);
  }
}

function cmdInspect(): void {
  const bus = new AgentBus();
  // No-op bus for the local inspect demo — real daemon talks via wire.
  console.log(JSON.stringify(bus.inspect(), null, 2));
  console.log('\n(hint: start a daemon with `agentbus run` and connect via MCP)');
}

function cmdTail(): void {
  const bus = new AgentBus();
  const kind = arg('kind');
  const topic = arg('topic');
  const n = Number(arg('n', '10'));
  const msgs = bus.historySnapshot({
    kind: kind as never,
    topic,
    limit: n,
  });
  for (const m of msgs) console.log(formatMsg(m));
}

function formatMsg(m: BusMessage): string {
  return `${new Date(m.ts).toISOString()} ${m.topic} [${m.kind}] from=${m.from} payload=${JSON.stringify(m.payload).slice(0, 200)}`;
}

async function cmdPublish(): Promise<void> {
  const topic = positional(0);
  if (!topic) throw new Error('missing topic');
  const kind = arg('kind') ?? 'log';
  const from = arg('from') ?? 'cli';
  const jsonArg = arg('json');
  let payload: unknown = {};
  if (jsonArg) {
    payload = JSON.parse(jsonArg);
  } else {
    // read stdin
    payload = JSON.parse(readFileSync(0, 'utf8'));
  }
  const bus = new AgentBus();
  const id = bus.publish(topic, kind as never, payload, { from });
  console.log(id);
}

async function cmdRun(): Promise<void> {
  const mode = (arg('mode') ?? 'paper') as 'paper' | 'live';
  const cash = Number(arg('cash') ?? '10000');
  const log = arg('log') ?? './logs/session.jsonl';
  const rt = new AgentBusRuntime({ mode, paperCashUsdt: cash, logPath: log });
  await rt.start();
  console.log(`[agentbus] runtime started (mode=${mode}, log=${log})`);
  console.log('inject ticks via `agentbus inject` from another shell, or use the MCP server.');

  // Simple demo loop: inject a "risk_on" tick every 10s for 60s, then exit.
  if (arg('demo')) {
    for (let i = 0; i < 6; i++) {
      rt.injectTick({ bias: 'risk_on', confidence: 0.7 });
      await sleep(1000);
    }
    const stats = rt.recorder.markToMarket({ BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 });
    console.log('[agentbus] demo complete:', stats);
    await rt.stop();
    process.exit(0);
  }

  // Otherwise: keep alive
  process.on('SIGINT', async () => {
    await rt.stop();
    process.exit(0);
  });
  // park forever
  await new Promise(() => undefined);
}

function cmdBacktest(): void {
  const path = positional(0);
  if (!path) throw new Error('missing log path');
  const marksArg = arg('marks') ?? '';
  const marks: Record<string, number> = {};
  for (const pair of marksArg.split(',').filter(Boolean)) {
    const [s, p] = pair.split(':');
    if (s && p) marks[s] = Number(p);
  }
  const result = replaySession(path, marks);
  console.log(JSON.stringify(result, null, 2));
}

function cmdInstallSkill(): void {
  const dir = positional(0) ?? './skills';
  const where = installSkill(dir);
  console.log(`installed agentbus-bitget skill at ${where}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
