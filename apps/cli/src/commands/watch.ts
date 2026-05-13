/**
 * Options used when watching a session over WebSocket.
 */
export interface SessionWatchOptions {
  /**
   * Session name to watch.
   */
  session: string

  /**
   * Daemon base URL.
   */
  url: string
}

/**
 * Writable streams used by the terminal watcher.
 */
export interface WatchStreams {
  /**
   * Stream for session exit and error messages.
   */
  stderr?: NodeJS.WriteStream

  /**
   * Stream for terminal output frames.
   */
  stdout?: NodeJS.WriteStream
}

/**
 * Minimal WebSocket surface used by the terminal watcher.
 */
export interface WatchWebSocket {
  /**
   * Registers a WebSocket lifecycle or message listener.
   */
  addEventListener(event: 'close' | 'error' | 'message', listener: (event?: unknown) => void): void

  /**
   * Closes the WebSocket connection.
   */
  close(): void
}

/**
 * Constructor shape for injectable WebSocket implementations.
 */
export type WatchWebSocketConstructor = new (url: string) => WatchWebSocket

/**
 * Function signature for watching a session in the current terminal.
 */
export type OpenSessionWatch = (options: SessionWatchOptions) => Promise<void>

/**
 * Injectable dependencies for {@link watchSession}.
 */
export interface WatchSessionDeps extends WatchStreams {
  /**
   * Process-like SIGINT hooks used to close the watcher cleanly.
   */
  signalProcess?: SignalProcess

  /**
   * WebSocket constructor used to connect to the daemon.
   */
  WebSocketConstructor?: WatchWebSocketConstructor
}

/**
 * Minimal process signal API used by the session watcher.
 */
export interface SignalProcess {
  /**
   * Removes a SIGINT listener.
   */
  off(event: 'SIGINT', listener: () => void): unknown

  /**
   * Adds a one-shot SIGINT listener.
   */
  once(event: 'SIGINT', listener: () => void): unknown
}

type TerminalMessage =
  | {
      type: 'exit'
      exitCode?: unknown
      signal?: unknown
    }
  | {
      type: 'output'
      data?: unknown
    }
  | {
      type: 'status'
    }

/**
 * Builds the daemon terminal WebSocket URL for a session.
 */
export function getSessionWatchWebSocketUrl(serverUrl: string, session: string): string {
  const baseUrl = new URL(serverUrl)
  const websocketUrl = new URL(`/ws/terminal/${encodeURIComponent(session)}`, baseUrl)

  websocketUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'

  return websocketUrl.toString()
}

/**
 * Streams session output from the daemon to the current terminal until closed.
 */
export async function watchSession(options: SessionWatchOptions, deps: WatchSessionDeps = {}): Promise<void> {
  const stdout = deps.stdout ?? process.stdout
  const stderr = deps.stderr ?? process.stderr
  const signalProcess = deps.signalProcess ?? process
  const WebSocketConstructor = deps.WebSocketConstructor ?? getDefaultWebSocketConstructor()
  const socket = new WebSocketConstructor(getSessionWatchWebSocketUrl(options.url, options.session))

  await new Promise<void>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      signalProcess.off('SIGINT', handleSigint)
    }
    const finish = (error?: unknown) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      if (error) {
        reject(error)
        return
      }

      resolve()
    }
    const handleSigint = () => {
      socket.close()
      finish()
    }

    signalProcess.once('SIGINT', handleSigint)

    socket.addEventListener('message', (event) => {
      const message = parseTerminalMessage(getMessageData(event))

      if (!message) {
        return
      }

      if (message.type === 'output') {
        stdout.write(String(message.data ?? ''))
        return
      }

      if (message.type === 'exit') {
        stderr.write(formatExitMessage(message))
        socket.close()
        finish()
      }
    })

    socket.addEventListener('error', () => {
      finish(new Error('fetch failed'))
    })

    socket.addEventListener('close', () => {
      finish()
    })
  })
}

/**
 * Extracts `.data` from unknown DOM-style WebSocket message events.
 */
function getMessageData(event: unknown): unknown {
  if (!event || typeof event !== 'object') {
    return undefined
  }

  return (event as { data?: unknown }).data
}

/**
 * Uses the Node global WebSocket constructor and produces a clear error if unavailable.
 */
function getDefaultWebSocketConstructor(): WatchWebSocketConstructor {
  const WebSocketConstructor = (globalThis as { WebSocket?: WatchWebSocketConstructor }).WebSocket

  if (!WebSocketConstructor) {
    throw new Error('WebSocket is not available in this Node.js runtime.')
  }

  return WebSocketConstructor
}

/**
 * Parses daemon terminal messages defensively; unknown frames are ignored.
 */
function parseTerminalMessage(rawData: unknown): TerminalMessage | null {
  try {
    const message = rawDataToString(rawData)
    const parsed = JSON.parse(message) as Partial<TerminalMessage>

    if (parsed.type === 'output' || parsed.type === 'status' || parsed.type === 'exit') {
      return parsed as TerminalMessage
    }

    return null
  } catch {
    return null
  }
}

/**
 * Normalizes the common WebSocket message payload shapes into UTF-8 text.
 */
function rawDataToString(rawData: unknown): string {
  if (typeof rawData === 'string') {
    return rawData
  }

  if (Buffer.isBuffer(rawData)) {
    return rawData.toString('utf8')
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(rawData)).toString('utf8')
  }

  if (ArrayBuffer.isView(rawData)) {
    return Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength).toString('utf8')
  }

  return String(rawData)
}

function formatExitMessage(message: Extract<TerminalMessage, { type: 'exit' }>): string {
  const exitCode = typeof message.exitCode === 'number' ? String(message.exitCode) : 'unknown'
  const signal = typeof message.signal === 'string' ? ` (${message.signal})` : ''

  return `\n[session exited: ${exitCode}${signal}]\n`
}
