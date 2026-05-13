---
name: doppel-commits
description: Commit workflow for doppel. Use when preparing, splitting, staging, writing, amending, or reviewing git commits, commit messages, or commit history.
---

# Doppel Commits

## Core Rule

Never make exactly one commit for a commit request. Commit operations must
produce multiple commits (`N >= 2`) split by context, subsystem, or type of
change.

If the current diff appears to contain only one coherent change, do not collapse
it into one commit. Split real secondary context such as tests, docs, prompts,
agent instructions, dependency metadata, or follow-up cleanup when present. If
there is no truthful second context to commit, stop and explain that another
coherent change is required before committing under this repository policy.

## Commit Shape

- Follow Conventional Commits: `type(scope): summary`.
- Use repository scopes from `AGENTS.md`: `workspace`, `server`, `web`, `cli`,
  `agents`, `docs`, `test`, `deps`, `release`, and `infra`.
- Keep each commit focused on one context or type of change.
- Do not mix unrelated user changes into your commits.
- Do not revert or rewrite user changes unless explicitly asked.
- Prefer `git add <path>` or `git add -p` over broad staging.

## Message Body

Every commit should include a meaningful body, not only a subject.

Include:

- what changed;
- why it changed;
- important behavior or compatibility notes;
- validation run, or why validation was not run.

Use non-interactive commits:

```bash
git commit \
  -m "type(scope): concise summary" \
  -m "Explain the change and the reason for this commit.

Mention affected behavior, interfaces, or constraints.

Validation: pnpm test"
```

## Workflow

1. Inspect `git status --short` and relevant diffs before staging.
2. Identify natural commit groups by subsystem/type.
3. Stage only the files or hunks for the current group.
4. Review `git diff --cached` before committing.
5. Create at least two commits with detailed bodies.
6. After committing, show the resulting `git log --oneline -n <N>` and any
   remaining worktree changes.

## Splitting Heuristics

Good split dimensions:

- implementation vs tests;
- server vs CLI vs web;
- runtime behavior vs documentation/agent instructions;
- dependency or lockfile metadata vs code;
- refactor/cleanup vs feature behavior.

Avoid splitting only to satisfy count when the commits become misleading. Each
commit must remain reviewable and truthful.
