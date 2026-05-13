---
name: doppel-core
description: Doppel engine package. Use when changing terminal sessions, schedules, persistence, domain schemas, or the publishable @c3-oss/doppel-core surface.
---

# Doppel Core

## Start Here

- `packages/doppel-core/src/index.ts` is the published surface.
- `packages/doppel-core/src/doppel.ts` exposes `createDoppel({ ... })` and the
  `Doppel` interface (terminal, schedules, combined `close()`).
- `packages/doppel-core/src/terminal/pty-session-manager.ts` owns PTY session
  lifecycle.
- `packages/doppel-core/src/schedules/store.ts` owns better-sqlite3 persistence.
- `packages/doppel-core/src/schedules/scheduler.ts` orchestrates node-cron
  tasks against the store and terminal manager.
- `packages/doppel-core/src/schemas.ts` is the single source of truth for
  domain Zod schemas consumed by `apps/server` (tRPC) and tests.

## Rules

- Core must remain transport-agnostic: no Fastify, no tRPC, no HTTP, no
  WebSocket. Anything that talks over a wire stays in `apps/server`.
- Public surface changes ripple to npm consumers. Touch `index.ts` only when
  intentional; prefer additive exports.
- New domain payloads belong in `schemas.ts`, then imported by router
  procedures in `apps/server/src/trpc/router.ts`.
- Keep `createDoppel` defaults sensible — embedders should be able to call
  `createDoppel()` with no options and get a working instance.
- `close()` must be idempotent-friendly in spirit (always tears down schedules
  → terminal → store in that order).

## Testing

- `packages/doppel-core/src/__tests__/embedded.test.ts` validates the embedded
  entry path. Add focused tests there when changing the facade or DX.
- Unit tests for each subsystem live alongside the subsystem when needed.
