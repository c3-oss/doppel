#!/usr/bin/env node
import { startServer } from '../http/server.js';

startServer().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
