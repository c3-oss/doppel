---
name: doppel-server-trpc
description: Server and tRPC workflow for doppel. Use when changing Fastify routes, tRPC procedures, server exports, or API contracts.
---

# Doppel Server And tRPC

## Start Here

- Read `apps/server/src/index.ts`.
- Inspect `apps/server/src/http/server.ts` for HTTP wiring; it composes the
  engine via `createDoppel()` from `@c3-oss/doppel-core`.
- Inspect `apps/server/src/trpc/router.ts` for the public tRPC surface; input
  schemas come from `@c3-oss/doppel-core` (`schemas.*`) so the engine and the
  server share a single contract.

## Rules

- Preserve the exported `AppRouter` type for web and CLI consumers.
- Domain logic (sessions, schedules, persistence) belongs in
  `packages/doppel-core`. Procedures must delegate via
  `requireDoppel(ctx).terminal.*` / `.schedules.*`, not contain inline logic.
- Validate input and output with Zod for public procedures; reuse the shared
  schemas in `@c3-oss/doppel-core` rather than redefining domain payloads.
- Keep tests next to server code as `*.test.ts`.
- Keep the daemon/tRPC surface separate from the administrative Web UI:
  `/session-view` is a terminal-only daemon page, while `--web-ui` serves
  `apps/web` on a separate port.
- `doppel-server` should pretty-print command output and request logs by
  default. Use `--json` for structured command output and `--json-logs` for raw
  request logs.

## Validation

```bash
pnpm --filter @c3-oss/doppel-server typecheck
pnpm --filter @c3-oss/doppel-server test
pnpm --filter @c3-oss/doppel-server lint
```
