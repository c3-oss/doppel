# @c3-oss/doppel-core - Embeddable terminal and schedule engine

`@c3-oss/doppel-core` is the transport-agnostic engine behind Doppel. It manages
named PTY sessions, ephemeral command runs, cron-backed schedules, and local
persistence without starting the published daemon server.

Use it when your application wants Doppel's terminal automation model as a
library.

## Install

```bash
npm install @c3-oss/doppel-core
```

Requires Node.js 22+.

## Quickstart

```ts
import { createDoppel } from '@c3-oss/doppel-core';

const doppel = createDoppel();

const session = doppel.terminal.ensure({ name: 'dev' });
doppel.terminal.send(session.name, 'pnpm test\n');

const result = await doppel.terminal.runEphemeral('printf doppel');
console.log(result.output);

doppel.close();
```

## API shape

```ts
const doppel = createDoppel({
  dataDir: './.doppel',
});

doppel.terminal.ensure({ name: 'dev' });
doppel.terminal.send('dev', 'echo hi\n');
await doppel.terminal.runEphemeral('echo once');

doppel.schedules.create({
  name: 'daily-health',
  cron: '0 9 * * *',
  command: 'pnpm test',
  enabled: true,
});

doppel.close();
```

The engine exposes:

- `terminal` for named PTY sessions, input, output history, and ephemeral runs.
- `schedules` for cron-backed scheduled commands.
- `close()` for shutting down terminal and persistence resources.

## Related packages

- `@c3-oss/doppel-server` wraps this engine with Fastify, tRPC, WebSocket, and
  daemon commands.
- `@c3-oss/doppel` is the CLI client for a running Doppel server.

## Links

- Repository: https://github.com/c3-oss/doppel
- CLI package: https://www.npmjs.com/package/@c3-oss/doppel
- Server package: https://www.npmjs.com/package/@c3-oss/doppel-server
