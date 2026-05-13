import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'

/** Execution strategy for a persisted command schedule. */
export type ScheduleMode = 'ephemeral' | 'session'

/** Persisted schedule state as exposed by the core package. */
export interface ScheduleRecord {
  /** Stable schedule identifier. */
  id: string
  /** Human-readable schedule name. */
  name: string
  /** Cron expression evaluated by the scheduler. */
  cron: string
  /** Command string executed when the schedule runs. */
  command: string
  /** Whether runs use an ephemeral PTY or dispatch into an interactive session. */
  mode: ScheduleMode
  /** Target interactive session name when `mode` is `session`. */
  sessionName: string | null
  /** Whether the schedule should be registered with the scheduler. */
  enabled: boolean
  /** Optional working directory used when running the command. */
  cwd: string | null
  /** Optional shell executable used when running the command. */
  shell: string | null
  /** ISO timestamp for when the schedule was created. */
  createdAt: string
  /** ISO timestamp for the most recent schedule metadata update. */
  updatedAt: string
  /** ISO timestamp for the most recent run attempt. */
  lastRunAt: string | null
  /** Status string from the most recent run attempt. */
  lastStatus: string | null
  /** Exit code from the most recent ephemeral run, when available. */
  lastExitCode: number | null
  /** Output tail or error message from the most recent run attempt. */
  lastOutput: string | null
}

/** Values accepted when creating a schedule. */
export interface CreateScheduleInput {
  /** Optional caller-supplied id; generated when omitted. */
  id?: string
  /** Human-readable schedule name. */
  name: string
  /** Cron expression evaluated by the scheduler. */
  cron: string
  /** Command string executed when the schedule runs. */
  command: string
  /** Execution mode; defaults to `ephemeral`. */
  mode?: ScheduleMode
  /** Target interactive session name when `mode` is `session`. */
  sessionName?: string | null
  /** Whether the schedule starts enabled; defaults to `true`. */
  enabled?: boolean
  /** Optional working directory used when running the command. */
  cwd?: string | null
  /** Optional shell executable used when running the command. */
  shell?: string | null
}

/** Values accepted when updating a schedule. */
export type UpdateScheduleInput = Partial<
  Pick<
    ScheduleRecord,
    | 'name'
    | 'cron'
    | 'command'
    | 'mode'
    | 'sessionName'
    | 'enabled'
    | 'cwd'
    | 'shell'
    | 'lastRunAt'
    | 'lastStatus'
    | 'lastExitCode'
    | 'lastOutput'
  >
>

/** Options for the SQLite-backed schedule store. */
export interface ScheduleStoreOptions {
  /** Directory that contains `doppel.db` when `dbPath` is not set. */
  dataDir?: string
  /** Explicit SQLite database path. */
  dbPath?: string
}

interface ScheduleRow {
  id: string
  name: string
  cron: string
  command: string
  mode: string
  sessionName: string | null
  enabled: 0 | 1
  cwd: string | null
  shell: string | null
  createdAt: string
  updatedAt: string
  lastRunAt: string | null
  lastStatus: string | null
  lastExitCode: number | null
  lastOutput: string | null
}

/** SQLite-backed persistence for command schedules and run metadata. */
export class ScheduleStore {
  /** Resolved SQLite database path used by this store. */
  readonly dbPath: string

  #db: ReturnType<typeof Database>

  /** Open the schedule database and apply required migrations. */
  constructor(options: ScheduleStoreOptions = {}) {
    this.dbPath = options.dbPath ?? resolveScheduleDatabasePath(options.dataDir)
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
    this.#db = new Database(this.dbPath)
    this.#db.pragma('journal_mode = WAL')
    this.#migrate()
  }

  /** List all schedules ordered by creation time. */
  list(): ScheduleRecord[] {
    return this.#db
      .prepare<[], ScheduleRow>('select * from schedules order by createdAt asc')
      .all()
      .map(toScheduleRecord)
  }

  /** Return a schedule by id, or `null` when it does not exist. */
  get(id: string): ScheduleRecord | null {
    const row = this.#db.prepare<[string], ScheduleRow>('select * from schedules where id = ?').get(id)
    return row ? toScheduleRecord(row) : null
  }

  /** Create and persist a new schedule record. */
  create(input: CreateScheduleInput): ScheduleRecord {
    const now = new Date().toISOString()
    const schedule: ScheduleRecord = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name,
      cron: input.cron,
      command: input.command,
      mode: input.mode ?? 'ephemeral',
      sessionName: input.sessionName ?? null,
      enabled: input.enabled ?? true,
      cwd: input.cwd ?? null,
      shell: input.shell ?? null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      lastStatus: null,
      lastExitCode: null,
      lastOutput: null,
    }

