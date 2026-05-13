import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createDoppel } from '../doppel.js'

const tempDirs: string[] = []
const doppels: Array<ReturnType<typeof createDoppel>> = []

afterEach(async () => {
  for (const doppel of doppels.splice(0)) {
    doppel.close()
  }
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('createDoppel (embedded)', () => {
  it('runs an ephemeral command and returns its output', async () => {
    const doppel = createDoppel({ dataDir: await createTempDir() })
    doppels.push(doppel)

    const result = await doppel.terminal.runEphemeral('printf doppel')

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('doppel')
  })

  it('exposes schedule CRUD through the engine', async () => {
    const doppel = createDoppel({ dataDir: await createTempDir() })
    doppels.push(doppel)

    const created = doppel.schedules.create({
      name: 'sample',
      cron: '*/5 * * * *',
      command: 'echo hi',
      enabled: false,
    })

    expect(created.id).toBeTruthy()
    expect(doppel.schedules.list()).toHaveLength(1)

    expect(doppel.schedules.delete(created.id)).toBe(true)
    expect(doppel.schedules.list()).toHaveLength(0)
  })

  it('close() shuts down all subsystems', async () => {
    const doppel = createDoppel({ dataDir: await createTempDir() })

    doppel.terminal.ensure({ name: 'lifecycle' })
    expect(doppel.terminal.list()).toHaveLength(1)

    expect(() => doppel.close()).not.toThrow()
  })
})

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doppel-core-test-'))
  tempDirs.push(dir)
  return dir
}
