# Repository Guidelines

## Project Structure & Module Organization

`doppel` is a Node 22 TypeScript monorepo. The core engine (terminal sessions,
schedules, persistence) lives in `packages/doppel-core` and is publishable as
`@c3-oss/doppel-core`. `apps/server` is the Fastify/tRPC adapter on top of the
engine, `apps/web` is the administrative React UI, and `apps/cli` is the
Commander-based client. Any additional shared package belongs under
`packages/*` only when at least two workspaces need it. Generated output
belongs in `dist/`, `coverage/`, or `.turbo/`.

## Build, Test, and Development Commands

Use pnpm from a `devbox shell` when possible.

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` runs persistent workspace dev tasks through Turbo.
- `pnpm build` builds every workspace.
- `pnpm typecheck` runs TypeScript checks.
- `pnpm test` runs Vitest suites.
- `pnpm test:coverage` runs Vitest coverage.
- `pnpm lint` checks Biome formatting and lint rules.
- `pnpm lint:fix` applies safe Biome fixes.
- `pnpm clean` removes generated outputs.

## Coding Style & Naming Conventions

Use strict TypeScript, ESM imports, and NodeNext modules for Node workspaces.
Biome enforces 2-space indentation, single quotes, semicolons, trailing commas,
and a 100-column line width. Prefer named exports and `import type` for
type-only imports. File names should be lowercase kebab-case unless a framework
convention requires otherwise.

## Architecture Conventions

The engine in `packages/doppel-core` owns the domain (terminal sessions,
schedules, persistence) and is transport-agnostic. `apps/server` is a thin
Fastify/tRPC adapter that composes the engine via `createDoppel()` and exposes
it over HTTP/WebSocket. New domain logic belongs in core; the CLI and web app
should call server-facing APIs rather than duplicate server behavior. Keep the
public server type export `AppRouter` stable for tRPC consumers, and the public
core surface (`createDoppel`, `Doppel`, `schemas.*`) stable for embedders.

Keep runtime browser surfaces distinct. `doppel session view` opens the daemon's
minimal `/session-view` terminal-only page on the daemon/tRPC port. The
administrative Web UI in `apps/web` is served only when `doppel-server start
--web-ui` is used, and it must bind to a separate web UI port.

## Testing Guidelines

Vitest tests live next to code as `*.test.ts`. Server tests should cover HTTP
routes and tRPC callers. CLI tests should isolate network access behind
injectable helpers. Web tests are optional until interactive behavior grows, but
`pnpm --filter @c3-oss/doppel-web build` must keep passing.

## Commit & Pull Request Guidelines

Use commitlint scopes: `workspace`, `server`, `web`, `cli`, `core`, `agents`,
`docs`, `test`, `deps`, `release`, and `infra`. Keep commits focused and
include test results in PR descriptions.

When asked to commit, use `.codex/skills/doppel-commits/SKILL.md`. Never make
exactly one commit for a commit request; split changes into multiple
Conventional Commits by context, subsystem, or change type, with detailed
message bodies.

## Agent-Specific Instructions

Do not edit `dist/`, `coverage/`, `node_modules/`, `.devbox/`, or `.turbo/` by
hand. `.codex/skills` is the canonical skill home. `.claude/agents` mirrors
specialists for Claude Code, but skills should not be duplicated under
`.claude/skills`.
