import { describe, expect, it } from 'vitest'

import { getSessionWatchWebSocketUrl, watchSession } from '../commands/watch.js'
import type { WatchWebSocket } from '../commands/watch.js'

class FakeWebSocket implements WatchWebSocket {
  static instances: FakeWebSocket[] = []

  readonly listeners = new Map<string, Array<(event?: unknown) => void>>()
  readonly url: string
  closed = false

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(event: 'close' | 'error' | 'message', listener: (event?: unknown) => void): void {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
  }

  close(): void {
    this.closed = true
    this.emit('close')
  }

  emit(event: 'close' | 'error' | 'message', payload?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload)
    }
  }
}

function createStream() {
  let output = ''

  return {
    stream: {
      write(chunk: string) {
        output += chunk
        return true
      },
    } as NodeJS.WriteStream,
    output: () => output,
  }
}

function createSignalProcess() {
  const handlers = new Set<() => void>()

  return {
    process: {
      off(_event: 'SIGINT', listener: () => void) {
        handlers.delete(listener)
      },
      once(_event: 'SIGINT', listener: () => void) {
        handlers.add(listener)
      },
    },
    sigint() {
      for (const handler of handlers) {
        handler()
      }
    },
  }
}

function resetFakeWebSockets() {
  FakeWebSocket.instances = []
}

function getLastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances[0]

  if (!socket) {
    throw new Error('Expected fake websocket to be constructed.')
  }

  return socket
}

describe('session watch helpers', () => {
  it('builds terminal websocket URLs', () => {
    expect(getSessionWatchWebSocketUrl('http://localhost:3000', 'default')).toBe(
      'ws://localhost:3000/ws/terminal/default',
    )
    expect(getSessionWatchWebSocketUrl('https://daemon.test/base', 'default session')).toBe(
      'wss://daemon.test/ws/terminal/default%20session',
    )
  })

  it('writes output messages to stdout', async () => {
    resetFakeWebSockets()
    const stdout = createStream()
    const signalProcess = createSignalProcess()
    const watchPromise = watchSession(
      {
        session: 'work',
        url: 'http://daemon.test',
      },
      {
        WebSocketConstructor: FakeWebSocket,
        signalProcess: signalProcess.process,
        stdout: stdout.stream,
      },
    )
    const socket = getLastSocket()

    socket.emit('message', {
      data: JSON.stringify({
        type: 'output',
        data: 'hello\n',
      }),
    })
    socket.emit('close')
    await watchPromise

    expect(socket.url).toBe('ws://daemon.test/ws/terminal/work')
    expect(stdout.output()).toBe('hello\n')
  })

  it('ignores status messages in stdout', async () => {
    resetFakeWebSockets()
    const stdout = createStream()
    const signalProcess = createSignalProcess()
    const watchPromise = watchSession(
      {
        session: 'work',
        url: 'http://daemon.test',
      },
      {
        WebSocketConstructor: FakeWebSocket,
        signalProcess: signalProcess.process,
        stdout: stdout.stream,
      },
    )
    const socket = getLastSocket()

    socket.emit('message', {
      data: JSON.stringify({
        type: 'status',
        session: {
          name: 'work',
        },
      }),
    })
    socket.emit('close')
    await watchPromise

    expect(stdout.output()).toBe('')
  })

  it('prints exit messages to stderr and closes the watcher', async () => {
    resetFakeWebSockets()
    const stderr = createStream()
    const signalProcess = createSignalProcess()
    const watchPromise = watchSession(
      {
        session: 'work',
        url: 'http://daemon.test',
      },
      {
        WebSocketConstructor: FakeWebSocket,
        signalProcess: signalProcess.process,
        stderr: stderr.stream,
      },
    )
    const socket = getLastSocket()

    socket.emit('message', {
      data: JSON.stringify({
        type: 'exit',
        exitCode: 0,
      }),
    })
    await watchPromise

    expect(socket.closed).toBe(true)
    expect(stderr.output()).toBe('\n[session exited: 0]\n')
  })

  it('closes the watcher on SIGINT without killing the session', async () => {
    resetFakeWebSockets()
    const signalProcess = createSignalProcess()
    const watchPromise = watchSession(
      {
        session: 'work',
        url: 'http://daemon.test',
      },
      {
        WebSocketConstructor: FakeWebSocket,
        signalProcess: signalProcess.process,
      },
    )
    const socket = getLastSocket()

    signalProcess.sigint()
    await watchPromise

    expect(socket.closed).toBe(true)
  })

  it('rejects connection errors with a daemon connection failure', async () => {
    resetFakeWebSockets()
    const signalProcess = createSignalProcess()
    const watchPromise = watchSession(
      {
        session: 'work',
        url: 'http://daemon.test',
      },
      {
        WebSocketConstructor: FakeWebSocket,
        signalProcess: signalProcess.process,
      },
    )
    const socket = getLastSocket()

    socket.emit('error')

    await expect(watchPromise).rejects.toThrow('fetch failed')
  })
})
