import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { buildSendCommandPayload, buildSendKeyPayload, sendCommand } from '../commands/send.js';
import type { DoppelClient } from '../trpc-client.js';

function createStdout() {
  let output = '';

  return {
    stdout: {
      write(chunk: string) {
        output += chunk;
        return true;
      },
    } as NodeJS.WriteStream,
    output: () => output,
  };
}

describe('send command helpers', () => {
  it('builds send payloads from Commander varargs', () => {
    expect(
      buildSendCommandPayload(['pnpm', 'test', '--', 'health'], {
        session: 'work',
      }),
    ).toEqual({
      name: 'work',
      data: 'pnpm test -- health',
      enter: true,
    });
  });

  it('honors no-enter and raw escape decoding', () => {
    expect(
      buildSendCommandPayload(['first\\nsecond\\tline'], {
        session: 'default',
        enter: false,
        raw: true,
      }),
    ).toEqual({
      name: 'default',
      data: 'first\nsecond\tline',
      enter: false,
    });
  });

  it('normalizes accepted key names', () => {
    expect(buildSendKeyPayload('CTRL-C', { session: 'ops' })).toEqual({
      name: 'ops',
      key: 'ctrl-c',
    });
  });

  it('rejects unsupported keys', () => {
    expect(() => buildSendKeyPayload('home', {})).toThrow('Unsupported key "home".');
  });

  it('sends command payloads through an injected client', async () => {
    const stdout = createStdout();
    const calls: Array<{ url: string; path: string; input: unknown }> = [];
    const client: DoppelClient = {
      query: async <TOutput = unknown>() => null as TOutput,
      mutation: async <TOutput = unknown>(path: string, input?: unknown) => {
        calls.push({
          url: 'http://daemon.test',
          path,
          input,
        });
        return {
          z: 1,
          a: true,
        } as TOutput;
      },
    };
    const program = new Command().exitOverride();
    program.addCommand(
      sendCommand({
        clientFactory: () => client,
        stdout: stdout.stdout,
      }),
    );

    await program.parseAsync([
      'node',
      'test',
      'send-cmd',
      'echo',
      'hello',
      '--session',
      'work',
      '--no-enter',
      '--url',
      'http://daemon.test',
    ]);

    expect(calls).toEqual([
      {
        url: 'http://daemon.test',
        path: 'sessions.send',
        input: {
          name: 'work',
          data: 'echo hello',
          enter: false,
        },
      },
    ]);
    expect(stdout.output()).toBe('{"a":true,"z":1}\n');
  });
});
