# doppel

`doppel` is a server-first TypeScript monorepo with a publishable HTTP/tRPC
server, a publishable CLI client, and a private React web client.

## Layout

- `apps/server` - Fastify HTTP server and tRPC router.
- `apps/web` - Vite React client for browser workflows.
- `packages/cli` - Commander-based `doppel` command line client.
- `.codex/skills` - canonical agent skills for repository work.
- `.codex/agents` and `.claude/agents` - local specialist agents.

## Setup

Use Devbox when available:

```bash
devbox shell
pnpm install
```

Without Devbox, use Node 22 and pnpm 10.

## Commands

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
