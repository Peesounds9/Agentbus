# @agentbus/cli

Command-line tool for AgentBus.

## Commands

```bash
agentbus inspect                       # show bus state, subscribers, queue depths
agentbus tail [--kind=fill] [-n=10]    # print recent messages
agentbus publish <topic> --kind=...    # publish a message (JSON from --json or stdin)
agentbus run [--mode=paper|live]       # start the runtime
agentbus backtest <log.jsonl>          # replay a session, print stats
agentbus install-skill <dir>           # drop the agentbus-bitget skill into a folder
```

## Install

The CLI ships with the monorepo. To use it standalone:

```bash
# After pnpm install in the workspace:
pnpm --filter agentbus-cli build
node packages/agentbus-cli/dist/cli.js --help

# Or install globally:
pnpm add -g agentbus-cli
agentbus --help
```

## Examples

```bash
# Publish a manual signal
agentbus publish signal.btc --kind=signal --json '{"symbol":"BTCUSDT","direction":"long","confidence":0.8,"rationale":"manual"}'

# Inspect a running daemon (over TCP)
agentbus inspect --host=127.0.0.1 --port=8788

# Replay a recorded session
agentbus backtest examples/two-agent-demo/session.jsonl
```
