/**
 * RemoteBus — a client over the AgentBus wire protocol.
 *
 * The CLI uses this to talk to a running daemon (the MCP server or a
 * long-running `agentbus run` process) over stdio JSON-lines. The local
 * `agentbus inspect --local` path constructs an in-memory bus directly.
 */

import { connect, type Socket } from 'node:net';
import { createInterface } from 'node:readline';

export interface RemoteBusClient {
  publish(topic: string, kind: string, payload: unknown, from: string): Promise<string>;
  history(filter?: { topic?: string; kind?: string; limit?: number }): Promise<unknown[]>;
  inspect(): Promise<unknown>;
  close(): void;
}

export function connectTcp(host: string, port: number): Promise<RemoteBusClient> {
  return new Promise((resolve, reject) => {
    const sock: Socket = connect({ host, port });
    const pending = new Map<number, (resp: unknown) => void>();
    let nextId = 1;
    const rl = createInterface({ input: sock });
    rl.on('line', (line) => {
      try {
        const resp = JSON.parse(line) as { id: number; result?: unknown; error?: { message: string } };
        const cb = pending.get(resp.id);
        if (cb) {
          pending.delete(resp.id);
          if (resp.error) cb({ __error: resp.error.message });
          else cb(resp.result);
        }
      } catch {
        // ignore
      }
    });
    sock.on('error', reject);
    sock.once('connect', () => {
      const send = (method: string, params: unknown) =>
        new Promise<string>((res, rej) => {
          const id = nextId++;
          pending.set(id, (r) => {
            const err = (r as { __error?: string }).__error;
            if (err) rej(new Error(err));
            else res(String((r as { id: string }).id ?? id));
          });
          sock.write(JSON.stringify({ id, method, params }) + '\n');
        });
      resolve({
        publish: (topic, kind, payload, from) =>
          send('publish', { topic, kind, payload, from }) as Promise<string>,
        history: async (filter = {}) => {
          const r = await send('history', filter);
          return r as unknown as unknown[];
        },
        inspect: async () => {
          const r = await send('inspect', {});
          return r;
        },
        close: () => sock.destroy(),
      });
    });
  });
}
