/**
 * Resolves the daemon HTTP origin used by browser-side tRPC and websocket
 * clients.
 *
 * Runtime config injected at `window.__DOPPEL_CONFIG__` wins over the Vite
 * build-time environment variable so a built web bundle can be served by
 * different daemon origins.
 */
export function getDoppelServerUrl(): string {
  return window.__DOPPEL_CONFIG__?.serverUrl ?? import.meta.env.VITE_DOPPEL_SERVER_URL ?? 'http://localhost:3000'
}
