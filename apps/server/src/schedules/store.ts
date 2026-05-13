import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

export type ScheduleMode = 'ephemeral' | 'session';

export interface ScheduleRecord {
  id: string;
  name: string;
  cron: string;
  command: string;
  mode: ScheduleMode;
  sessionName: string | null;
  enabled: boolean;
  cwd: string | null;
  shell: string | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastExitCode: number | null;
  lastOutput: string | null;
}

export interface CreateScheduleInput {
  id?: string;
  name: string;
  cron: string;
  command: string;
  mode?: ScheduleMode;
  sessionName?: string | null;
  enabled?: boolean;
  cwd?: string | null;
  shell?: string | null;
}

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
>;

export interface ScheduleStoreOptions {
  dataDir?: string;
  dbPath?: string;
}

interface ScheduleRow {
  id: string;
  name: string;
  cron: string;
  command: string;
  mode: string;
  sessionName: string | null;
  enabled: 0 | 1;
  cwd: string | null;
  shell: string | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastExitCode: number | null;
  lastOutput: string | null;
}

export class ScheduleStore {
  readonly dbPath: string;

  #db: ReturnType<typeof Database>;

  constructor(options: ScheduleStoreOptions = {}) {
    this.dbPath = options.dbPath ?? resolveScheduleDatabasePath(options.dataDir);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.#db = new Database(this.dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#migrate();
  }

  list(): ScheduleRecord[] {
    return this.#db
      .prepare<[], ScheduleRow>('select * from schedules order by createdAt asc')
      .all()
      .map(toScheduleRecord);
  }

  get(id: string): ScheduleRecord | null {
    const row = this.#db
      .prepare<[string], ScheduleRow>('select * from schedules where id = ?')
      .get(id);
    return row ? toScheduleRecord(row) : null;
  }

  create(input: CreateScheduleInput): ScheduleRecord {
    const now = new Date().toISOString();
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
    };

    this.#db
      .prepare<
        {
          id: string;
          name: string;
          cron: string;
          command: string;
          mode: ScheduleMode;
          sessionName: string | null;
          enabled: 0 | 1;
          cwd: string | null;
          shell: string | null;
          createdAt: string;
          updatedAt: string;
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
      });

    return schedule;
  }

  update(id: string, input: UpdateScheduleInput): ScheduleRecord {
    const existing = this.get(id);

    if (!existing) {
      throw new Error(`Schedule not found: ${id}`);
    }

    const updated: ScheduleRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.#db
      .prepare<
        {
          id: string;
          name: string;
          cron: string;
          command: string;
          mode: ScheduleMode;
          sessionName: string | null;
          enabled: 0 | 1;
          cwd: string | null;
          shell: string | null;
          updatedAt: string;
          lastRunAt: string | null;
          lastStatus: string | null;
          lastExitCode: number | null;
          lastOutput: string | null;
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
      });

    return updated;
  }

  delete(id: string): boolean {
    const result = this.#db.prepare<[string], never>('delete from schedules where id = ?').run(id);
    return result.changes > 0;
  }

  enable(id: string, enabled: boolean): ScheduleRecord {
    return this.update(id, { enabled });
  }

  close(): void {
    if (this.#db.open) {
      this.#db.close();
    }
  }

  #migrate(): void {
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
    `);
  }
}

export function getDefaultDataDir(): string {
  return path.join(os.homedir(), '.doppel');
}

export function resolveScheduleDatabasePath(dataDir?: string): string {
  return path.join(dataDir ?? getDefaultDataDir(), 'doppel.db');
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
  };
}

function toScheduleMode(value: string): ScheduleMode {
  if (value === 'ephemeral' || value === 'session') {
    return value;
  }

  throw new Error(`Unsupported schedule mode: ${value}`);
}
