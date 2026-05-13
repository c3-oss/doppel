import { RefreshCcw } from 'lucide-react'

import { trpc } from '../trpc.js'

export function HealthPage() {
  const health = trpc.health.useQuery(undefined, {
    refetchOnWindowFocus: false,
  })

  return (
    <section className="status-panel">
      <div className="panel-heading">
        <div>
          <h2>Server Status</h2>
          <p>{health.data?.service ?? 'doppel-server'}</p>
        </div>
        <button
          aria-label="Refresh server status"
          className="icon-button"
          disabled={health.isFetching}
          onClick={() => void health.refetch()}
          type="button"
        >
          <RefreshCcw size={18} />
        </button>
      </div>

      <div className="status-row">
        <span className={health.data?.ok ? 'status-dot ok' : 'status-dot'} />
        <span>{health.isLoading ? 'Checking' : health.data?.ok ? 'Online' : 'Unavailable'}</span>
      </div>

      {health.error ? <pre className="error-box">{health.error.message}</pre> : null}
    </section>
  )
}
