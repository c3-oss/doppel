---
name: doppel-web
description: Web workflow for doppel. Use when changing the Vite React client, tRPC React client, or browser UI.
---

# Doppel Web

## Start Here

- `apps/web/src/App.tsx` wires providers.
- `apps/web/src/trpc.ts` defines the typed tRPC client.
- `apps/web/src/pages/` contains route-level screens.

## Rules

- Treat the server as the source of truth.
- Import `AppRouter` as a type from `@c3-oss/doppel-server`.
- Keep controls accessible and stable across desktop and mobile widths.
- Use lucide icons for icon buttons when an icon exists.

## Validation

```bash
pnpm --filter @c3-oss/doppel-web typecheck
pnpm --filter @c3-oss/doppel-web build
pnpm --filter @c3-oss/doppel-web lint
```
