---
name: doppel-server-trpc
description: Server and tRPC workflow for doppel. Use when changing Fastify routes, tRPC procedures, server exports, or API contracts.
---

# Doppel Server And tRPC

## Start Here

- Read `apps/server/src/index.ts`.
- Inspect `apps/server/src/http/server.ts` for HTTP wiring.
- Inspect `apps/server/src/trpc/router.ts` for the public tRPC surface.

## Rules

- Preserve the exported `AppRouter` type for web and CLI consumers.
- Add server logic behind procedures or HTTP routes before adding client code.
- Validate input and output with Zod for public procedures.
- Keep tests next to server code as `*.test.ts`.
- Keep the daemon/tRPC surface separate from the administrative Web UI:
  `/session-view` is a terminal-only daemon page, while `--web-ui` serves
  `apps/web` on a separate port.

## Validation

```bash
pnpm --filter @c3-oss/doppel-server typecheck
pnpm --filter @c3-oss/doppel-server test
pnpm --filter @c3-oss/doppel-server lint
```
