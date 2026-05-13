---
name: doppel-dev-workflow
description: Local development workflow for the doppel TypeScript monorepo. Use when setting up the repo, choosing commands, validating changes, or making general non-domain-specific changes.
---

# Doppel Dev Workflow

Use this skill for repo orientation, command selection, and implementation
hygiene.

## Repo Shape

- `packages/doppel-core` contains the publishable engine (terminal sessions,
  schedules, persistence) exposed as `@c3-oss/doppel-core`.
- `apps/server` contains the Fastify HTTP server and tRPC adapter built on
  top of the engine.
- `apps/web` contains the Vite React client.
- `apps/cli` contains the Commander CLI.
- `.codex/skills` is the canonical skill directory.
- `.codex/agents` and `.claude/agents` contain local specialists.
- The daemon/tRPC server defaults to port `3000`; its `/session-view` route is
  the terminal-only browser view used by `doppel session view`.
- The administrative Web UI is `apps/web` and is served separately with
  `doppel-server start --web-ui` on port `3001` by default.

## Commands

Prefer `devbox shell` before running project commands.

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm lint
pnpm lint:fix
```

Use focused workspace commands while iterating:

```bash
pnpm --filter @c3-oss/doppel-server test
pnpm --filter @c3-oss/doppel typecheck
pnpm --filter @c3-oss/doppel-web build
```

## Rules

- Keep server behavior in `apps/server` or shared packages.
- Keep CLI and web clients thin unless product requirements say otherwise.
- Do not edit generated output by hand.
- Keep publishable package manifests accurate for `@c3-oss/doppel-core`,
  `@c3-oss/doppel-server`, and `@c3-oss/doppel`.
