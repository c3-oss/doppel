export { createDoppel } from './doppel.js'
export type { Doppel, DoppelOptions } from './doppel.js'

export {
  DEFAULT_COLUMNS,
  DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES,
  DEFAULT_HISTORY_LIMIT_BYTES,
  DEFAULT_ROWS,
  DEFAULT_SESSION_NAME,
  DEFAULT_TERM,
  PtySessionManager,
  getDefaultCwd,
  getDefaultShell,
  getShellCommandArgs,
  normalizeSessionName,
} from './terminal/pty-session-manager.js'
export type {
  PtyExitSubscriber,
  PtyOutputSubscriber,
  PtyRunOptions,
  PtyRunResult,
  PtySessionOptions,
  PtySessionSummary,
  PtyUnsubscribe,
} from './terminal/pty-session-manager.js'

export { mapTerminalKey, terminalKeyMap } from './terminal/keys.js'
export type { TerminalKey } from './terminal/keys.js'

export {
  ScheduleStore,
  getDefaultDataDir,
  resolveScheduleDatabasePath,
} from './schedules/store.js'
export type {
  CreateScheduleInput,
  ScheduleMode,
  ScheduleRecord,
  ScheduleStoreOptions,
  UpdateScheduleInput,
} from './schedules/store.js'

export { ScheduleScheduler, validateCron } from './schedules/scheduler.js'
export type { ScheduleSchedulerOptions } from './schedules/scheduler.js'

export * as schemas from './schemas.js'
