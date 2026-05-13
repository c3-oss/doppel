import { ScheduleScheduler } from './schedules/scheduler.js'
import { ScheduleStore } from './schedules/store.js'
import { PtySessionManager } from './terminal/pty-session-manager.js'

export interface DoppelOptions {
  dataDir?: string
  dbPath?: string
  historyLimitBytes?: number
  outputLimitBytes?: number
}

export interface Doppel {
  readonly terminal: PtySessionManager
  readonly schedules: ScheduleScheduler
  close(): void
}

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
