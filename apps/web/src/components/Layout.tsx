import { Activity } from 'lucide-react';
import type { PropsWithChildren } from 'react';

export function Layout({ children }: PropsWithChildren) {
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
  );
}
