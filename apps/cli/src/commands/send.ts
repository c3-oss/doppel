import { Command } from 'commander'

import { writeJson } from '../output.js'
import type { DoppelClientFactory } from '../trpc-client.js'
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js'

const ACCEPTED_KEYS = new Set(['enter', 'ctrl-c', 'ctrl-d', 'esc', 'tab', 'backspace', 'up', 'down', 'left', 'right'])

/**
 * Payload sent to the daemon for text input.
 */
export interface SendCommandPayload {
  /**
   * Target session name.
   */
  name: string

  /**
   * Text sent to the session.
   */
  data: string

  /**
   * Whether the daemon should press Enter after sending the text.
   */
  enter: boolean
}

/**
 * Payload sent to the daemon for special key input.
 */
export interface SendKeyPayload {
  /**
   * Target session name.
   */
  name: string

  /**
   * Normalized key name accepted by the daemon.
   */
  key: string
}

/**
 * Commander option bag accepted by `doppel send-cmd`.
 */
export interface SendCommandOptions {
  /**
   * Target session name.
   */
  session?: string

  /**
   * Whether to press Enter after sending text.
   */
  enter?: boolean

  /**
   * Whether to decode supported backslash escapes before sending text.
   */
  raw?: boolean

  /**
   * Whether to emit JSON instead of a status line.
   */
  json?: boolean
}

/**
 * Commander option bag accepted by `doppel send-key`.
 */
export interface SendKeyOptions {
  /**
   * Target session name.
   */
  session?: string

  /**
   * Whether to emit JSON instead of a status line.
   */
  json?: boolean
}

/**
 * Injectable dependencies for send commands.
 */
export interface SendCommandDeps {
  /**
   * Client factory used to talk to the daemon.
   */
  clientFactory?: DoppelClientFactory

  /**
   * Output stream for command responses.
   */
  stdout?: NodeJS.WriteStream
}

interface SessionSummary {
  name: string
}

function decodeRawText(value: string): string {
  return value.replace(/\\(n|r|t|e|0|\\)/g, (_, sequence: string) => {
    switch (sequence) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      case 'e':
        return '\x1b'
      case '0':
        return '\0'
      case '\\':
        return '\\'
      default:
        return sequence
    }
  })
}

/**
 * Converts send command arguments and options into the daemon text payload.
 */
export function buildSendCommandPayload(text: readonly string[], options: SendCommandOptions): SendCommandPayload {
  const data = text.join(' ')

  return {
    name: options.session ?? 'default',
    data: options.raw === true ? decodeRawText(data) : data,
    enter: options.enter ?? true,
  }
}

/**
 * Converts a key name and options into the daemon key payload.
 */
export function buildSendKeyPayload(key: string, options: SendKeyOptions): SendKeyPayload {
  const normalizedKey = key.toLowerCase()

  if (!ACCEPTED_KEYS.has(normalizedKey)) {
    throw new Error(`Unsupported key "${key}".`)
  }

  return {
    name: options.session ?? 'default',
    key: normalizedKey,
  }
}

/**
 * Creates the `doppel send-cmd` command.
 */
export function sendCommand(deps: SendCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient
  const stdout = deps.stdout ?? process.stdout

  return new Command('send-cmd')
    .description('Send text to a daemon session.')
    .argument('<text...>', 'Text to send.')
    .option('-s, --session <name>', 'Session name.', 'default')
    .option('--no-enter', 'Do not press Enter after sending text.')
    .option('--raw', 'Decode backslash escapes before sending text.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(
      async (
        text: string[],
        options: SendCommandOptions & {
          url: string
        },
      ) => {
        const payload = buildSendCommandPayload(text, options)
        const result = await clientFactory(options.url).mutation<SessionSummary>('sessions.send', payload)

        if (options.json === true) {
          writeJson(stdout, result)
          return
        }

        stdout.write(`sent command to session ${result.name}\n`)
      },
    )
}

/**
 * Creates the `doppel send-key` command.
 */
export function sendKeyCommand(deps: SendCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient
  const stdout = deps.stdout ?? process.stdout

  return new Command('send-key')
    .description('Send a special key to a daemon session.')
    .argument('<key>', 'Key to send.')
    .option('-s, --session <name>', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(
      async (
        key: string,
        options: SendKeyOptions & {
          url: string
        },
      ) => {
        const payload = buildSendKeyPayload(key, options)
        const result = await clientFactory(options.url).mutation<SessionSummary>('sessions.sendKey', payload)

        if (options.json === true) {
          writeJson(stdout, result)
          return
        }

        stdout.write(`sent key ${payload.key} to session ${result.name}\n`)
      },
    )
}
