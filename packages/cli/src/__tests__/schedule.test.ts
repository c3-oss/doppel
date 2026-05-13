import { Command } from 'commander'
import { describe, expect, it } from 'vitest'

import { buildScheduleCreatePayload, scheduleCommand } from '../commands/schedule.js'
import type { DoppelClient } from '../trpc-client.js'

function createStdout() {
  let output = ''

  return {
    stdout: {
      write(chunk: string) {
        output += chunk
        return true
      },
    } as NodeJS.WriteStream,
    output: () => output,
  }
}

describe('schedule command helpers', () => {
  it('builds create payloads with optional schedule fields', () => {
    expect(
      buildScheduleCreatePayload({
        name: 'daily-check',
        cron: '0 9 * * *',
        command: 'pnpm test',
        mode: 'session',
        session: 'default',
        disabled: true,
        cwd: '/tmp/project',
        shell: '/bin/zsh',
      }),
    ).toEqual({
      name: 'daily-check',
      cron: '0 9 * * *',
      command: 'pnpm test',
      mode: 'session',
      sessionName: 'default',
      enabled: false,
      cwd: '/tmp/project',
      shell: '/bin/zsh',
    })
  })

  it('requires core create options', () => {
    expect(() =>
      buildScheduleCreatePayload({
        name: 'missing-cron',
        command: 'pnpm test',
      }),
    ).toThrow('Missing required option --cron.')
  })

  it('rejects conflicting enabled flags', () => {
    expect(() =>
      buildScheduleCreatePayload({
        name: 'conflict',
        cron: '* * * * *',
        command: 'true',
        enabled: true,
        disabled: true,
      }),
    ).toThrow('Use only one of --enabled or --disabled.')
  })

  it('rejects invalid schedule modes before calling the server', () => {
    expect(() =>
      buildScheduleCreatePayload({
        name: 'invalid-mode',
        cron: '* * * * *',
        command: 'true',
        mode: 'command',
      }),
    ).toThrow('Invalid --mode "command". Expected one of: ephemeral, session.')
  })

  it('prints an empty schedule list when the daemon is offline', async () => {
    const stdout = createStdout()
    const client: DoppelClient = {
      query: async () => {
        throw new Error('fetch failed')
      },
      mutation: async <TOutput = unknown>() => null as TOutput,
    }
    const program = new Command().exitOverride()

    program.addCommand(
      scheduleCommand({
        clientFactory: () => client,
        stdout: stdout.stdout,
      }),
    )

    await program.parseAsync(['node', 'test', 'schedule', 'list'])

    expect(stdout.output()).toBe('[]\n')
  })
})
