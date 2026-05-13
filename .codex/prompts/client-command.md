# CLI Command Prompt

Add or change the requested CLI command under `packages/cli/src/commands`.
Keep server calls behind injectable helpers, prefer deterministic JSON output
for data commands, and add focused tests for parsing and error behavior.
For `doppel session view`, open the daemon `/session-view` terminal-only page;
do not route users to the administrative Web UI.
