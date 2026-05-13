# @c3-oss/doppel-server - Daemon and API server for Doppel

`@c3-oss/doppel-server` publishes the `doppel-server` binary and server library.
It runs the Doppel daemon, exposes HTTP/tRPC and WebSocket surfaces, serves the
single-session browser terminal view, and can host the administrative web UI.

## Install

```bash
npm install -g @c3-oss/doppel-server
```

Run through `npx` by binary name:

```bash
npx doppel-server start --daemon
```

## Quickstart

Start the daemon:

```bash
doppel-server start --daemon
```

Check status:

```bash
doppel-server status
doppel-server status --json
```

Serve the administrative web UI:

```bash
doppel-server start --web-ui
```

Stop the daemon:

```bash
doppel-server stop
```

## Runtime

By default, the daemon binds to port `3000` and exposes:

- `/health`
- `/trpc`
- `/ws/terminal/:sessionName`
- `/session-view`

The administrative web UI binds to port `3001` when enabled and talks to the
daemon at `http://localhost:3000`.

Useful options:

```bash
doppel-server start --host 127.0.0.1 --port 3000
doppel-server start --web-ui --web-ui-port 3001
doppel-server start --json-logs
doppel-server start --no-logger
```

## Library API

```ts
import {
  createServer,
  startServer,
  type AppRouter,
} from '@c3-oss/doppel-server';
```

Use `@c3-oss/doppel-core` directly when you want the terminal and schedule
engine without the HTTP server.

## Links

- Repository: https://github.com/c3-oss/doppel
- CLI package: https://www.npmjs.com/package/@c3-oss/doppel
- Core package: https://www.npmjs.com/package/@c3-oss/doppel-core
