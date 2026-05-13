import { describe, expect, it } from 'vitest'

import { writeJson, writeTable } from '../output.js'

function createStdout(columns?: number) {
  let output = ''

  return {
    stdout: {
      columns,
      write(chunk: string) {
        output += chunk
        return true
      },
    } as NodeJS.WriteStream,
    output: () => output,
  }
}

describe('writeTable', () => {
  it('renders table output with headers and rows', () => {
    const stdout = createStdout(80)

    writeTable(stdout.stdout, [{ name: 'default', pid: 123 }], {
      columns: ['name', 'pid'],
    })

    expect(stdout.output()).toBe('name     pid\n-------  ---\ndefault  123\n')
  })

  it('truncates cells to fit configured column caps', () => {
    const stdout = createStdout(80)

    writeTable(stdout.stdout, [{ path: '/Users/test/project/src/index.ts' }], {
      columns: ['path'],
      maxColumnWidths: {
        path: 12,
      },
    })

    expect(stdout.output().split('\n')[2]).toBe('/Users/te...')
  })

  it('shrinks the widest column to fit the terminal width', () => {
    const stdout = createStdout(24)

    writeTable(
      stdout.stdout,
      [
        {
          name: 'default',
          command: 'pnpm --filter @c3-oss/doppel-server test',
        },
      ],
      {
        columns: ['name', 'command'],
      },
    )

    for (const line of stdout.output().trimEnd().split('\n')) {
      expect(line.length).toBeLessThanOrEqual(24)
    }
  })

  it('keeps the tail of configured tail columns', () => {
    const stdout = createStdout(80)

    writeTable(stdout.stdout, [{ cwd: '/Users/test/project/src/index.ts' }], {
      columns: ['cwd'],
      maxColumnWidths: {
        cwd: 14,
      },
      tailColumns: new Set(['cwd']),
    })

    expect(stdout.output().split('\n')[2]).toBe('...rc/index.ts')
  })
})

describe('writeJson', () => {
  it('writes compact deterministic json', () => {
    const stdout = createStdout()

    writeJson(stdout.stdout, {
      z: 1,
      a: true,
    })

    expect(stdout.output()).toBe('{"a":true,"z":1}\n')
  })
})
