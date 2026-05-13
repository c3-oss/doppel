import type { ScheduleScheduler } from './schedules/scheduler.js';
import type { ScheduleStore } from './schedules/store.js';
import type { PtySessionManager } from './terminal/pty-session-manager.js';

export interface ServerServices {
  terminal: PtySessionManager;
  scheduleStore: ScheduleStore;
  schedules: ScheduleScheduler;
}
