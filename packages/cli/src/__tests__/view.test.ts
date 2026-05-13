import { describe, expect, it } from 'vitest'

import { getSessionViewUrl, openSessionViewWithLauncher } from '../commands/view.js'
import type { BrowserLauncher } from '../commands/view.js'

describe('view command helpers', () => {
  it('builds session view URLs', () => {
    expect(getSessionViewUrl('http://localhost:3000/admin', 'default session')).toBe(
      'http://localhost:3000/?session=default+session',
    )
  })

  it('opens Chrome through an injected launcher', async () => {
    const visited: string[] = []
    const launches: unknown[] = []
    const launcher: BrowserLauncher = {
      async launch(options) {
        launches.push(options)

        return {
          on(event, handler) {
            if (event === 'disconnected') {
              queueMicrotask(handler)
            }
          },
          async newPage() {
            return {
              async goto(url: string) {
                visited.push(url)
              },
            }
          },
        }
      },
    }

    await openSessionViewWithLauncher(
      {
        session: 'demo',
        url: 'http://daemon.test',
      },
      launcher,
    )

    expect(launches).toEqual([
      {
        channel: 'chrome',
        headless: false,
      },
    ])
    expect(visited).toEqual(['http://daemon.test/?session=demo'])
  })
})
