import { chromium } from 'playwright-core'

/**
 * Options used when opening the browser-backed session view.
 */
export interface ViewOptions {
  /**
   * Session name to view.
   */
  session: string

  /**
   * Daemon base URL.
   */
  url: string
}

/**
 * Minimal browser page surface needed by the view opener.
 */
export interface BrowserPage {
  /**
   * Navigates the page to the daemon session view.
   */
  goto(url: string): Promise<unknown>
}

/**
 * Minimal browser instance surface needed by the view opener.
 */
export interface BrowserInstance {
  /**
   * Creates a new page.
   */
  newPage(): Promise<BrowserPage>

  /**
   * Registers a disconnect listener so the CLI can wait for browser closure.
   */
  on(event: 'disconnected', handler: () => void): unknown

  /**
   * Reports whether the browser is still connected when the launcher supports it.
   */
  isConnected?(): boolean
}

/**
 * Minimal browser launcher surface used by `openSessionViewWithLauncher`.
 */
export interface BrowserLauncher {
  /**
   * Starts a visible Chrome browser.
   */
  launch(options: { channel: 'chrome'; headless: false }): Promise<BrowserInstance>
}

/**
 * Function signature for opening a session view.
 */
export type OpenSessionView = (options: ViewOptions) => Promise<void>

/**
 * Builds the daemon `/session-view` URL for a session.
 */
export function getSessionViewUrl(serverUrl: string, session: string): string {
  const url = new URL('/session-view', serverUrl)
  url.searchParams.set('session', session)
  return url.toString()
}

/**
 * Opens the daemon terminal-only session view in a visible Chrome browser.
 */
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
