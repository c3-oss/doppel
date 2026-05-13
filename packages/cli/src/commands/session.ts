import { Command } from 'commander'

import { writeJson } from '../output.js'
import type { DoppelClientFactory } from '../trpc-client.js'
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js'

export interface SessionEnsurePayload {
  name: string
  shell?: string
  cwd?: string
  cols?: number
  rows?: number
}

export interface SessionCommandDeps {
  clientFactory?: DoppelClientFactory
  stdout?: NodeJS.WriteStream
}

export interface SessionStartOptions {
  shell?: string
  cwd?: string
  cols?: string
  rows?: string
}

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
  const stdout = deps.stdout ?? process.stdout
  const command = new Command('session').description('Manage daemon sessions.')

  command
    .command('list')
    .description('List daemon sessions.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (options: { url: string }) => {
      const result = await clientFactory(options.url).query('sessions.list')
      writeJson(stdout, result)
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
    .action(
      async (
        name: string,
        options: SessionStartOptions & {
          url: string
        },
      ) => {
        const payload = buildSessionEnsurePayload(name, options)
        const result = await clientFactory(options.url).mutation('sessions.ensure', payload)
        writeJson(stdout, result)
      },
    )

  command
    .command('kill')
    .description('Kill a daemon session.')
    .argument('[name]', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (name: string, options: { url: string }) => {
      const result = await clientFactory(options.url).mutation('sessions.kill', { name })
      writeJson(stdout, result)
    })

  return command
}
