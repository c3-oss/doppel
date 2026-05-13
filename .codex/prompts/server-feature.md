# Server Feature Prompt

Implement the requested server feature in `apps/server` first. Update tRPC
procedures or HTTP routes, validate public inputs and outputs with Zod, and add
focused Vitest coverage before touching CLI or web clients.
Keep daemon/tRPC routes separate from the administrative Web UI: session viewing
belongs to the daemon `/session-view`, while `--web-ui` serves `apps/web` on a
separate port.
