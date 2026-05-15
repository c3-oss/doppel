import { Command } from 'commander'
import { describe, expect, it } from 'vitest'

import { buildSessionEnsurePayload, sessionCommand } from '../commands/session.js'
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

describe('session command helpers', () => {
  it('builds session ensure payloads', () => {
    expect(
      buildSessionEnsurePayload('codex', {
        cwd: '/tmp/project',
        shell: '/bin/zsh',
        cols: '120',
        rows: '40',
      }),
    ).toEqual({
      name: 'codex',
      cwd: '/tmp/project',
      shell: '/bin/zsh',
      cols: 120,
      rows: 40,
    })
  })

  it('rejects invalid terminal dimensions', () => {
    expect(() =>
      buildSessionEnsurePayload('codex', {
        cols: '0',
      }),
    ).toThrow('cols must be a positive integer.')
  })

  it('ensures a session before opening its browser view', async () => {
    const calls: Array<{ path: string; input: unknown }> = []
    const opened: Array<{ session: string; url: string }> = []
    const client: DoppelClient = {
      query: async <TOutput = unknown>() => null as TOutput,
      mutation: async <TOutput = unknown>(path: string, input?: unknown) => {
        calls.push({ path, input })
        return { name: 'work' } as TOutput
      },
    }
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        clientFactory: () => client,
        openSessionView: async (options) => {
          opened.push(options)
        },
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'view', 'work', '--url', 'http://daemon.test'])

    expect(calls).toEqual([
      {
        path: 'sessions.ensure',
        input: {
          name: 'work',
        },
      },
    ])
    expect(opened).toEqual([
      {
        session: 'work',
        url: 'http://daemon.test',
      },
    ])
  })

  it('defaults session view to the default session', async () => {
    const calls: Array<{ path: string; input: unknown }> = []
    const opened: Array<{ session: string; url: string }> = []
    const client: DoppelClient = {
      query: async <TOutput = unknown>() => null as TOutput,
      mutation: async <TOutput = unknown>(path: string, input?: unknown) => {
        calls.push({ path, input })
        return { name: 'default' } as TOutput
      },
    }
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        clientFactory: () => client,
        openSessionView: async (options) => {
          opened.push(options)
        },
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'view'])

    expect(calls).toEqual([
      {
        path: 'sessions.ensure',
        input: {
          name: 'default',
        },
      },
    ])
    expect(opened).toEqual([
      {
        session: 'default',
        url: 'http://localhost:3000',
      },
    ])
  })

  it('prints the served session view URL without opening Chrome', async () => {
    const calls: Array<{ path: string; input: unknown }> = []
    const opened: Array<{ session: string; url: string }> = []
    const stdout = createStdout()
    const client: DoppelClient = {
      query: async <TOutput = unknown>() => null as TOutput,
      mutation: async <TOutput = unknown>(path: string, input?: unknown) => {
        calls.push({ path, input })
        return { name: 'work' } as TOutput
      },
    }
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        clientFactory: () => client,
        openSessionView: async (options) => {
          opened.push(options)
        },
        stdout: stdout.stdout,
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'view', 'work', '--url', 'http://daemon.test', '--serve'])

    expect(calls).toEqual([
      {
        path: 'sessions.ensure',
        input: {
          name: 'work',
        },
      },
    ])
    expect(opened).toEqual([])
    expect(stdout.output()).toBe('http://daemon.test/session-view?session=work\n')
  })

  it('defaults session watch to the default session', async () => {
    const watched: Array<{ session: string; url: string }> = []
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        openSessionWatch: async (options) => {
          watched.push(options)
        },
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'watch'])

    expect(watched).toEqual([
      {
        session: 'default',
        url: 'http://localhost:3000',
      },
    ])
  })

  it('watches the requested session', async () => {
    const watched: Array<{ session: string; url: string }> = []
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        openSessionWatch: async (options) => {
          watched.push(options)
        },
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'watch', 'work', '--url', 'http://daemon.test'])

    expect(watched).toEqual([
      {
        session: 'work',
        url: 'http://daemon.test',
      },
    ])
  })

  it('prints an empty session table when the daemon is offline', async () => {
    const stdout = createStdout()
    const client: DoppelClient = {
      query: async () => {
        throw new Error('fetch failed')
      },
      mutation: async <TOutput = unknown>() => null as TOutput,
    }
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        clientFactory: () => client,
        stdout: stdout.stdout,
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'list'])

    expect(stdout.output()).toBe('name  pid  size  cwd  shell  updatedAt\n----  ---  ----  ---  -----  ---------\n')
  })

  it('prints an empty session list as JSON when requested', async () => {
    const stdout = createStdout()
    const client: DoppelClient = {
      query: async () => {
        throw new Error('fetch failed')
      },
      mutation: async <TOutput = unknown>() => null as TOutput,
    }
    const program = new Command().exitOverride()

    program.addCommand(
      sessionCommand({
        clientFactory: () => client,
        stdout: stdout.stdout,
      }),
    )

    await program.parseAsync(['node', 'test', 'session', 'list', '--json'])

    expect(stdout.output()).toBe('[]\n')
  })
})
