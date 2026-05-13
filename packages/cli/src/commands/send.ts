import { Command } from 'commander';

import { writeJson } from '../output.js';
import type { DoppelClientFactory } from '../trpc-client.js';
import { createDoppelClient, getDefaultServerUrl } from '../trpc-client.js';

const ACCEPTED_KEYS = new Set([
  'enter',
  'ctrl-c',
  'ctrl-d',
  'esc',
  'tab',
  'backspace',
  'up',
  'down',
  'left',
  'right',
]);

export interface SendCommandPayload {
  name: string;
  data: string;
  enter: boolean;
}

export interface SendKeyPayload {
  name: string;
  key: string;
}

export interface SendCommandOptions {
  session?: string;
  enter?: boolean;
  raw?: boolean;
}

export interface SendKeyOptions {
  session?: string;
}

export interface SendCommandDeps {
  clientFactory?: DoppelClientFactory;
  stdout?: NodeJS.WriteStream;
}

function decodeRawText(value: string): string {
  return value.replace(/\\(n|r|t|e|0|\\)/g, (_, sequence: string) => {
    switch (sequence) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'e':
        return '\x1b';
      case '0':
        return '\0';
      case '\\':
        return '\\';
      default:
        return sequence;
    }
  });
}

export function buildSendCommandPayload(
  text: readonly string[],
  options: SendCommandOptions,
): SendCommandPayload {
  const data = text.join(' ');

  return {
    name: options.session ?? 'default',
    data: options.raw === true ? decodeRawText(data) : data,
    enter: options.enter ?? true,
  };
}

export function buildSendKeyPayload(key: string, options: SendKeyOptions): SendKeyPayload {
  const normalizedKey = key.toLowerCase();

  if (!ACCEPTED_KEYS.has(normalizedKey)) {
    throw new Error(`Unsupported key "${key}".`);
  }

  return {
    name: options.session ?? 'default',
    key: normalizedKey,
  };
}

export function sendCommand(deps: SendCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient;
  const stdout = deps.stdout ?? process.stdout;

  return new Command('send-cmd')
    .description('Send text to a daemon session.')
    .argument('<text...>', 'Text to send.')
    .option('-s, --session <name>', 'Session name.', 'default')
    .option('--no-enter', 'Do not press Enter after sending text.')
    .option('--raw', 'Decode backslash escapes before sending text.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(
      async (
        text: string[],
        options: SendCommandOptions & {
          url: string;
        },
      ) => {
        const payload = buildSendCommandPayload(text, options);
        const result = await clientFactory(options.url).mutation('sessions.send', payload);
        writeJson(stdout, result);
      },
    );
}

export function sendKeyCommand(deps: SendCommandDeps = {}): Command {
  const clientFactory = deps.clientFactory ?? createDoppelClient;
  const stdout = deps.stdout ?? process.stdout;

  return new Command('send-key')
    .description('Send a special key to a daemon session.')
    .argument('<key>', 'Key to send.')
    .option('-s, --session <name>', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(
      async (
        key: string,
        options: SendKeyOptions & {
          url: string;
        },
      ) => {
        const payload = buildSendKeyPayload(key, options);
        const result = await clientFactory(options.url).mutation('sessions.sendKey', payload);
        writeJson(stdout, result);
      },
    );
}
