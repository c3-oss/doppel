import cron, { type ScheduledTask } from 'node-cron';

import { mapTerminalKey } from '../terminal/keys.js';
import {
  DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES,
  DEFAULT_SESSION_NAME,
  type PtySessionManager,
} from '../terminal/pty-session-manager.js';
import type {
  CreateScheduleInput,
  ScheduleRecord,
  ScheduleStore,
  UpdateScheduleInput,
} from './store.js';

export interface ScheduleSchedulerOptions {
  store: ScheduleStore;
  terminal: PtySessionManager;
  outputLimitBytes?: number;
}

export class ScheduleScheduler {
  #store: ScheduleStore;
  #terminal: PtySessionManager;
  #tasks = new Map<string, ScheduledTask>();
  #outputLimitBytes: number;

  constructor(options: ScheduleSchedulerOptions) {
    this.#store = options.store;
    this.#terminal = options.terminal;
    this.#outputLimitBytes = options.outputLimitBytes ?? DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES;
  }

  start(): void {
    for (const schedule of this.#store.list()) {
      if (!schedule.enabled) {
        continue;
      }

      try {
        this.#schedule(schedule);
      } catch (error) {
        this.#store.update(schedule.id, {
          lastRunAt: new Date().toISOString(),
          lastStatus: 'invalid-cron',
          lastOutput: getErrorMessage(error),
        });
      }
    }
  }

  list(): ScheduleRecord[] {
    return this.#store.list();
  }

  create(input: CreateScheduleInput): ScheduleRecord {
    validateCron(input.cron);

    const schedule = this.#store.create({
      ...input,
      mode: input.mode ?? 'ephemeral',
    });

    if (schedule.enabled) {
      this.#schedule(schedule);
    }

    return schedule;
  }

  update(id: string, input: UpdateScheduleInput): ScheduleRecord {
    if (input.cron) {
      validateCron(input.cron);
    }

    this.#unschedule(id);
    const schedule = this.#store.update(id, input);

    if (schedule.enabled) {
      this.#schedule(schedule);
    }

    return schedule;
  }

  delete(id: string): boolean {
    this.#unschedule(id);
    return this.#store.delete(id);
  }

  enable(id: string, enabled: boolean): ScheduleRecord {
    this.#unschedule(id);
    const schedule = this.#store.enable(id, enabled);

    if (schedule.enabled) {
      this.#schedule(schedule);
    }

    return schedule;
  }

  async runNow(id: string): Promise<ScheduleRecord> {
    const schedule = this.#store.get(id);

    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    return this.#runSchedule(schedule);
  }

  close(): void {
    for (const id of this.#tasks.keys()) {
      this.#unschedule(id);
    }
  }

  #schedule(schedule: ScheduleRecord): void {
    validateCron(schedule.cron);
    this.#unschedule(schedule.id);

    const task = cron.schedule(
      schedule.cron,
      () => {
        void this.#runSchedule(schedule).catch((error: unknown) => {
          this.#store.update(schedule.id, {
            lastRunAt: new Date().toISOString(),
            lastStatus: 'error',
            lastOutput: getErrorMessage(error),
          });
        });
      },
      {
        name: schedule.id,
        noOverlap: true,
      },
    );

    this.#tasks.set(schedule.id, task);
  }

  #unschedule(id: string): void {
    const task = this.#tasks.get(id);

    if (!task) {
      return;
    }

    void task.stop();
    void task.destroy();
    this.#tasks.delete(id);
  }

  async #runSchedule(schedule: ScheduleRecord): Promise<ScheduleRecord> {
    const lastRunAt = new Date().toISOString();
    this.#store.update(schedule.id, {
      lastRunAt,
      lastStatus: 'running',
      lastExitCode: null,
      lastOutput: null,
    });

    try {
      if (schedule.mode === 'session') {
        const sessionName = schedule.sessionName ?? DEFAULT_SESSION_NAME;
        this.#terminal.ensure({
          name: sessionName,
          cwd: schedule.cwd ?? undefined,
          shell: schedule.shell ?? undefined,
        });
        this.#terminal.send(sessionName, `${schedule.command}${mapTerminalKey('enter')}`);

        return this.#store.update(schedule.id, {
          lastRunAt,
          lastStatus: 'dispatched',
          lastExitCode: null,
          lastOutput: null,
        });
      }

      const result = await this.#terminal.runEphemeral(schedule.command, {
        cwd: schedule.cwd ?? undefined,
        shell: schedule.shell ?? undefined,
        outputLimitBytes: this.#outputLimitBytes,
      });

      return this.#store.update(schedule.id, {
        lastRunAt,
        lastStatus: result.exitCode === 0 ? 'success' : 'failed',
        lastExitCode: result.exitCode,
        lastOutput: result.output,
      });
    } catch (error) {
      return this.#store.update(schedule.id, {
        lastRunAt,
        lastStatus: 'error',
        lastExitCode: null,
        lastOutput: getErrorMessage(error),
      });
    }
  }
}

export function validateCron(expression: string): void {
  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
