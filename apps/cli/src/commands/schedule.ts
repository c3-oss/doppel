import { Command, Option } from 'commander'

import { isDaemonConnectionError } from '../errors.js'
import { writeJson, writeTable } from '../output.js'
import type { DoppelClientFactory } from '../trpc-client.js'
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js'

/**
 * Payload sent to the daemon when creating a schedule.
 */
export interface ScheduleCreatePayload {
  /**
   * Human-readable schedule name.
   */
  name: string

  /**
   * Cron expression evaluated by the daemon.
   */
  cron: string

  /**
   * Shell command executed when the schedule runs.
   */
  command: string

  /**
   * Execution mode selected for the scheduled command.
   */
  mode?: ScheduleMode

  /**
   * Session name used when the schedule runs in `session` mode.
   */
  sessionName?: string

  /**
   * Initial enabled state; omitted lets the daemon choose its default.
   */
  enabled?: boolean

  /**
   * Working directory for the scheduled command.
   */
  cwd?: string

  /**
   * Shell executable or command used to run the scheduled command.
   */
  shell?: string
}

/**
 * Commander option bag accepted by `doppel schedule add`.
 */
export interface ScheduleCreateOptions {
  /**
   * Human-readable schedule name.
   */
  name?: string

  /**
   * Cron expression evaluated by the daemon.
   */
  cron?: string

  /**
   * Shell command executed when the schedule runs.
   */
  command?: string

  /**
   * Execution mode as received from Commander.
   */
  mode?: string

  /**
   * Session name for session-backed schedules.
   */
  session?: string

  /**
   * Whether `--enabled` was supplied.
   */
  enabled?: boolean

  /**
   * Whether `--disabled` was supplied.
   */
  disabled?: boolean

  /**
   * Working directory for the schedule command.
   */
  cwd?: string

  /**
   * Shell command for the schedule command.
   */
  shell?: string

  /**
   * Whether to emit JSON instead of a table.
   */
  json?: boolean
}

/**
 * Injectable dependencies for the schedule command tree.
 */
export interface ScheduleCommandDeps {
  /**
   * Client factory used to talk to the daemon.
   */
  clientFactory?: DoppelClientFactory

  /**
   * Output stream for command responses.
   */
  stdout?: NodeJS.WriteStream
}

/**
 * Supported daemon execution modes for schedules.
 */
export type ScheduleMode = 'ephemeral' | 'session'

const SCHEDULE_MODES = ['ephemeral', 'session'] as const satisfies readonly ScheduleMode[]

interface ScheduleRecord {
  id: string
  name: string
  cron: string
  command: string
  mode: ScheduleMode
  sessionName: string | null
  enabled: boolean
  cwd: string | null
  shell: string | null
  createdAt: string
  updatedAt: string
  lastRunAt: string | null
  lastStatus: string | null
  lastExitCode: number | null
  lastOutput: string | null
}

const SCHEDULE_COLUMNS = ['id', 'name', 'enabled', 'cron', 'mode', 'sessionName', 'lastStatus', 'command'] as const

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

/**
 * Converts Commander options into the daemon payload for schedule creation.
 */
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

/**
 * Creates the `doppel schedule` command tree.
 */
export function scheduleCommand(deps: ScheduleCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient
  const stdout = deps.stdout ?? process.stdout
  const command = new Command('schedule').description('Manage daemon schedules.')

  command
    .command('list')
    .description('List daemon schedules.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (options: { json?: boolean; url: string }) => {
      const result = await queryListOrEmpty<ScheduleRecord>(clientFactory(options.url), 'schedules.list')

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      writeTable(stdout, result.map(toScheduleRow), {
        columns: SCHEDULE_COLUMNS,
        maxColumnWidths: {
          id: 12,
          command: 42,
          lastStatus: 14,
          name: 24,
        },
      })
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
    .option('--json', 'Emit JSON output.')
    .action(
      async (
        options: ScheduleCreateOptions & {
          url: string
        },
      ) => {
        const payload = buildScheduleCreatePayload(options)
        const result = await clientFactory(options.url).mutation<ScheduleRecord>('schedules.create', payload)

        if (options.json === true) {
          writeJson(stdout, result)
          return
        }

        writeTable(stdout, [toScheduleRow(result)], {
          columns: SCHEDULE_COLUMNS,
          maxColumnWidths: {
            id: 12,
            command: 42,
            lastStatus: 14,
            name: 24,
          },
        })
      },
    )

  command
    .command('remove')
    .description('Remove a daemon schedule.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (id: string, options: { json?: boolean; url: string }) => {
      const result = await clientFactory(options.url).mutation<{ deleted: boolean }>('schedules.delete', { id })

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      stdout.write(result.deleted ? `removed schedule ${id}\n` : `schedule not found: ${id}\n`)
    })

  command
    .command('enable')
    .description('Enable a daemon schedule.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (id: string, options: { json?: boolean; url: string }) => {
      const result = await clientFactory(options.url).mutation<ScheduleRecord>('schedules.enable', {
        id,
        enabled: true,
      })

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      writeTable(stdout, [toScheduleRow(result)], {
        columns: SCHEDULE_COLUMNS,
        maxColumnWidths: {
          id: 12,
          command: 42,
          lastStatus: 14,
          name: 24,
        },
      })
    })

  command
    .command('disable')
    .description('Disable a daemon schedule.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (id: string, options: { json?: boolean; url: string }) => {
      const result = await clientFactory(options.url).mutation<ScheduleRecord>('schedules.enable', {
        id,
        enabled: false,
      })

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      writeTable(stdout, [toScheduleRow(result)], {
        columns: SCHEDULE_COLUMNS,
        maxColumnWidths: {
          id: 12,
          command: 42,
          lastStatus: 14,
          name: 24,
        },
      })
    })

  command
    .command('run')
    .description('Run a daemon schedule now.')
    .argument('<id>', 'Schedule ID.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (id: string, options: { json?: boolean; url: string }) => {
      const result = await clientFactory(options.url).mutation<ScheduleRecord>('schedules.runNow', { id })

      if (options.json === true) {
        writeJson(stdout, result)
        return
      }

      writeTable(stdout, [toScheduleRow(result)], {
        columns: SCHEDULE_COLUMNS,
        maxColumnWidths: {
          id: 12,
          command: 42,
          lastStatus: 14,
          name: 24,
        },
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

function toScheduleRow(schedule: ScheduleRecord): Record<(typeof SCHEDULE_COLUMNS)[number], string> {
  return {
    id: schedule.id,
    name: schedule.name,
    enabled: schedule.enabled ? 'yes' : 'no',
    cron: schedule.cron,
    mode: schedule.mode,
    sessionName: schedule.sessionName ?? '',
    lastStatus: schedule.lastStatus ?? '',
    command: schedule.command,
  }
}
