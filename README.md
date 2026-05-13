# doppel - Persistent terminals for scripts, agents, and scheduled work

Doppel keeps terminal sessions alive behind a small daemon, then gives you a CLI,
HTTP/tRPC API, WebSocket terminal stream, browser terminal view, and embeddable
Node.js engine to control them.

Use it when a workflow needs more than `exec`: dev servers that should stay up,
agent-owned shell sessions, commands that should be sent into an existing
terminal, or cron-like jobs that should run in a durable local automation layer.

CLI | daemon | web UI | embeddable engine | schedules | JSON output

## Install

Doppel is published on npm as three packages:

- [`@c3-oss/doppel`](https://www.npmjs.com/package/@c3-oss/doppel) - the
  `doppel` CLI.
- [`@c3-oss/doppel-server`](https://www.npmjs.com/package/@c3-oss/doppel-server)
  - the `doppel-server` daemon and HTTP/tRPC server.
- [`@c3-oss/doppel-core`](https://www.npmjs.com/package/@c3-oss/doppel-core) -
  the embeddable terminal and schedule engine.

Install the CLI and server globally:

```bash
npm install -g @c3-oss/doppel @c3-oss/doppel-server
```

Run the published binaries through `npx` by command name:

```bash
npx doppel-server start --daemon
npx doppel health
```

Install the core package when embedding Doppel in an app:

```bash
npm install @c3-oss/doppel-core
```

Requires Node.js 22+.

## Quickstart

Start the daemon in the background:

```bash
doppel-server start --daemon
```

Check that the server is reachable:

```bash
doppel health
```

Create a named terminal session and send work into it:

```bash
doppel session start dev
doppel send-cmd --session dev "pnpm dev"
```

Watch the session in your terminal, or open the browser terminal view:

```bash
doppel session watch dev
doppel session view dev
```

Schedule a command:

```bash
doppel schedule add \
  --name daily-health \
  --command "pnpm test" \
  --cron "0 9 * * *" \
  --enabled
```

Use JSON output for scripts:

```bash
doppel session list --json
doppel schedule list --json
doppel-server status --json
```

## Features

- Persistent named terminal sessions managed by a local daemon.
- CLI commands for health checks, session lifecycle, terminal input, and
  schedules.
- Browser session view for a single terminal via `/session-view`.
- Optional administrative web UI served on a separate port.
- HTTP and tRPC API for structured clients.
- WebSocket terminal streams for interactive browser clients.
- Scheduled commands that run in either ephemeral processes or existing
  sessions.
- Human-readable tables by default, JSON output for automation.
- Embeddable core engine through `@c3-oss/doppel-core`.

## CLI

```bash
doppel health

doppel session list
doppel session start [name]
doppel session watch [name]
doppel session view [name]
doppel session kill [name]

doppel send-cmd [-s name] "command text"
doppel send-key [-s name] enter

doppel schedule list
doppel schedule add --name name --command "cmd" --cron "*/5 * * * *"
doppel schedule enable <id>
doppel schedule disable <id>
doppel schedule run <id>
doppel schedule remove <id>
```

Pass `--url` to target a non-default server:

```bash
doppel health --url http://localhost:3000
```

Pass `--json` on supported commands when another program should consume the
output.

## Server

`doppel-server start` runs the daemon HTTP/tRPC server on port `3000` by default.
It exposes:

- `/health`
- `/trpc`
- `/ws/terminal/:sessionName`
- `/session-view`

Run it in the foreground:

```bash
doppel-server start
```

Run it as a background daemon:

```bash
doppel-server start --daemon
```

Check or stop the daemon:

```bash
doppel-server status
doppel-server stop
```

Server request logs are pretty-printed by default. Use `--json-logs` for raw
newline-delimited JSON logs, or `--no-logger` to disable request logging.

## Web UI

`doppel session view [name]` opens the minimal terminal-only page on the daemon
port. It is not the administrative web UI.

Start the administrative web UI explicitly:

```bash
doppel-server start --web-ui
```

By default, the web UI binds to port `3001` and talks to the daemon at
`http://localhost:3000`.

Useful overrides:

```bash
doppel-server start \
  --web-ui \
  --web-ui-port 3001 \
  --web-ui-host 127.0.0.1 \
  --web-ui-server-url http://localhost:3000
```

## Embedding

Use `@c3-oss/doppel-core` when you want the engine without the daemon binary:

```ts
import { createDoppel } from '@c3-oss/doppel-core';

const doppel = createDoppel();

const session = doppel.terminal.ensure({ name: 'dev' });
doppel.terminal.send(session.name, 'pnpm test\n');

const result = await doppel.terminal.runEphemeral('printf doppel');
console.log(result.output);

doppel.close();
```

Use `@c3-oss/doppel-server` when you want the Fastify/tRPC adapter:

```ts
import { startServer, type AppRouter } from '@c3-oss/doppel-server';
```

## Packages

- `@c3-oss/doppel` publishes the `doppel` CLI.
- `@c3-oss/doppel-server` publishes the `doppel-server` daemon and server
  library.
- `@c3-oss/doppel-core` publishes the transport-agnostic engine.

## Monorepo

This repository is a Node 22 TypeScript monorepo:

- `packages/doppel-core` - terminal sessions, schedules, and persistence.
- `apps/server` - Fastify HTTP server, tRPC router, daemon CLI, and web UI host.
- `apps/web` - Vite React administrative web UI.
- `apps/cli` - Commander-based `doppel` CLI.

Development setup:

```bash
devbox shell
pnpm install
```

Without Devbox, use Node.js 22 and pnpm 10.

Common commands:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm lint
pnpm lint:fix
pnpm clean
```

Focused examples:

```bash
pnpm --filter @c3-oss/doppel-server dev
pnpm --filter @c3-oss/doppel health --url http://localhost:3000
pnpm --filter @c3-oss/doppel-web dev
```

## Release

The root package is private. Publishable packages are:

- `@c3-oss/doppel`
- `@c3-oss/doppel-core`
- `@c3-oss/doppel-server`

Use Changesets for releases:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

## About

Doppel is a small control plane for terminals: keep sessions alive, send them
work, observe their output, and schedule commands without rebuilding that layer
in every tool.
