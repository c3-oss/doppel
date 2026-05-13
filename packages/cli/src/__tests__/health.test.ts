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
})
