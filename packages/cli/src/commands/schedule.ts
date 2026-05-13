import { Command, Option } from 'commander'

import { writeJson } from '../output.js'
import type { DoppelClientFactory } from '../trpc-client.js'
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js'

export interface ScheduleCreatePayload {
  name: string
  cron: string
  command: string
  mode?: ScheduleMode
  sessionName?: string
  enabled?: boolean
  cwd?: string
  shell?: string
}

export interface ScheduleCreateOptions {
  name?: string
  cron?: string
  command?: string
  mode?: string
  session?: string
  enabled?: boolean
  disabled?: boolean
  cwd?: string
  shell?: string
}

export interface ScheduleCommandDeps {
  clientFactory?: DoppelClientFactory
  stdout?: NodeJS.WriteStream
}

const SCHEDULE_MODES = ['ephemeral', 'session'] as const

type ScheduleMode = (typeof SCHEDULE_MODES)[number]

function requireOption(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required option --${label}.`)
  }

  return value
}

function parseScheduleMode(value: string | undefined): ScheduleMode | undefined {
  if (value === undefined) {
    return undefined
  }

  if (SCHEDULE_MODES.includes(value as ScheduleMode)) {
    return value as ScheduleMode
  }

  throw new Error(`Invalid --mode "${value}". Expected one of: ${SCHEDULE_MODES.join(', ')}.`)
}

export function buildScheduleCreatePayload(options: ScheduleCreateOptions): ScheduleCreatePayload {
  if (options.enabled === true && options.disabled === true) {
    throw new Error('Use only one of --enabled or --disabled.')
  }

  return {
    name: requireOption(options.name, 'name'),
    cron: requireOption(options.cron, 'cron'),
    command: requireOption(options.command, 'command'),
    mode: parseScheduleMode(options.mode),
    sessionName: options.session,
    enabled: options.enabled === true ? true : options.disabled === true ? false : undefined,
    cwd: options.cwd,
    shell: options.shell,
  }
}

export function scheduleCommand(deps: ScheduleCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient
  const stdout = deps.stdout ?? process.stdout
  const command = new Command('schedule').description('Manage daemon schedules.')

  command
    .command('list')
    .description('List daemon schedules.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (options: { url: string }) => {
      const result = await clientFactory(options.url).query('schedules.list')
      writeJson(stdout, result)
    })

  command
    .command('add')
    .description('Add a daemon schedule.')
    .requiredOption('--name <name>', 'Schedule name.')
    .requiredOption('--cron <cron>', 'Cron expression.')
    .requiredOption('--command <command>', 'Command to run.')
    .addOption(new Option('--mode <mode>', 'Schedule execution mode.').choices([...SCHEDULE_MODES]))
    .option('--session <name>', 'Session name for session-backed schedules.')
    .option('--enabled', 'Create the schedule enabled.')
    .option('--disabled', 'Create the schedule disabled.')
    .option('--cwd <cwd>', 'Working directory for the schedule command.')
    .option('--shell <shell>', 'Shell command for the schedule command.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(
      async (
        options: ScheduleCreateOptions & {
          url: string
        },
      ) => {
        const payload = buildScheduleCreatePayload(options)
        const result = await clientFactory(options.url).mutation('schedules.create', payload)
        writeJson(stdout, result)
      },
    )

  command
    .command('remove')
    .description('Remove a daemon schedule.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (id: string, options: { url: string }) => {
      const result = await clientFactory(options.url).mutation('schedules.delete', { id })
      writeJson(stdout, result)
    })

  command
    .command('enable')
    .description('Enable a daemon schedule.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (id: string, options: { url: string }) => {
      const result = await clientFactory(options.url).mutation('schedules.enable', {
        id,
        enabled: true,
      })
      writeJson(stdout, result)
    })

  command
    .command('disable')
    .description('Disable a daemon schedule.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (id: string, options: { url: string }) => {
      const result = await clientFactory(options.url).mutation('schedules.enable', {
        id,
        enabled: false,
      })
      writeJson(stdout, result)
    })

  command
    .command('run')
    .description('Run a daemon schedule now.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (id: string, options: { url: string }) => {
      const result = await clientFactory(options.url).mutation('schedules.runNow', { id })
      writeJson(stdout, result)
    })

  return command
}