    this.#db
      .prepare<
        {
          id: string
          name: string
          cron: string
          command: string
          mode: ScheduleMode
          sessionName: string | null
          enabled: 0 | 1
          cwd: string | null
          shell: string | null
          createdAt: string
          updatedAt: string
        },
        never
      >(
        `insert into schedules (
          id,
          name,
          cron,
          command,
          mode,
          sessionName,
          enabled,
          cwd,
          shell,
          createdAt,
          updatedAt
        ) values (
          @id,
          @name,
          @cron,
          @command,
          @mode,
          @sessionName,
          @enabled,
          @cwd,
          @shell,
          @createdAt,
          @updatedAt
        )`,
      )
      .run({
        id: schedule.id,
        name: schedule.name,
        cron: schedule.cron,
        command: schedule.command,
        mode: schedule.mode,
        sessionName: schedule.sessionName,
        enabled: schedule.enabled ? 1 : 0,
        cwd: schedule.cwd,
        shell: schedule.shell,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      })

    return schedule
  }

  /** Update a schedule record or throw when the id does not exist. */
  update(id: string, input: UpdateScheduleInput): ScheduleRecord {
    const existing = this.get(id)

    if (!existing) {
      throw new Error(`Schedule not found: ${id}`)
    }

    const updated: ScheduleRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    }

    this.#db
      .prepare<
        {
          id: string
          name: string
          cron: string
          command: string
          mode: ScheduleMode
          sessionName: string | null
          enabled: 0 | 1
          cwd: string | null
          shell: string | null
          updatedAt: string
          lastRunAt: string | null
          lastStatus: string | null
          lastExitCode: number | null
          lastOutput: string | null
        },
        never
      >(
        `update schedules set
          name = @name,
          cron = @cron,
          command = @command,
          mode = @mode,
          sessionName = @sessionName,
          enabled = @enabled,
          cwd = @cwd,
          shell = @shell,
          updatedAt = @updatedAt,
          lastRunAt = @lastRunAt,
          lastStatus = @lastStatus,
          lastExitCode = @lastExitCode,
          lastOutput = @lastOutput
        where id = @id`,
      )
      .run({
        id: updated.id,
        name: updated.name,
        cron: updated.cron,
        command: updated.command,
        mode: updated.mode,
        sessionName: updated.sessionName,
        enabled: updated.enabled ? 1 : 0,
        cwd: updated.cwd,
        shell: updated.shell,
        updatedAt: updated.updatedAt,
        lastRunAt: updated.lastRunAt,
        lastStatus: updated.lastStatus,
        lastExitCode: updated.lastExitCode,
        lastOutput: updated.lastOutput,
      })

    return updated
  }

  /** Delete a schedule by id, returning whether a row was removed. */
  delete(id: string): boolean {
    const result = this.#db.prepare<[string], never>('delete from schedules where id = ?').run(id)
    return result.changes > 0
  }

  /** Enable or disable a schedule and return the updated record. */
  enable(id: string, enabled: boolean): ScheduleRecord {
    return this.update(id, { enabled })
  }

  /** Close the underlying SQLite connection if it is still open. */
  close(): void {
    if (this.#db.open) {
      this.#db.close()
    }
  }

  #migrate(): void {
    // Keep migrations idempotent so embedded callers can open the store repeatedly.
    this.#db.exec(`
      create table if not exists schedules (
        id text primary key,
        name text not null,
        cron text not null,
        command text not null,
        mode text not null check (mode in ('ephemeral', 'session')),
        sessionName text,
        enabled integer not null default 1,
        cwd text,
        shell text,
        createdAt text not null,
        updatedAt text not null,
        lastRunAt text,
        lastStatus text,
        lastExitCode integer,
        lastOutput text
      );

      create index if not exists schedules_enabled_idx on schedules(enabled);
    `)
  }
}

/** Return the default directory used for Doppel core data. */
export function getDefaultDataDir(): string {
  return path.join(os.homedir(), '.doppel')
}

/** Resolve the schedule database path for an optional data directory. */
export function resolveScheduleDatabasePath(dataDir?: string): string {
  return path.join(dataDir ?? getDefaultDataDir(), 'doppel.db')
}

function toScheduleRecord(row: ScheduleRow): ScheduleRecord {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    command: row.command,
    mode: toScheduleMode(row.mode),
    sessionName: row.sessionName,
    enabled: row.enabled === 1,
    cwd: row.cwd,
    shell: row.shell,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt,
    lastStatus: row.lastStatus,
    lastExitCode: row.lastExitCode,
    lastOutput: row.lastOutput,
  }
}

function toScheduleMode(value: string): ScheduleMode {
  if (value === 'ephemeral' || value === 'session') {
    return value
  }

  throw new Error(`Unsupported schedule mode: ${value}`)
}
