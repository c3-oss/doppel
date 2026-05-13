import { Command } from 'commander'
import { chromium } from 'playwright-core'

import { getDefaultServerUrl } from '../trpc-client.js'

export interface ViewOptions {
  session: string
  url: string
}

export interface BrowserPage {
  goto(url: string): Promise<unknown>
}

export interface BrowserInstance {
  newPage(): Promise<BrowserPage>
}

export interface BrowserLauncher {
  launch(options: { channel: 'chrome'; headless: false }): Promise<BrowserInstance>
}

export type OpenSessionView = (options: ViewOptions) => Promise<void>

export interface ViewCommandDeps {
  openSessionView?: OpenSessionView
}

export function getSessionViewUrl(serverUrl: string, session: string): string {
  const url = new URL('/', serverUrl)
  url.searchParams.set('session', session)
  return url.toString()
}

export async function openSessionViewWithLauncher(
  options: ViewOptions,
  launcher: BrowserLauncher = chromium,
): Promise<void> {
  const browser = await launcher.launch({
    channel: 'chrome',
    headless: false,
  })
  const page = await browser.newPage()

  await page.goto(getSessionViewUrl(options.url, options.session))
}

export function viewCommand(deps: ViewCommandDeps = {}): Command {
  const openSessionView = deps.openSessionView ?? openSessionViewWithLauncher

  return new Command('view')
    .description('Open a browser view for a daemon session.')
    .option('-s, --session <name>', 'Session name.', 'default')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .action(async (options: ViewOptions) => {
      await openSessionView(options)
    })
}
