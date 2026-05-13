#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';

import { startServer } from '../http/server.js';
import { getDefaultDataDir } from '../schedules/store.js';

interface ServerCommandOptions {
  daemon?: boolean;
  dataDir?: string;
  host?: string;
  logger?: boolean;
  port?: string;
  url?: string;
  webRoot?: string;
}

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;

async function main(argv: string[]): Promise<void> {
  const program = new Command()
    .name('doppel-server')
    .description('Doppel daemon server.')
    .version('0.1.0', '-v, --version');

  program
    .command('start')
    .description('Start the Doppel server.')
    .option('--daemon', 'Run in the background.')
    .option('--host <host>', 'Host to bind.', process.env.HOST ?? DEFAULT_HOST)
    .option('--port <port>', 'Port to bind.', process.env.PORT ?? String(DEFAULT_PORT))
    .option('--data-dir <dir>', 'Directory for daemon state.', getDefaultDataDir())
    .option('--web-root <dir>', 'Directory containing built web UI assets.')
    .option('--logger', 'Enable Fastify logger.')
    .action(async (options: ServerCommandOptions) => {
      const port = parsePort(options.port);
      const dataDir = options.dataDir ?? getDefaultDataDir();
      const host = options.host ?? DEFAULT_HOST;

      if (options.daemon === true) {
        startDaemon({
          ...options,
          dataDir,
          host,
          port: String(port),
        });
        return;
      }

      await startServer({
        dataDir,
        host,
        logger: options.logger,
        port,
        webRoot: options.webRoot,
      });
    });

  program
    .command('status')
    .description('Check daemon status.')
    .option('--data-dir <dir>', 'Directory for daemon state.', getDefaultDataDir())
    .option('--url <url>', 'Server base URL.', `http://localhost:${DEFAULT_PORT}`)
    .action(async (options: ServerCommandOptions) => {
      const pid = readPid(options.dataDir ?? getDefaultDataDir());
      const health = await readHealthStatus(options.url ?? `http://localhost:${DEFAULT_PORT}`);

      if (health.ok) {
        process.stdout.write(
          `${JSON.stringify({
            ok: true,
            pid,
            service: health.service,
          })}\n`,
        );
        return;
      }

      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          pid,
          error: health.error,
        })}\n`,
      );
    });

  program
    .command('stop')
    .description('Stop daemon by pidfile.')
    .option('--data-dir <dir>', 'Directory for daemon state.', getDefaultDataDir())
    .action((options: ServerCommandOptions) => {
      const dataDir = options.dataDir ?? getDefaultDataDir();
      const pid = readPid(dataDir);

      if (!pid) {
        process.stdout.write('{"stopped":false,"reason":"pidfile-not-found"}\n');
        return;
      }

      try {
        process.kill(pid, 'SIGTERM');
        fs.rmSync(getPidPath(dataDir), { force: true });
        process.stdout.write(`${JSON.stringify({ stopped: true, pid })}\n`);
      } catch (error) {
        fs.rmSync(getPidPath(dataDir), { force: true });
        process.stdout.write(
          `${JSON.stringify({
            stopped: false,
            pid,
            reason: getErrorMessage(error),
          })}\n`,
        );
      }
    });

  await program.parseAsync(withDefaultCommand(argv));
}

function startDaemon(
  options: Required<Pick<ServerCommandOptions, 'dataDir' | 'host' | 'port'>> &
    Pick<ServerCommandOptions, 'logger' | 'webRoot'>,
): void {
  fs.mkdirSync(options.dataDir, { recursive: true });
  const logPath = path.join(options.dataDir, 'doppel-server.log');
  const logFd = fs.openSync(logPath, 'a');
  const args = [
    ...process.execArgv,
    process.argv[1]!,
    'start',
    '--host',
    options.host,
    '--port',
    options.port,
    '--data-dir',
    options.dataDir,
  ];

  if (options.webRoot) {
    args.push('--web-root', options.webRoot);
  }

  if (options.logger === true) {
    args.push('--logger');
  }

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });

  child.unref();
  fs.writeFileSync(getPidPath(options.dataDir), `${child.pid}\n`);
  process.stdout.write(
    `${JSON.stringify({
      daemon: true,
      logPath,
      pid: child.pid,
    })}\n`,
  );
}

function withDefaultCommand(argv: string[]): string[] {
  return argv.length <= 2 ? [...argv, 'start'] : argv;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

function getPidPath(dataDir: string): string {
  return path.join(dataDir, 'doppel-server.pid');
}

function readPid(dataDir: string): number | null {
  try {
    const value = fs.readFileSync(getPidPath(dataDir), 'utf8').trim();
    const pid = Number(value);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

type HealthStatus =
  | {
      ok: true;
      service: string;
    }
  | {
      ok: false;
      error: string;
    };

async function readHealthStatus(serverUrl: string): Promise<HealthStatus> {
  try {
    const response = await fetch(new URL('/health', serverUrl));

    if (!response.ok) {
      return {
        ok: false,
        error: `Health check failed with HTTP ${response.status}`,
      };
    }

    return (await response.json()) as { ok: true; service: string };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main(process.argv).catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
