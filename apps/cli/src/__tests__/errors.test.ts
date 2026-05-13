import { describe, expect, it } from 'vitest'

import { formatCliError } from '../errors.js'

describe('CLI error formatting', () => {
  it('formats daemon connection failures without leaking transport stacks', () => {
    expect(formatCliError(new Error('fetch failed'))).toBe(
      'Unable to reach doppel server. Start it with `doppel-server start --daemon` or set DOPPEL_SERVER_URL.',
    )
  })

  it('preserves regular command errors', () => {
    expect(formatCliError(new Error('Missing required option --name.'))).toBe('Missing required option --name.')
  })
})
