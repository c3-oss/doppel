import { ScheduleScheduler } from './schedules/scheduler.js'
import { ScheduleStore } from './schedules/store.js'
import { PtySessionManager } from './terminal/pty-session-manager.js'

/** Options used to create an embedded Doppel engine instance. */
export interface DoppelOptions {
  /** Directory that contains the schedule database when `dbPath` is not set. */
  dataDir?: string
  /** Explicit path to the SQLite database used for schedule persistence. */
  dbPath?: string
  /** Maximum UTF-8 byte history retained for each long-lived terminal session. */
  historyLimitBytes?: number
  /** Maximum UTF-8 byte output retained for each ephemeral scheduled command. */
  outputLimitBytes?: number
}

/** Embedded Doppel engine facade for terminal sessions and command schedules. */
export interface Doppel {
  /** Terminal session manager for interactive and ephemeral PTY execution. */
  readonly terminal: PtySessionManager
  /** Scheduler facade backed by the configured schedule store and terminal manager. */
  readonly schedules: ScheduleScheduler
  /** Stop scheduled tasks, terminate PTYs, and close the schedule store. */
  close(): void
}

/**
 * Create a transport-agnostic Doppel engine instance.
 *
 * The returned object owns its terminal manager, schedule store, and scheduler;
 * callers should invoke `close()` during shutdown.
 */
export function createDoppel(options: DoppelOptions = {}): Doppel {
  const terminal = new PtySessionManager({
    historyLimitBytes: options.historyLimitBytes,
  })
  const scheduleStore = new ScheduleStore({
    dataDir: options.dataDir,
    dbPath: options.dbPath,
  })
  const schedules = new ScheduleScheduler({
    store: scheduleStore,
    terminal,
    outputLimitBytes: options.outputLimitBytes,
  })

  return {
    terminal,
    schedules,
    close() {
      schedules.close()
      terminal.close()
      scheduleStore.close()
    },
  }
}
