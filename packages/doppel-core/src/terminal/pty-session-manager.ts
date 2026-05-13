import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import pty, { type IDisposable, type IPty } from 'node-pty'

import { type TerminalKey, mapTerminalKey } from './keys.js'

/** Default terminal session name used when callers omit a name. */
export const DEFAULT_SESSION_NAME = 'default'
/** Default PTY column count for interactive and ephemeral sessions. */
export const DEFAULT_COLUMNS = 120
/** Default PTY row count for interactive and ephemeral sessions. */
export const DEFAULT_ROWS = 30
/** Default `TERM` value supplied to spawned PTY processes. */
export const DEFAULT_TERM = 'xterm-256color'
/** Default UTF-8 byte history retained for each interactive terminal session. */
export const DEFAULT_HISTORY_LIMIT_BYTES = 1024 * 1024
/** Default UTF-8 byte output retained for one-off PTY command runs. */
export const DEFAULT_EPHEMERAL_OUTPUT_LIMIT_BYTES = 256 * 1024

/** Options for creating or returning an interactive PTY session. */
export interface PtySessionOptions {
  /** Logical session name; blank names resolve to the default session. */
  name?: string
  /** Initial PTY column count. */
  cols?: number
  /** Initial PTY row count. */
  rows?: number
  /** Working directory for a newly spawned PTY. */
  cwd?: string
  /** Shell executable for a newly spawned PTY. */
  shell?: string
}

/** Serializable metadata for an interactive PTY session. */
export interface PtySessionSummary {
  /** Logical session name. */
  name: string
  /** Operating system process id for the PTY child process. */
  pid: number
  /** Current PTY column count. */
  cols: number
  /** Current PTY row count. */
  rows: number
  /** Working directory used when the PTY was created. */
  cwd: string
  /** Shell executable used when the PTY was created. */
  shell: string
  /** ISO timestamp for when the session was created. */
  createdAt: string
  /** ISO timestamp for the most recent known session activity. */
  updatedAt: string
}

/** Options for running a command in a one-off PTY. */
export interface PtyRunOptions {
  /** PTY column count for the command run. */
  cols?: number
  /** PTY row count for the command run. */
  rows?: number
  /** Working directory for the command run. */
  cwd?: string
  /** Shell executable used to evaluate the command. */
  shell?: string
  /** Maximum UTF-8 bytes of command output retained in the result. */
  outputLimitBytes?: number
}

/** Result from running a command in a one-off PTY. */
export interface PtyRunResult {
  /** Exit code reported by the PTY process. */
  exitCode: number
  /** Optional signal reported by the PTY process. */
  signal?: number
  /** Tail of command output, truncated to the configured byte limit. */
  output: string
}

/** Receives chunks emitted by an interactive PTY session. */
export type PtyOutputSubscriber = (data: string) => void
/** Receives the exit event emitted by an interactive PTY session. */
export type PtyExitSubscriber = (event: { exitCode: number; signal?: number }) => void
/** Removes a previously registered PTY subscription. */
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

/** Manages named interactive PTY sessions and one-off PTY command runs. */
export class PtySessionManager {
  /** Maximum UTF-8 bytes retained in each interactive session history buffer. */
  readonly historyLimitBytes: number

  #sessions = new Map<string, ManagedPtySession>()
  #ephemeralPtys = new Set<IPty>()

  /** Create an in-memory PTY session manager. */
  constructor(options: { historyLimitBytes?: number } = {}) {
    this.historyLimitBytes = options.historyLimitBytes ?? DEFAULT_HISTORY_LIMIT_BYTES
  }

  /** List all currently running interactive PTY sessions. */
  list(): PtySessionSummary[] {
    return [...this.#sessions.values()].map((session) => this.#toSummary(session))
  }

  /** Return metadata for a named session, or `null` when it is not running. */
  get(name = DEFAULT_SESSION_NAME): PtySessionSummary | null {
    const session = this.#sessions.get(normalizeSessionName(name))
    return session ? this.#toSummary(session) : null
  }

  /**
   * Return an existing session or create a new interactive PTY session.
   *
   * Creation options only apply when the named session is not already running.
   */
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

    // Keep a bounded history buffer so long-running sessions cannot grow memory without limit.
    session.dataDisposable = terminal.onData((data) => {
      session.history = appendWithByteLimit(session.history, data, this.historyLimitBytes)
      session.updatedAt = new Date().toISOString()

      for (const subscriber of session.outputSubscribers) {
        subscriber(data)
      }
    })

    // node-pty disposables must be released when the child exits.
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

  /** Return the retained output history for a named session. */
  getHistory(name = DEFAULT_SESSION_NAME): string {
    return this.#sessions.get(normalizeSessionName(name))?.history ?? ''
  }

  /** Subscribe to future output and optional exit events for a running session. */
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

  /** Write raw data to a running session and return its updated summary. */
  send(name: string, data: string): PtySessionSummary {
    const session = this.#requireSession(name)
    session.pty.write(data)
    session.updatedAt = new Date().toISOString()
    return this.#toSummary(session)
  }

  /** Write a mapped terminal key sequence to a running session. */
  sendKey(name: string, key: TerminalKey): PtySessionSummary {
    return this.send(name, mapTerminalKey(key))
  }

  /** Resize a running session and return its updated summary. */
  resize(name: string, cols: number, rows: number): PtySessionSummary {
    const session = this.#requireSession(name)
    session.pty.resize(cols, rows)
    session.updatedAt = new Date().toISOString()
    return this.#toSummary(session)
  }

  /** Kill a running session, returning whether a session existed. */
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

  /** Run a command in a one-off PTY and resolve with its exit status and output tail. */
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

  /** Terminate all managed PTYs and clear in-memory session state. */
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

/** Normalize blank or missing session names to the default session name. */
export function normalizeSessionName(name?: string): string {
  const normalized = name?.trim()
  return normalized && normalized.length > 0 ? normalized : DEFAULT_SESSION_NAME
}

/** Return the default working directory used for new PTY processes. */
export function getDefaultCwd(): string {
  return os.homedir()
}

/** Return the shell executable used when callers do not provide one. */
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

/** Return shell arguments that evaluate a single command string. */
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

  // Preserve the output tail because recent terminal data is most useful to callers.
  return Buffer.from(value, 'utf8').subarray(-limitBytes).toString('utf8')
}

function killPty(terminal: IPty): void {
  try {
    terminal.kill()
  } catch {
    // The child may have already exited by the time shutdown runs.
  }
}
