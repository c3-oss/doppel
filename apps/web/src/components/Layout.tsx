import { Activity } from 'lucide-react'
import type { PropsWithChildren } from 'react'

/**
 * Props accepted by {@link Layout}.
 */
export type LayoutProps = PropsWithChildren

/**
 * Provides the shared application shell and static product header for web
 * pages.
 */
export function Layout({ children }: LayoutProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <Activity size={18} />
        </div>
        <div>
          <h1>Doppel</h1>
          <p>Server-first workspace for command line and web interactions.</p>
        </div>
      </header>
      {children}
    </main>
  )
}
