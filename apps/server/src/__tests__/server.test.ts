import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createServer } from '../http/server.js'
import { createAppRouter } from '../trpc/router.js'

const servers: Awaited<ReturnType<typeof createServer>>[] = []
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true })))
})

describe('doppel server', () => {
  it('responds to HTTP health checks', async () => {
    const server = await createServer({
      dataDir: await createTempDir(),
    })
    servers.push(server)

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      service: 'doppel-server',
    })
  })

  it('exposes tRPC health status', async () => {
    const caller = createAppRouter().createCaller({})

    await expect(caller.health()).resolves.toEqual({
      ok: true,
      service: 'doppel-server',
    })
  })
})

async function createTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doppel-server-test-'))
  tempDirs.push(tempDir)
  return tempDir
}
