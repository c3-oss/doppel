import { chromium } from 'playwright-core'

export interface ViewOptions {
  session: string
  url: string
}

export interface BrowserPage {
  goto(url: string): Promise<unknown>
}

export interface BrowserInstance {
  newPage(): Promise<BrowserPage>
  on(event: 'disconnected', handler: () => void): unknown
  isConnected?(): boolean
}

export interface BrowserLauncher {
  launch(options: { channel: 'chrome'; headless: false }): Promise<BrowserInstance>
}

export type OpenSessionView = (options: ViewOptions) => Promise<void>

export function getSessionViewUrl(serverUrl: string, session: string): string {
  const url = new URL('/session-view', serverUrl)
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

  if (browser.isConnected?.() === false) {
    return
  }

  await new Promise<void>((resolve) => {
    browser.on('disconnected', resolve)
  })
}
