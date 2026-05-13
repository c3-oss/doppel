# Claude Notes

Pointer doc for Claude Code agents working in `doppel`.

Read `AGENTS.md` first. It is the canonical instruction layer for project
structure, commands, testing, and agent-specific rules.

## Bootstrap

1. `AGENTS.md` - canonical repository guidance.
2. `README.md` - user-facing setup and command surface.
3. Relevant `.codex/skills/*/SKILL.md` files for the subsystem being changed.

## Runtime surfaces

- `doppel session view` is a daemon-hosted, terminal-only browser view.
- `apps/web` is the administrative Web UI and is served separately via
  `doppel-server start --web-ui`.
- Do not route session-view work through the administrative Web UI unless the
  product requirement explicitly changes this boundary.

## Claude Code specifics

- Use Claude Code's native subagent feature when session policy allows it.
- Specialists live under `.claude/agents/` and mirror `.codex/agents/`.
- Skills are canonical under `.codex/skills/`; do not duplicate them in
  `.claude/skills/`.
- Use `devbox shell` when possible and prefer `pnpm typecheck`, `pnpm test`,
  and `pnpm lint` before finishing meaningful changes.
- Serialize shared-checkout mutations such as edits, generated output updates,
  staging, committing, rebasing, branch switching, and pushing.
