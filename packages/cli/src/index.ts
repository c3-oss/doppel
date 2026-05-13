export { runCli } from './main.js'
export { healthCommand, readHealthStatus } from './commands/health.js'
export type { HealthStatus } from './commands/health.js'
export { scheduleCommand, buildScheduleCreatePayload } from './commands/schedule.js'
export type { ScheduleCreateOptions, ScheduleCreatePayload } from './commands/schedule.js'
export {
  sendCommand,
  sendKeyCommand,
  buildSendCommandPayload,
  buildSendKeyPayload,
} from './commands/send.js'
export type {
  SendCommandOptions,
  SendCommandPayload,
  SendKeyOptions,
  SendKeyPayload,
} from './commands/send.js'
export { sessionCommand, buildSessionEnsurePayload } from './commands/session.js'
export type { SessionEnsurePayload, SessionStartOptions } from './commands/session.js'
export { viewCommand, getSessionViewUrl, openSessionViewWithLauncher } from './commands/view.js'
export type {
  BrowserInstance,
  BrowserLauncher,
  BrowserPage,
  OpenSessionView,
  ViewOptions,
} from './commands/view.js'
export {
  FALLBACK_SERVER_URL,
  createDoppelClient,
  getDefaultServerUrl,
  getTrpcUrl,
} from './trpc-client.js'
export type { DoppelClient, DoppelClientFactory } from './trpc-client.js'
