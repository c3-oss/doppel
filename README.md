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
