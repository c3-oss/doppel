# doppel

`doppel` is terminal automation infrastructure for Node.js. It runs a local
daemon that keeps named terminal sessions alive, exposes them over HTTP/tRPC and
WebSocket, and lets CLI, browser, and embedded integrations create sessions,
send commands, stream terminal output, and run scheduled jobs.

Use it when a workflow needs a durable terminal process instead of a one-off
command: long-running dev servers, repeatable maintenance commands, agent-owned
shell sessions, or cron-like tasks that should execute inside either a fresh
process or an existing terminal session.

## Features

- Persistent named terminal sessions backed by a daemon process.
- CLI commands to start, list, watch, view, kill, and send input to sessions.
- Scheduled commands with ephemeral and session-backed execution modes.
- HTTP, tRPC, and WebSocket server surfaces for clients and integrations.
- Minimal browser terminal view for a single session.
- Optional administrative Web UI served on a separate port.
- Embeddable core engine for applications that want Doppel without the server
  binary.

## Quick start

Start the daemon:

```bash
doppel-server start --daemon
```

Create or ensure a terminal session:

```bash
doppel session start default
```

Send a command to that session:

```bash
doppel send-cmd "pnpm dev"
```

Watch the session in the current terminal, or open the browser terminal view:

```bash
doppel session watch default
doppel session view default
```

Add a scheduled command:

```bash
doppel schedule add --name "daily-health" --command "pnpm test" --cron "0 9 * * *" --enabled
```

## Runtime surfaces

`doppel-server start` runs the daemon HTTP/tRPC server on port `3000` by
default. That server owns `/health`, `/trpc`, `/ws/terminal/:sessionName`, and
the minimal `/session-view` browser terminal used by `doppel session view`.
Server request logs are pretty-printed by default. Use `--json-logs` when raw
newline-delimited JSON logs are needed, or `--no-logger` to disable request
logging.

`doppel session view [name]` opens only a black terminal view for the selected
session. It is not the administrative Web UI.

To serve the administrative Web UI from `doppel-server`, start it explicitly on
a separate port:

```bash
doppel-server start --web-ui
```

The Web UI binds to port `3001` by default and talks to the daemon at
`http://localhost:3000`. Override with `--web-ui-port`, `--web-ui-host`, and
`--web-ui-server-url` when needed.

CLI commands print human-readable output by default. List commands render
terminal-width-aware tables, while mutating commands print short status
messages. Pass `--json` to commands such as `doppel health`,
`doppel session list`, `doppel session start`, `doppel session kill`,
`doppel send-cmd`, `doppel send-key`, and `doppel schedule ...` when scripts
need structured output.

Server management commands follow the same convention:

```bash
doppel-server status
doppel-server status --json
doppel-server start --daemon
doppel-server start --daemon --json
```

## Embedding

Applications can use the engine directly through `@c3-oss/doppel-core`:

```ts
import { createDoppel } from '@c3-oss/doppel-core';

const doppel = createDoppel();

const session = doppel.terminal.ensure({ name: 'default' });
doppel.terminal.send(session.name, 'pnpm test\n');

doppel.close();
```

Use the server package when you want the HTTP/tRPC adapter and daemon process,
and use the CLI package when you want a scriptable client for a running server.

## Monorepo layout

This repository is a Node 22 TypeScript monorepo:

- `packages/doppel-core` - publishable engine for sessions, schedules, and
  persistence.
- `apps/server` - Fastify HTTP server and tRPC adapter over the engine.
- `apps/web` - Vite React administrative Web UI.
- `apps/cli` - Commander-based `doppel` command line client.
- `.codex/skills` - canonical agent skills for repository work.
- `.codex/agents` and `.claude/agents` - local specialist agents.

## Development

Use Devbox when available:

```bash
devbox shell
pnpm install
```

Without Devbox, use Node 22 and pnpm 10.

Common workspace commands:

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

Workspace examples:

```bash
pnpm --filter @c3-oss/doppel-server dev
pnpm --filter @c3-oss/doppel health --url http://localhost:3000
pnpm --filter @c3-oss/doppel-web dev
```

## Release

The root package is private. Publishable packages are:

- `@c3-oss/doppel`
- `@c3-oss/doppel-server`

Use Changesets for releases:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```
