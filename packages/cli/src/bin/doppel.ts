#!/usr/bin/env node
import { runCli } from '../main.js';

runCli(process.argv).catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
