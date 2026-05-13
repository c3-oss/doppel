# @c3-oss/doppel - CLI for persistent terminal automation

`@c3-oss/doppel` publishes the `doppel` command line client. It talks to a
running Doppel daemon and gives scripts and humans a stable interface for
terminal sessions, input, schedules, and JSON output.

## Install

```bash
npm install -g @c3-oss/doppel
```

Run through `npx` by binary name:

```bash
npx doppel health
```

Requires a running `doppel-server` from
[`@c3-oss/doppel-server`](https://www.npmjs.com/package/@c3-oss/doppel-server).

## Quickstart

```bash
doppel health

doppel session start dev
doppel send-cmd --session dev "pnpm dev"
doppel session watch dev
doppel session view dev

doppel schedule list
doppel schedule add --name daily-health --command "pnpm test" --cron "0 9 * * *" --enabled
```

Use `--json` on supported commands when another program should consume the
output:

```bash
doppel session list --json
doppel schedule list --json
```

## Commands

```bash
doppel health
doppel session list|start|watch|view|kill
doppel send-cmd
doppel send-key
doppel schedule list|add|enable|disable|run|remove
```

Pass `--url` to target a non-default server:

```bash
doppel health --url http://localhost:3000
```

## Links

- Repository: https://github.com/c3-oss/doppel
- Server package: https://www.npmjs.com/package/@c3-oss/doppel-server
- Core package: https://www.npmjs.com/package/@c3-oss/doppel-core
