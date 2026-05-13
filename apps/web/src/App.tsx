import { QueryClientProvider } from '@tanstack/react-query'

import { Layout } from './components/Layout.js'
import { DaemonPage } from './pages/DaemonPage.js'
import { trpc } from './trpc.js'
import { createDoppelTrpcClient, queryClient } from './utils/trpc.js'

const trpcClient = createDoppelTrpcClient()

/**
 * Renders the administrative Doppel web UI with shared tRPC and React Query
 * providers.
 */
export function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <DaemonPage />
        </Layout>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
