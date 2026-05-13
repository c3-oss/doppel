export const terminalKeyMap = {
  enter: '\r',
  'ctrl-c': '\x03',
  'ctrl-d': '\x04',
  esc: '\x1b',
  tab: '\t',
  backspace: '\x7f',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
} as const;

export type TerminalKey = keyof typeof terminalKeyMap;

export function mapTerminalKey(key: TerminalKey): string {
  return terminalKeyMap[key];
}
