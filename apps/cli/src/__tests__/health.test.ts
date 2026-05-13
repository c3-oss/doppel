import { describe, expect, it } from 'vitest'

import { readHealthStatus } from '../commands/health.js'

describe('readHealthStatus', () => {
  it('reads and validates server health', async () => {
    const status = await readHealthStatus('http://localhost:3000', async (input) => {
      expect(String(input)).toBe('http://localhost:3000/health')

      return new Response(
        JSON.stringify({
          ok: true,
          service: 'doppel-server',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      )
    })

    expect(status).toEqual({
      ok: true,
      service: 'doppel-server',
    })
  })

  it('returns offline health when the daemon cannot be reached', async () => {
    const status = await readHealthStatus('http://localhost:3000', async () => {
      throw new Error('fetch failed')
    })

    expect(status).toEqual({
      ok: false,
      error: 'Unable to reach doppel server. Start it with `doppel-server start --daemon` or set DOPPEL_SERVER_URL.',
    })
  })
})
