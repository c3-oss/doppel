import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createServer, createWebUiServer } from '../http/server.js'
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

  it('keeps the daemon root separate from the administrative web UI', async () => {
    const server = await createServer({
      dataDir: await createTempDir(),
    })
    servers.push(server)

    const response = await server.inject({
      method: 'GET',
      url: '/',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toBe('doppel daemon is running\n')
  })

  it('serves a terminal-only browser view for sessions', async () => {
    const server = await createServer({
      dataDir: await createTempDir(),
    })
    servers.push(server)

    const response = await server.inject({
      method: 'GET',
      url: '/session-view?session=work',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('const sessionName = "work";')
    expect(response.body).toContain('/ws/terminal/')
    expect(response.body).toContain('background: #000')
    expect(response.body).not.toContain('daemon-layout')
  })

  it('serves session view assets from the daemon', async () => {
    const server = await createServer({
      dataDir: await createTempDir(),
    })
    servers.push(server)

    const response = await server.inject({
      method: 'GET',
      url: '/session-view/assets/xterm.css',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/css')
    expect(response.body).toContain('.xterm')
  })

  it('serves the administrative web UI separately with daemon runtime config', async () => {
    const webRoot = await createTempDir()
    await fs.writeFile(path.join(webRoot, 'index.html'), '<!doctype html><title>Doppel Admin</title>')
    const server = await createWebUiServer({
      daemonUrl: 'http://daemon.test:3000',
      webRoot,
    })
    servers.push(server)

    const configResponse = await server.inject({
      method: 'GET',
      url: '/doppel-config.js',
    })
    const indexResponse = await server.inject({
      method: 'GET',
      url: '/',
    })

    expect(configResponse.statusCode).toBe(200)
    expect(configResponse.headers['content-type']).toContain('text/javascript')
    expect(configResponse.body).toContain('"serverUrl":"http://daemon.test:3000"')
    expect(indexResponse.statusCode).toBe(200)
    expect(indexResponse.body).toContain('Doppel Admin')
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
