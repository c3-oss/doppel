export { runCli } from './main.js'
export { healthCommand, readHealthStatus } from './commands/health.js'
export type { HealthStatus, OfflineHealthStatus } from './commands/health.js'
export { scheduleCommand, buildScheduleCreatePayload } from './commands/schedule.js'
export type {
  ScheduleCommandDeps,
  ScheduleCreateOptions,
  ScheduleCreatePayload,
  ScheduleMode,
} from './commands/schedule.js'
export {
  sendCommand,
  sendKeyCommand,
  buildSendCommandPayload,
  buildSendKeyPayload,
} from './commands/send.js'
export type {
  SendCommandOptions,
  SendCommandDeps,
  SendCommandPayload,
  SendKeyOptions,
  SendKeyPayload,
} from './commands/send.js'
export { sessionCommand, buildSessionEnsurePayload } from './commands/session.js'
export type {
  SessionCommandDeps,
  SessionEnsurePayload,
  SessionStartOptions,
} from './commands/session.js'
export { getSessionViewUrl, openSessionViewWithLauncher } from './commands/view.js'
export type {
  BrowserInstance,
  BrowserLauncher,
  BrowserPage,
  OpenSessionView,
  ViewOptions,
} from './commands/view.js'
export { getSessionWatchWebSocketUrl, watchSession } from './commands/watch.js'
export type {
  OpenSessionWatch,
  SessionWatchOptions,
  SignalProcess,
  WatchSessionDeps,
  WatchStreams,
  WatchWebSocket,
  WatchWebSocketConstructor,
} from './commands/watch.js'
export { formatCliError, isDaemonConnectionError } from './errors.js'
export { deterministicJson, writeJson, writeTable } from './output.js'
export type { TableOptions } from './output.js'
export {
  FALLBACK_SERVER_URL,
  createDoppelClient,
  getDefaultServerUrl,
  getTrpcUrl,
} from './trpc-client.js'
export type { DoppelClient, DoppelClientFactory } from './trpc-client.js'
