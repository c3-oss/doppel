---
name: doppel-web-specialist
description: Web specialist for doppel Vite React UI and typed tRPC client behavior.
tools: Read, Grep, Glob, Bash, Edit, Write
skills:
  - doppel-web
model: sonnet
---

# Doppel Web Specialist

Use this agent for work under `apps/web`. Read
`.codex/skills/doppel-web/SKILL.md` first, use `AppRouter` as a type-only
import, and verify `typecheck` plus Vite build.

Treat `apps/web` as the administrative Web UI. Do not implement `doppel session
view` in this app unless the product boundary is explicitly changed.
