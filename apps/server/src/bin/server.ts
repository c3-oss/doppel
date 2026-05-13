#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { Command } from 'commander'

import { getDefaultDataDir } from '@c3-oss/doppel-core'

import { startServer, startWebUiServer } from '../http/server.js'

/**
 * Parsed options shared by the `doppel-server` CLI commands.
 *
 * Commander stores numeric options as strings here; command handlers validate
 * and convert ports before passing them into the server API.
 */
interface ServerCommandOptions {
  /** Run `start` in a detached child process and write a pidfile. */
  daemon?: boolean
  /** Directory for daemon state, logs, and the pidfile. */
  dataDir?: string
  /** Emit machine-readable command output on stdout. */
  json?: boolean
  /** Emit raw JSON Fastify request logs instead of pretty logs. */
  jsonLogs?: boolean
  /** Daemon host interface to bind. */
  host?: string
  /** Enable or disable the Fastify request logger. */
  logger?: boolean
  /** Daemon TCP port as parsed by Commander. */
  port?: string
  /** Base URL used by the `status` command for the health check. */
  url?: string
  /** Start the administrative web UI on a separate server. */
  webUi?: boolean
  /** Web UI host interface to bind. Defaults to the daemon host. */
  webUiHost?: string
  /** Web UI TCP port as parsed by Commander. */
  webUiPort?: string
  /** Daemon URL injected into the administrative web UI runtime config. */
  webUiServerUrl?: string
}

const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_PORT = 3000
const DEFAULT_WEB_UI_PORT = 3001

/** Configures the CLI and dispatches the selected command. */
async function main(argv: string[]): Promise<void> {
  const program = new Command()
    .name('doppel-server')
    .description('Doppel daemon server.')
    .version('0.1.0', '-v, --version')

  program
    .command('start')
    .description('Start the Doppel server.')
    .option('--daemon', 'Run in the background.')
    .option('--host <host>', 'Host to bind.', process.env.HOST ?? DEFAULT_HOST)
    .option('--port <port>', 'Port to bind.', process.env.PORT ?? String(DEFAULT_PORT))
    .option('--data-dir <dir>', 'Directory for daemon state.', getDefaultDataDir())
    .option('--web-ui', 'Serve the Doppel administrative web UI on a separate port.')
    .option('--web-ui-host <host>', 'Web UI host to bind.')
    .option('--web-ui-port <port>', 'Web UI port to bind.', process.env.WEB_UI_PORT ?? String(DEFAULT_WEB_UI_PORT))
    .option('--web-ui-server-url <url>', 'Daemon URL used by the administrative web UI.')
    .option('--json', 'Emit JSON output.')
    .option('--json-logs', 'Emit raw JSON request logs instead of pretty logs.')
    .option('--logger', 'Enable Fastify logger.')
    .option('--no-logger', 'Disable Fastify logger.')
    .action(async (options: ServerCommandOptions) => {
      const port = parsePort(options.port)
      const webUiPort = options.webUi === true ? parsePort(options.webUiPort, DEFAULT_WEB_UI_PORT) : DEFAULT_WEB_UI_PORT
      const dataDir = options.dataDir ?? getDefaultDataDir()
      const host = options.host ?? DEFAULT_HOST
      const webUiHost = options.webUiHost ?? host
      const daemonUrl = options.webUiServerUrl ?? getLocalServerUrl(host, port)
      const logger = options.logger ?? true
      const logFormat = options.jsonLogs === true ? 'json' : 'pretty'

      if (options.daemon === true) {
        startDaemon({
          ...options,
          dataDir,
          host,
          logger,
          port: String(port),
          webUiHost,
          webUiPort: String(webUiPort),
          webUiServerUrl: daemonUrl,
        })
        return
      }

      await startServer({
        dataDir,
        host,
        logger,
        logFormat,
        port,
      })

      if (options.webUi === true) {
        await startWebUiServer({
          daemonUrl,
          host: webUiHost,
          logger,
          logFormat,
          port: webUiPort,
        })
      }
    })

  program
    .command('status')
    .description('Check daemon status.')
    .option('--data-dir <dir>', 'Directory for daemon state.', getDefaultDataDir())
    .option('--url <url>', 'Server base URL.', `http://localhost:${DEFAULT_PORT}`)
    .option('--json', 'Emit JSON output.')
    .action(async (options: ServerCommandOptions) => {
      const pid = readPid(options.dataDir ?? getDefaultDataDir())
      const health = await readHealthStatus(options.url ?? `http://localhost:${DEFAULT_PORT}`)

      if (health.ok) {
        writeStatusOutput(
          {
            ok: true,
            pid,
            service: health.service,
          },
          options,
        )
        return
      }

      writeStatusOutput(
        {
          ok: false,
          pid,
          error: health.error,
        },
        options,
      )
    })

  program
    .command('stop')
    .description('Stop daemon by pidfile.')
    .option('--data-dir <dir>', 'Directory for daemon state.', getDefaultDataDir())
    .option('--json', 'Emit JSON output.')
    .action((options: ServerCommandOptions) => {
      const dataDir = options.dataDir ?? getDefaultDataDir()
      const pid = readPid(dataDir)

      if (!pid) {
        writeStopOutput(
          {
            stopped: false,
            reason: 'pidfile-not-found',
          },
          options,
        )
        return
      }

      try {
        process.kill(pid, 'SIGTERM')
        fs.rmSync(getPidPath(dataDir), { force: true })
        writeStopOutput({ stopped: true, pid }, options)
      } catch (error) {
        fs.rmSync(getPidPath(dataDir), { force: true })
        writeStopOutput(
          {
            stopped: false,
            pid,
            reason: getErrorMessage(error),
          },
          options,
        )
      }
    })

  await program.parseAsync(withDefaultCommand(argv))
}

