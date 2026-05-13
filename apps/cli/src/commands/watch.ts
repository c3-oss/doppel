export interface SessionWatchOptions {
  session: string
  url: string
}

export interface WatchStreams {
  stderr?: NodeJS.WriteStream
  stdout?: NodeJS.WriteStream
}

export interface WatchWebSocket {
  addEventListener(event: 'close' | 'error' | 'message', listener: (event?: unknown) => void): void
  close(): void
}

export type WatchWebSocketConstructor = new (url: string) => WatchWebSocket

export type OpenSessionWatch = (options: SessionWatchOptions) => Promise<void>

interface WatchSessionDeps extends WatchStreams {
  signalProcess?: SignalProcess
  WebSocketConstructor?: WatchWebSocketConstructor
}

interface SignalProcess {
  off(event: 'SIGINT', listener: () => void): unknown
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

export function getSessionWatchWebSocketUrl(serverUrl: string, session: string): string {
  const baseUrl = new URL(serverUrl)
  const websocketUrl = new URL(`/ws/terminal/${encodeURIComponent(session)}`, baseUrl)

  websocketUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'

  return websocketUrl.toString()
}

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

function getMessageData(event: unknown): unknown {
  if (!event || typeof event !== 'object') {
    return undefined
  }

  return (event as { data?: unknown }).data
}

function getDefaultWebSocketConstructor(): WatchWebSocketConstructor {
  const WebSocketConstructor = (globalThis as { WebSocket?: WatchWebSocketConstructor }).WebSocket

  if (!WebSocketConstructor) {
    throw new Error('WebSocket is not available in this Node.js runtime.')
  }

  return WebSocketConstructor
}

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
