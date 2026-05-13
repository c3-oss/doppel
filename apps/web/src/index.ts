/**
 * Public documentation surface for the Doppel administrative web UI.
 *
 * The Vite application still boots through {@link App}; this barrel exists so
 * TypeDoc can resolve the private web package as a normal workspace package.
 *
 * @packageDocumentation
 */

export { App } from './App.js'
export { getDoppelServerUrl } from './config.js'
export { Layout } from './components/Layout.js'
export type { LayoutProps } from './components/Layout.js'
export { TerminalPanel } from './components/TerminalPanel.js'
export type { TerminalPanelProps } from './components/TerminalPanel.js'
export { DaemonPage } from './pages/DaemonPage.js'
export { HealthPage } from './pages/HealthPage.js'
export { trpc } from './trpc.js'
export { createDoppelTrpcClient, daemonMutation, daemonQuery, queryClient } from './utils/trpc.js'