/**
 * Starts the daemon in a detached child process.
 *
 * Protocol contract:
 * - stdout/stderr from the child are appended to `doppel-server.log`.
 * - the child pid is written to `doppel-server.pid` in `dataDir`.
 * - command output is written by the parent in either pretty or JSON form.
 */
function startDaemon(
  options: Required<Pick<ServerCommandOptions, 'dataDir' | 'host' | 'port'>> &
    Pick<ServerCommandOptions, 'json' | 'jsonLogs' | 'logger' | 'webUi' | 'webUiHost' | 'webUiPort' | 'webUiServerUrl'>,
): void {
  const entrypoint = process.argv[1]
  if (!entrypoint) {
    throw new Error('Unable to resolve current server entrypoint.')
  }

  fs.mkdirSync(options.dataDir, { recursive: true })
  const logPath = path.join(options.dataDir, 'doppel-server.log')
  const logFd = fs.openSync(logPath, 'a')
  const args = [
    ...process.execArgv,
    entrypoint,
    'start',
    '--host',
    options.host,
    '--port',
    options.port,
    '--data-dir',
    options.dataDir,
  ]

  if (options.logger === false) {
    args.push('--no-logger')
  }

  if (options.jsonLogs === true) {
    args.push('--json-logs')
  }

  if (options.webUi === true) {
    args.push('--web-ui')

    if (options.webUiHost) {
      args.push('--web-ui-host', options.webUiHost)
    }

    if (options.webUiPort) {
      args.push('--web-ui-port', options.webUiPort)
    }

    if (options.webUiServerUrl) {
      args.push('--web-ui-server-url', options.webUiServerUrl)
    }
  }

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })

  child.unref()
  fs.writeFileSync(getPidPath(options.dataDir), `${child.pid}\n`)
  writeDaemonStartOutput(
    {
      daemon: true,
      logPath,
      pid: child.pid,
      webUi: options.webUi === true,
    },
    options,
  )
}

/** Defaults an empty CLI invocation to `doppel-server start`. */
function withDefaultCommand(argv: string[]): string[] {
  return argv.length <= 2 ? [...argv, 'start'] : argv
}

