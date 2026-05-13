---
name: doppel-cli
description: CLI workflow for doppel. Use when adding commands, command options, output formats, or client-side server calls.
---

# Doppel CLI

## Start Here

- `packages/cli/src/main.ts` wires the command tree.
- `packages/cli/src/commands/` contains command implementations.
- `packages/cli/src/bin/doppel.ts` is the executable entrypoint.

## Rules

- Keep commands small and test helpers directly.
- Hide network calls behind injectable functions when possible.
- Use human-readable stdout by default. List commands should render
  terminal-width-aware tables; mutating commands should print short status
  messages.
- Add `--json` for commands that return structured data, and keep JSON compact
  and deterministic for scripts.
- `doppel session view` must open the daemon `/session-view` terminal-only page,
  not the administrative Web UI.

## Validation

```bash
pnpm --filter @c3-oss/doppel typecheck
pnpm --filter @c3-oss/doppel test
pnpm --filter @c3-oss/doppel lint
```
