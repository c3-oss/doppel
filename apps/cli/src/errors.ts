/**
 * Converts unknown command errors into user-facing CLI messages.
 */
export function formatCliError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (isDaemonConnectionError(error)) {
    return 'Unable to reach doppel server. Start it with `doppel-server start --daemon` or set DOPPEL_SERVER_URL.'
  }

  return message
}

/**
 * Detects the fetch failure emitted when the daemon cannot be reached.
 */
export function isDaemonConnectionError(error: unknown): boolean {
  return error instanceof Error && error.message === 'fetch failed'
}
