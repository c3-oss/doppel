import { Command } from 'commander'

import { isDaemonConnectionError } from '../errors.js'
import { writeJson, writeTable } from '../output.js'
import type { DoppelClientFactory } from '../trpc-client.js'
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js'
import { type OpenSessionView, openSessionViewWithLauncher } from './view.js'
import { type OpenSessionWatch, watchSession } from './watch.js'

export interface SessionEnsurePayload {
  name: string
  shell?: string
  cwd?: string
  cols?: number
  rows?: number
}

export interface SessionCommandDeps {
  clientFactory?: DoppelClientFactory
  openSessionView?: OpenSessionView
  openSessionWatch?: OpenSessionWatch
  stdout?: NodeJS.WriteStream
}

export interface SessionStartOptions {
  shell?: string
  cwd?: string
  cols?: string
  rows?: string
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

export function buildSessionEnsurePayload(name: string, options: SessionStartOptions): SessionEnsurePayload {
  return {
    name,
    shell: options.shell,
    cwd: options.cwd,
    cols: parsePositiveInteger(options.cols, 'cols'),
    rows: parsePositiveInteger(options.rows, 'rows'),
  }
}

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
    .description('Open a browser view for a daemon session.')
    .argument('[name]', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (name: string, options: { url: string }) => {
      await clientFactory(options.url).mutation('sessions.ensure', { name })
      await openSessionView({
        session: name,
        url: options.url,
      })
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