/** Parses and validates a positive integer TCP port. */
function parsePort(value: string | undefined, fallback = DEFAULT_PORT): number {
  const port = Number(value ?? fallback)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid port: ${value}`)
  }

  return port
}

/** Converts wildcard bind hosts into a browser-friendly local daemon URL. */
function getLocalServerUrl(host: string, port: number): string {
  const hostname = host === '0.0.0.0' || host === '::' ? 'localhost' : host
  return `http://${hostname}:${port}`
}

/** Returns the pidfile path for the daemon data directory. */
function getPidPath(dataDir: string): string {
  return path.join(dataDir, 'doppel-server.pid')
}

/** Reads a daemon pidfile, returning `null` when it is missing or invalid. */
function readPid(dataDir: string): number | null {
  try {
    const value = fs.readFileSync(getPidPath(dataDir), 'utf8').trim()
    const pid = Number(value)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** Health payload used by the `status` command after probing `/health`. */
type HealthStatus =
  | {
      ok: true
      service: string
    }
  | {
      ok: false
      error: string
    }

/**
 * Reads the daemon HTTP health route and normalizes transport failures into a
 * status object that the output helpers can print.
 */
async function readHealthStatus(serverUrl: string): Promise<HealthStatus> {
  try {
    const response = await fetch(new URL('/health', serverUrl))

    if (!response.ok) {
      return {
        ok: false,
        error: `Health check failed with HTTP ${response.status}`,
      }
    }

    return (await response.json()) as { ok: true; service: string }
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    }
  }
}

/** Normalizes unknown thrown values for CLI output. */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Writes one JSON command result to stdout. */
function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

/** Writes the `start --daemon` command result in pretty or JSON format. */
function writeDaemonStartOutput(
  result: {
    daemon: true
    logPath: string
    pid: number | undefined
    webUi: boolean
  },
  options: Pick<ServerCommandOptions, 'json'>,
): void {
  if (options.json === true) {
    writeJson(result)
    return
  }

  process.stdout.write('doppel server started in background\n')
  process.stdout.write(`  pid: ${result.pid ?? 'unknown'}\n`)
  process.stdout.write(`  log: ${result.logPath}\n`)
  process.stdout.write(`  web ui: ${result.webUi ? 'enabled' : 'disabled'}\n`)
}

/** Writes the `status` command result in pretty or JSON format. */
function writeStatusOutput(
  status:
    | {
        ok: true
        pid: number | null
        service: string
      }
    | {
        ok: false
        pid: number | null
        error: string
      },
  options: Pick<ServerCommandOptions, 'json'>,
): void {
  if (options.json === true) {
    writeJson(status)
    return
  }

  if (status.ok) {
    process.stdout.write('doppel server is running\n')
    process.stdout.write(`  service: ${status.service}\n`)
    process.stdout.write(`  pid: ${status.pid ?? 'unknown'}\n`)
    return
  }

  process.stdout.write('doppel server is offline\n')
  process.stdout.write(`  pid: ${status.pid ?? 'unknown'}\n`)
  process.stdout.write(`  error: ${status.error}\n`)
}

/** Writes the `stop` command result in pretty or JSON format. */
function writeStopOutput(
  result:
    | {
        stopped: true
        pid: number
      }
    | {
        stopped: false
        pid?: number
        reason: string
      },
  options: Pick<ServerCommandOptions, 'json'>,
): void {
  if (options.json === true) {
    writeJson(result)
    return
  }

  if (result.stopped) {
    process.stdout.write('stopped doppel server\n')
    process.stdout.write(`  pid: ${result.pid}\n`)
    return
  }

  process.stdout.write('doppel server was not stopped\n')
  process.stdout.write(`  pid: ${result.pid ?? 'unknown'}\n`)
  process.stdout.write(`  reason: ${result.reason}\n`)
}

main(process.argv).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  process.exit(1)
})
