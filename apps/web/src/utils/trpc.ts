import { QueryClient } from '@tanstack/react-query'
import { getUntypedClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

import { getDoppelServerUrl } from '../config.js'
import { trpc } from '../trpc.js'

/**
 * Shared React Query client used by the administrative web UI.
 */
export const queryClient = new QueryClient()

/**
 * Creates a browser tRPC client pointed at the configured Doppel daemon.
 */
export function createDoppelTrpcClient() {
  const serverUrl = getDoppelServerUrl()

  return trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: new URL('/trpc', serverUrl).toString(),
      }),
    ],
  })
}

const daemonTrpcClient = getUntypedClient(createDoppelTrpcClient())

/**
 * Calls an arbitrary daemon tRPC query by procedure path.
 *
 * The daemon dashboard uses this untyped helper for procedures whose response
 * shapes are normalized defensively at the page boundary.
 */
export function daemonQuery(path: string, input?: unknown) {
  return daemonTrpcClient.query(path, input)
}

/**
 * Calls an arbitrary daemon tRPC mutation by procedure path.
 *
 * Keep user input and response validation at the caller because this helper is
 * intentionally path-based.
 */
export function daemonMutation(path: string, input?: unknown) {
  return daemonTrpcClient.mutation(path, input)
}
