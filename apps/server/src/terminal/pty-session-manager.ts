import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import pty, { type IDisposable, type IPty } from 'node-pty'

import { type TerminalKey, mapTerminalKey } from './keys.js'

export const DEFAULT_SESSION_NAME = 'default'
export const DEFAULT_COLUMNS = 120
export const DEFAULT_ROWS = 30
export const DEFAULT_TERM = 'xterm-256color'
export const DEFAULT_HISTORY_LIMIT_BYTES = 1024 * 1024
export const DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES = 256 * 1024

export interface PtySessionOptions {
  name?: string
  cols?: number
  rows?: number
  cwd?: string
  shell?: string
}

export interface PtySessionSummary {
  name: string
  pid: number
  cols: number
  rows: number
  cwd: string
  shell: string
  createdAt: string
  updatedAt: string
}

export interface PtyRunOptions {
  cols?: number
  rows?: number
  cwd?: string
  shell?: string
  outputLimitBytes?: number
}

export interface PtyRunResult {
  exitCode: number
  signal?: number
  output: string
}

export type PtyOutputSubscriber = (data: string) => void
export type PtyExitSubscriber = (event: { exitCode: number; signal?: number }) => void
export type PtyUnsubscribe = () => void

interface ManagedPtySession {
  name: string
  pty: IPty
  cwd: string
  shell: string
  createdAt: string
  updatedAt: string
  history: string
  dataDisposable: IDisposable
  exitDisposable: IDisposable
  outputSubscribers: Set<PtyOutputSubscriber>
  exitSubscribers: Set<PtyExitSubscriber>
}

export class PtySessionManager {
  readonly historyLimitBytes: number

  #sessions = new Map<string, ManagedPtySession>()
  #ephemeralPtys = new Set<IPty>()

  constructor(options: { historyLimitBytes?: number } = {}) {
    this.historyLimitBytes = options.historyLimitBytes ?? DEFAULT_HISTORY_LIMIT_BYTES
  }

  list(): PtySessionSummary[] {
    return [...this.#sessions.values()].map((session) => this.#toSummary(session))
  }

  get(name = DEFAULT_SESSION_NAME): PtySessionSummary | null {
    const session = this.#sessions.get(normalizeSessionName(name))
    return session ? this.#toSummary(session) : null
  }

  ensure(options: PtySessionOptions = {}): PtySessionSummary {
    const name = normalizeSessionName(options.name)
    const existing = this.#sessions.get(name)

    if (existing) {
      return this.#toSummary(existing)
    }

    const cwd = options.cwd ?? getDefaultCwd()
    const shell = options.shell ?? getDefaultShell()
    const cols = options.cols ?? DEFAULT_COLUMNS
    const rows = options.rows ?? DEFAULT_ROWS
    const now = new Date().toISOString()

    const terminal = pty.spawn(shell, [], {
      name: DEFAULT_TERM,
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: DEFAULT_TERM,
      },
    })

    const session: ManagedPtySession = {
      name,
      pty: terminal,
      cwd,
      shell,
      createdAt: now,
      updatedAt: now,
      history: '',
      dataDisposable: { dispose() {} },
      exitDisposable: { dispose() {} },
      outputSubscribers: new Set(),
      exitSubscribers: new Set(),
    }

    session.dataDisposable = terminal.onData((data) => {
      session.history = appendWithByteLimit(session.history, data, this.historyLimitBytes)
      session.updatedAt = new Date().toISOString()

      for (const subscriber of session.outputSubscribers) {
        subscriber(data)
      }
    })

    session.exitDisposable = terminal.onExit((event) => {
      this.#sessions.delete(name)
      session.dataDisposable.dispose()
      session.exitDisposable.dispose()

      for (const subscriber of session.exitSubscribers) {
        subscriber(event)
      }
    })

    this.#sessions.set(name, session)
    return this.#toSummary(session)
  }

  getHistory(name = DEFAULT_SESSION_NAME): string {
    return this.#sessions.get(normalizeSessionName(name))?.history ?? ''
  }

  subscribe(name: string, onOutput: PtyOutputSubscriber, onExit?: PtyExitSubscriber): PtyUnsubscribe {
    const session = this.#sessions.get(normalizeSessionName(name))

    if (!session) {
      throw new Error(`Terminal session not found: ${name}`)
    }

    session.outputSubscribers.add(onOutput)

    if (onExit) {
      session.exitSubscribers.add(onExit)
    }

    return () => {
      session.outputSubscribers.delete(onOutput)

      if (onExit) {
        session.exitSubscribers.delete(onExit)
      }
    }
  }

