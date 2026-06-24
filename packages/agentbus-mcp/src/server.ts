#!/usr/bin/env node
/**
 * AgentBus MCP Server
 *
 * Implements the Model Context Protocol over stdio so any MCP-compatible
 * AI client (Claude Code, Cursor, Codex, OpenClaw) can publish / subscribe
 * / inspect the AgentBus.
 *
 * Tools exposed:
 *   agentbus_inspect           — bus state + subscribers
 *   agentbus_publish           — publish a typed message
 *   agentbus_history           — recent messages
 *   agentbus_subscribe         — start a session-scoped subscription (returns a token)
 *   agentbus_tail              — convenience: blocking tail of new messages
 *
 * Resources exposed:
 *   agentbus://topics          — current topic list
 *   agentbus://agents          — known agents (from heartbeats)
 *
 * The server spins up an in-process AgentBusRuntime in `paper` mode so
 * the bus is always functional for exploration; pass `AGENTBUS_MODE=live`
 * to launch the Bitget live adapter.
 */

import { createServer, IncomingMessage } from 'node:http';
import { AgentBusRuntime } from 'agentbus-runtime';
import { AgentBus, type BusMessage, type MessageKind } from 'agentbus-core';

const SERVER_INFO = { name: 'agentbus-mcp', version: '0.1.0' };
const PROTOCOL_VERSION = '2024-11-05';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

const mode = (process.env.AGENTBUS_MODE === 'live' ? 'live' : 'paper') as 'paper' | 'live';
const cash = Number(process.env.AGENTBUS_CASH ?? '10000');
const log = process.env.AGENTBUS_LOG ?? './logs/session.jsonl';
const runtime = new AgentBusRuntime({ mode, paperCashUsdt: cash, logPath: log });
const bus = runtime.bus;

const tools = [
  {
    name: 'agentbus_inspect',
    description: 'Inspect bus state: id, subscribers, queue depths, history size.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'agentbus_publish',
    description: 'Publish a typed message to a topic.',
    inputSchema: {
      type: 'object',
      required: ['topic', 'kind', 'payload'],
      properties: {
        topic: { type: 'string', description: 'Topic name, e.g. "signal.btc"' },
        kind: {
          type: 'string',
          enum: [
            'signal','thesis','macro','sentiment','news','onchain',
            'plan','risk_check','risk_alert','order','order_update',
            'fill','position_update','metric','log','heartbeat','custom',
          ],
        },
        payload: { description: 'Message payload (object)' },
        from: { type: 'string', default: 'mcp-client' },
        correlationId: { type: 'string' },
        causationId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'agentbus_history',
    description: 'Recent messages matching a filter.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        kind: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'agentbus_subscribe',
    description: 'Subscribe to a topic pattern (returns last N messages as a snapshot).',
    inputSchema: {
      type: 'object',
      required: ['pattern'],
      properties: {
        pattern: { type: 'string' },
        kinds: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'agentbus_inject_tick',
    description: 'Inject a market tick (macro / sentiment) into the bus — convenience for demos.',
    inputSchema: {
      type: 'object',
      required: ['bias'],
      properties: {
        bias: { type: 'string', enum: ['risk_on', 'risk_off', 'neutral'] },
        confidence: { type: 'number', default: 0.7 },
      },
      additionalProperties: false,
    },
  },
];

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'agentbus_inspect':
      return runtime.bus.inspect();
    case 'agentbus_publish': {
      const { topic, kind, payload, from = 'mcp-client', correlationId, causationId } = args as {
        topic: string; kind: MessageKind; payload: unknown; from?: string;
        correlationId?: string; causationId?: string;
      };
      const id = runtime.bus.publish(topic, kind, payload, {
        from,
        correlationId,
        causationId,
      });
      return { id };
    }
    case 'agentbus_history': {
      const { topic, kind, limit = 20 } = args as {
        topic?: string; kind?: MessageKind; limit?: number;
      };
      return runtime.bus.historySnapshot({ topic, kind, limit });
    }
    case 'agentbus_subscribe': {
      const { pattern, kinds, limit = 10 } = args as {
        pattern: string; kinds?: MessageKind[]; limit?: number;
      };
      return runtime.bus.historySnapshot({
        topic: pattern,
        kind: kinds?.[0],
        limit,
      });
    }
    case 'agentbus_inject_tick': {
      const { bias, confidence = 0.7 } = args as {
        bias: 'risk_on' | 'risk_off' | 'neutral'; confidence?: number;
      };
      runtime.injectTick({ bias, confidence });
      return { ok: true };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function send(id: number | string, result?: unknown, error?: { code: number; message: string }): string {
  const body: Record<string, unknown> = { jsonrpc: '2.0', id };
  if (error) body.error = error;
  else body.result = result;
  return JSON.stringify(body);
}

async function handleMessage(raw: string): Promise<string | null> {
  let msg: JsonRpcRequest;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  try {
    switch (msg.method) {
      case 'initialize':
        return send(msg.id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: { tools: {}, resources: {} },
        });
      case 'notifications/initialized':
        return null;
      case 'tools/list':
        return send(msg.id, { tools });
      case 'resources/list':
        return send(msg.id, {
          resources: [
            { uri: 'agentbus://topics', name: 'Topics', mimeType: 'application/json' },
            { uri: 'agentbus://agents', name: 'Agents (via heartbeats)', mimeType: 'application/json' },
          ],
        });
      case 'resources/read': {
        const uri = String((msg.params as { uri: string })?.uri ?? '');
        if (uri === 'agentbus://topics') {
          const topics = new Set<string>();
          for (const m of runtime.bus.historySnapshot({ limit: 1000 })) topics.add(m.topic);
          return send(msg.id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify([...topics]) }] });
        }
        if (uri === 'agentbus://agents') {
          const agents = runtime.bus
            .historySnapshot({ kind: 'heartbeat', limit: 200 })
            .map((m: BusMessage<unknown>) => (m.payload as { agentId: string }).agentId);
          return send(msg.id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify([...new Set(agents)]) }] });
        }
        return send(msg.id, undefined, { code: -32602, message: 'unknown resource' });
      }
      case 'tools/call': {
        const { name, arguments: args } = msg.params as { name: string; arguments: Record<string, unknown> };
        const result = await handleToolCall(name, args || {});
        return send(msg.id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
      }
      case 'ping':
        return send(msg.id, {});
      default:
        return send(msg.id, undefined, { code: -32601, message: `method not found: ${msg.method}` });
    }
  } catch (err) {
    return send(msg.id, undefined, { code: -32000, message: (err as Error).message });
  }
}

async function main(): Promise<void> {
  await runtime.start();
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const resp = await handleMessage(line);
      if (resp) process.stdout.write(resp + '\n');
    }
  });
  process.stdin.on('end', async () => {
    await runtime.stop();
    process.exit(0);
  });
  process.stderr.write(`[agentbus-mcp] ready (mode=${mode}, log=${log})\n`);
}

main().catch((err) => {
  process.stderr.write(`[agentbus-mcp] fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});

// Silence unused import warning for type-only IncomingMessage.
void (null as unknown as IncomingMessage);
// Reference createServer to keep the http module loaded for the SSE transport
// we may add in a future version.
void createServer;
