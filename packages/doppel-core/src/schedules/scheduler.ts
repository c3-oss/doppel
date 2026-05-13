import cron, { type ScheduledTask } from 'node-cron'

import { mapTerminalKey } from '../terminal/keys.js'
import {
  DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES,
  DEFAULT_SESSION_NAME,
  type PtySessionManager,
} from '../terminal/pty-session-manager.js'
import type { CreateScheduleInput, ScheduleRecord, ScheduleStore, UpdateScheduleInput } from './store.js'

/** Dependencies and configuration for `ScheduleScheduler`. */
export interface ScheduleSchedulerOptions {
  /** Persistent schedule store used as the source of truth. */
  store: ScheduleStore
  /** Terminal manager used to execute scheduled commands. */
  terminal: PtySessionManager
  /** Maximum UTF-8 bytes retained for ephemeral scheduled command output. */
  outputLimitBytes?: number
}

/** Coordinates persisted schedules with cron tasks and terminal execution. */
export class ScheduleScheduler {
  #store: ScheduleStore
  #terminal: PtySessionManager
  #tasks = new Map<string, ScheduledTask>()
  #outputLimitBytes: number

  /** Create a scheduler around an existing schedule store and terminal manager. */
  constructor(options: ScheduleSchedulerOptions) {
    this.#store = options.store
    this.#terminal = options.terminal
    this.#outputLimitBytes = options.outputLimitBytes ?? DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES
  }

  /** Register all enabled schedules from the store with cron. */
  start(): void {
    for (const schedule of this.#store.list()) {
      if (!schedule.enabled) {
        continue
      }

      try {
        this.#schedule(schedule)
      } catch (error) {
        this.#store.update(schedule.id, {
          lastRunAt: new Date().toISOString(),
          lastStatus: 'invalid-cron',
          lastOutput: getErrorMessage(error),
        })
      }
    }
  }

  /** List schedules from the backing store. */
  list(): ScheduleRecord[] {
    return this.#store.list()
  }

  /** Validate, persist, and register a new schedule. */
  create(input: CreateScheduleInput): ScheduleRecord {
    validateCron(input.cron)

    const schedule = this.#store.create({
      ...input,
      mode: input.mode ?? 'ephemeral',
    })

    if (schedule.enabled) {
      this.#schedule(schedule)
    }

    return schedule
  }

  /** Validate, persist, and reschedule updates to an existing schedule. */
  update(id: string, input: UpdateScheduleInput): ScheduleRecord {
    if (input.cron) {
      validateCron(input.cron)
    }

    this.#unschedule(id)
    const schedule = this.#store.update(id, input)

    if (schedule.enabled) {
      this.#schedule(schedule)
    }

    return schedule
  }

  /** Delete a schedule and unregister any active cron task. */
  delete(id: string): boolean {
    this.#unschedule(id)
    return this.#store.delete(id)
  }

  /** Enable or disable a schedule and synchronize its cron task. */
  enable(id: string, enabled: boolean): ScheduleRecord {
    this.#unschedule(id)
    const schedule = this.#store.enable(id, enabled)

    if (schedule.enabled) {
      this.#schedule(schedule)
    }

    return schedule
  }

  /** Run a schedule immediately without changing its cron registration. */
  async runNow(id: string): Promise<ScheduleRecord> {
    const schedule = this.#store.get(id)

    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`)
    }

    return this.#runSchedule(schedule)
  }

  /** Stop all active cron tasks managed by this scheduler. */
  close(): void {
    for (const id of this.#tasks.keys()) {
      this.#unschedule(id)
    }
  }

  #schedule(schedule: ScheduleRecord): void {
    validateCron(schedule.cron)
    this.#unschedule(schedule.id)

    // The persisted record is captured so cron-triggered runs use the last scheduled state.
    const task = cron.schedule(
      schedule.cron,
      () => {
        void this.#runSchedule(schedule).catch((error: unknown) => {
          this.#store.update(schedule.id, {
            lastRunAt: new Date().toISOString(),
            lastStatus: 'error',
            lastOutput: getErrorMessage(error),
          })
        })
      },
      {
        name: schedule.id,
        noOverlap: true,
      },
    )

    this.#tasks.set(schedule.id, task)
  }

  #unschedule(id: string): void {
    const task = this.#tasks.get(id)

    if (!task) {
      return
    }

    void task.stop()
    void task.destroy()
    this.#tasks.delete(id)
  }

  async #runSchedule(schedule: ScheduleRecord): Promise<ScheduleRecord> {
    const lastRunAt = new Date().toISOString()
    this.#store.update(schedule.id, {
      lastRunAt,
      lastStatus: 'running',
      lastExitCode: null,
      lastOutput: null,
    })

    try {
      if (schedule.mode === 'session') {
        // Session-mode schedules enqueue commands and cannot observe command exit status.
        const sessionName = schedule.sessionName ?? DEFAULT_SESSION_NAME
        this.#terminal.ensure({
          name: sessionName,
          cwd: schedule.cwd ?? undefined,
          shell: schedule.shell ?? undefined,
        })
        this.#terminal.send(sessionName, `${schedule.command}${mapTerminalKey('enter')}`)

        return this.#store.update(schedule.id, {
          lastRunAt,
          lastStatus: 'dispatched',
          lastExitCode: null,
          lastOutput: null,
        })
      }

      const result = await this.#terminal.runEphemeral(schedule.command, {
        cwd: schedule.cwd ?? undefined,
        shell: schedule.shell ?? undefined,
        outputLimitBytes: this.#outputLimitBytes,
      })

      return this.#store.update(schedule.id, {
        lastRunAt,
        lastStatus: result.exitCode === 0 ? 'success' : 'failed',
        lastExitCode: result.exitCode,
        lastOutput: result.output,
      })
    } catch (error) {
      return this.#store.update(schedule.id, {
        lastRunAt,
        lastStatus: 'error',
        lastExitCode: null,
        lastOutput: getErrorMessage(error),
      })
    }
  }
}

/** Throw when an expression is not accepted by the cron engine. */
export function validateCron(expression: string): void {
  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression: ${expression}`)
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
