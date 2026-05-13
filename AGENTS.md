# Repository Guidelines

## Project Structure & Module Organization

`doppel` is a Node 22 TypeScript monorepo. Server code lives in `apps/server`,
web code in `apps/web`, and the CLI in `packages/cli`. Shared package code
should be added under `packages/*` only when at least two workspaces need it.
Generated output belongs in `dist/`, `coverage/`, or `.turbo/`.

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

The server is the main implementation surface. Keep protocol and domain logic in
`apps/server` or shared packages; the CLI and web app should call server-facing
APIs rather than duplicate server behavior. Keep the public server type export
`AppRouter` stable for tRPC consumers.

## Testing Guidelines

Vitest tests live next to code as `*.test.ts`. Server tests should cover HTTP
routes and tRPC callers. CLI tests should isolate network access behind
injectable helpers. Web tests are optional until interactive behavior grows, but
`pnpm --filter @c3-oss/doppel-web build` must keep passing.

## Commit & Pull Request Guidelines

Use commitlint scopes: `workspace`, `server`, `web`, `cli`, `agents`, `docs`,
`test`, `deps`, `release`, and `infra`. Keep commits focused and include test
results in PR descriptions.

## Agent-Specific Instructions

Do not edit `dist/`, `coverage/`, `node_modules/`, `.devbox/`, or `.turbo/` by
hand. `.codex/skills` is the canonical skill home. `.claude/agents` mirrors
specialists for Claude Code, but skills should not be duplicated under
`.claude/skills`.