  send(name: string, data: string): PtySessionSummary {
    const session = this.#requireSession(name)
    session.pty.write(data)
    session.updatedAt = new Date().toISOString()
    return this.#toSummary(session)
  }

  sendKey(name: string, key: TerminalKey): PtySessionSummary {
    return this.send(name, mapTerminalKey(key))
  }

  resize(name: string, cols: number, rows: number): PtySessionSummary {
    const session = this.#requireSession(name)
    session.pty.resize(cols, rows)
    session.updatedAt = new Date().toISOString()
    return this.#toSummary(session)
  }

  kill(name = DEFAULT_SESSION_NAME, signal?: string): boolean {
    const session = this.#sessions.get(normalizeSessionName(name))

    if (!session) {
      return false
    }

    if (process.platform === 'win32' || !signal) {
      session.pty.kill()
    } else {
      session.pty.kill(signal)
    }

    return true
  }

  runEphemeral(command: string, options: PtyRunOptions = {}): Promise<PtyRunResult> {
    const cwd = options.cwd ?? getDefaultCwd()
    const shell = options.shell ?? getDefaultShell()
    const outputLimitBytes = options.outputLimitBytes ?? DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES
    const terminal = pty.spawn(shell, getShellCommandArgs(shell, command), {
      name: DEFAULT_TERM,
      cols: options.cols ?? DEFAULT_COLUMNS,
      rows: options.rows ?? DEFAULT_ROWS,
      cwd,
      env: {
        ...process.env,
        TERM: DEFAULT_TERM,
      },
    })

    this.#ephemeralPtys.add(terminal)

    return new Promise((resolve) => {
      let output = ''

      const dataDisposable = terminal.onData((data) => {
        output = appendWithByteLimit(output, data, outputLimitBytes)
      })

      const exitDisposable = terminal.onExit((event) => {
        dataDisposable.dispose()
        exitDisposable.dispose()
        this.#ephemeralPtys.delete(terminal)
        resolve({
          exitCode: event.exitCode,
          signal: event.signal,
          output,
        })
      })
    })
  }

  close(): void {
    for (const session of this.#sessions.values()) {
      session.dataDisposable.dispose()
      session.exitDisposable.dispose()
      killPty(session.pty)
    }

    this.#sessions.clear()

    for (const terminal of this.#ephemeralPtys) {
      killPty(terminal)
    }

    this.#ephemeralPtys.clear()
  }

  #requireSession(name: string): ManagedPtySession {
    const session = this.#sessions.get(normalizeSessionName(name))

    if (!session) {
      throw new Error(`Terminal session not found: ${name}`)
    }

    return session
  }

  #toSummary(session: ManagedPtySession): PtySessionSummary {
    return {
      name: session.name,
      pid: session.pty.pid,
      cols: session.pty.cols,
      rows: session.pty.rows,
      cwd: session.cwd,
      shell: session.shell,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }
  }
}

export function normalizeSessionName(name?: string): string {
  const normalized = name?.trim()
  return normalized && normalized.length > 0 ? normalized : DEFAULT_SESSION_NAME
}

export function getDefaultCwd(): string {
  return os.homedir()
}

export function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe'
  }

  if (process.env.SHELL) {
    return process.env.SHELL
  }

  for (const candidate of ['/bin/bash', '/usr/bin/bash', '/bin/sh', '/usr/bin/sh']) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return 'sh'
}

export function getShellCommandArgs(shell: string, command: string): string[] {
  if (process.platform !== 'win32') {
    return ['-lc', command]
  }

  const shellName = path.basename(shell).toLowerCase()

  if (shellName === 'powershell.exe' || shellName === 'powershell' || shellName === 'pwsh.exe') {
    return ['-NoLogo', '-NoProfile', '-Command', command]
  }

  if (shellName === 'cmd.exe' || shellName === 'cmd') {
    return ['/d', '/s', '/c', command]
  }

  return ['-lc', command]
}

function appendWithByteLimit(current: string, next: string, limitBytes: number): string {
  const value = `${current}${next}`

  if (Buffer.byteLength(value, 'utf8') <= limitBytes) {
    return value
  }

  return Buffer.from(value, 'utf8').subarray(-limitBytes).toString('utf8')
}

function killPty(terminal: IPty): void {
  try {
    terminal.kill()
  } catch {
    // The child may have already exited by the time shutdown runs.
  }
}
