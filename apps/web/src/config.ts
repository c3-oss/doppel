export function getDoppelServerUrl(): string {
  return window.__DOPPEL_CONFIG__?.serverUrl ?? import.meta.env.VITE_DOPPEL_SERVER_URL ?? 'http://localhost:3000'
}
