import { Command } from 'commander'

import { isDaemonConnectionError } from '../errors.js'
import { writeJson, writeTable } from '../output.js'
import type { DoppelClientFactory } from '../trpc-client.js'
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js'
import { type OpenSessionView, getSessionViewUrl, openSessionViewWithLauncher } from './view.js'
import { type OpenSessionWatch, watchSession } from './watch.js'

/**
 * Payload sent to the daemon when starting or ensuring a session.
 */
export interface SessionEnsurePayload {
  /**
   * Session name.
   */
  name: string

  /**
   * Optional shell command for the session.
   */
  shell?: string

  /**
   * Optional working directory for the session.
   */
  cwd?: string

  /**
   * Requested terminal column count.
   */
  cols?: number

  /**
   * Requested terminal row count.
   */
  rows?: number
}

/**
 * Injectable dependencies for the session command tree.
 */
export interface SessionCommandDeps {
  /**
   * Client factory used to talk to the daemon.
   */
  clientFactory?: DoppelClientFactory

  /**
   * Browser opener used by `doppel session view`.
   */
  openSessionView?: OpenSessionView

  /**
   * Terminal watcher used by `doppel session watch`.
   */
  openSessionWatch?: OpenSessionWatch

  /**
   * Output stream for command responses.
   */
  stdout?: NodeJS.WriteStream
}

/**
 * Commander option bag accepted by `doppel session start`.
 */
export interface SessionStartOptions {
  /**
   * Shell command for the session.
   */
  shell?: string

  /**
   * Working directory for the session.
   */
  cwd?: string

  /**
   * Terminal column count as received from Commander.
   */
  cols?: string

  /**
   * Terminal row count as received from Commander.
   */
  rows?: string

  /**
   * Whether to emit JSON instead of a table.
   */
  json?: boolean
}

interface SessionSummary {
  name: string
  pid: number
  cols: number
  rows: number
  cwd: string
  shell: string
  createdAt: string
  updatedAt: string
}

const SESSION_COLUMNS = ['name', 'pid', 'size', 'cwd', 'shell', 'updatedAt'] as const

function parsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }

  return parsed
}

/**
 * Converts session start arguments and options into the daemon ensure payload.
 */
export function buildSessionEnsurePayload(name: string, options: SessionStartOptions): SessionEnsurePayload {
  return {
    name,
    shell: options.shell,
    cwd: options.cwd,
    cols: parsePositiveInteger(options.cols, 'cols'),
    rows: parsePositiveInteger(options.rows, 'rows'),
  }
}

/**
 * Creates the `doppel session` command tree.
 */
export function sessionCommand(deps: SessionCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient
  const openSessionView = deps.openSessionView ?? openSessionViewWithLauncher
  const openSessionWatch = deps.openSessionWatch ?? watchSession
  const stdout = deps.stdout ?? process.stdout
  const command = new Command('session').description('Manage daemon sessions.')

  command
    .command('list')
    .description('List daemon sessions.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (options: { json?: boolean; url: string }) => {
      const result = await queryListOrEmpty<SessionSummary>(clientFactory(options.url), 'sessions.list')

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      writeTable(stdout, result.map(toSessionRow), {
        columns: SESSION_COLUMNS,
        maxColumnWidths: {
          cwd: 40,
          shell: 28,
          updatedAt: 24,
        },
        tailColumns: new Set(['cwd', 'shell']),
      })
    })

  command
    .command('start')
    .description('Start or ensure a daemon session.')
    .argument('[name]', 'Session name.', 'default')
    .option('--shell <shell>', 'Shell command for the session.')
    .option('--cwd <cwd>', 'Working directory for the session.')
    .option('--cols <cols>', 'Terminal column count.')
    .option('--rows <rows>', 'Terminal row count.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(
      async (
        name: string,
        options: SessionStartOptions & {
          url: string
        },
      ) => {
        const payload = buildSessionEnsurePayload(name, options)
        const result = await clientFactory(options.url).mutation<SessionSummary>('sessions.ensure', payload)

        if (options.json === true) {
          writeJson(stdout, result)
          return
        }

        writeTable(stdout, [toSessionRow(result)], {
          columns: SESSION_COLUMNS,
          maxColumnWidths: {
            cwd: 40,
            shell: 28,
            updatedAt: 24,
          },
          tailColumns: new Set(['cwd', 'shell']),
        })
      },
    )

  command
    .command('kill')
    .description('Kill a daemon session.')
    .argument('[name]', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (name: string, options: { json?: boolean; url: string }) => {
      const result = await clientFactory(options.url).mutation<{ killed: boolean }>('sessions.kill', { name })

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      stdout.write(result.killed ? `killed session ${name}\n` : `session not found: ${name}\n`)
    })

  command
    .command('view')
    .description('Print or open a browser view for a daemon session.')
    .argument('[name]', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--open', 'Open the served session view in Chrome through Playwright.')
    .action(async (name: string, options: { open?: boolean; url: string }) => {
      await clientFactory(options.url).mutation('sessions.ensure', { name })

      if (options.open === true) {
        await openSessionView({
          session: name,
          url: options.url,
        })
        return
      }

      stdout.write(`${getSessionViewUrl(options.url, name)}\n`)
    })

  command
    .command('watch')
    .description('Watch a daemon session in this terminal.')
    .argument('[name]', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (name: string, options: { url: string }) => {
      await openSessionWatch({
        session: name,
        url: options.url,
      })
    })

  return command
}

/**
 * Keeps list commands useful when the daemon is offline during local workflows.
 */
async function queryListOrEmpty<T>(client: ReturnType<DoppelClientFactory>, path: string): Promise<T[]> {
  try {
    return await client.query<T[]>(path)
  } catch (error) {
    if (isDaemonConnectionError(error)) {
      return []
    }

    throw error
  }
}

function toSessionRow(session: SessionSummary): Record<(typeof SESSION_COLUMNS)[number], string | number> {
  return {
    name: session.name,
    pid: session.pid,
    size: `${session.cols}x${session.rows}`,
    cwd: session.cwd,
    shell: session.shell,
    updatedAt: session.updatedAt,
  }
}
