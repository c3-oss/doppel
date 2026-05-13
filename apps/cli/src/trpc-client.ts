import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

/**
 * Default daemon base URL used when `DOPPEL_SERVER_URL` is not set.
 */
export const FALLBACK_SERVER_URL = 'http://localhost:3000'

/**
 * Minimal untyped tRPC client surface used by CLI commands.
 */
export interface DoppelClient {
  /**
   * Executes a read-only tRPC procedure.
   */
  query<TOutput = unknown>(path: string, input?: unknown): Promise<TOutput>

  /**
   * Executes a mutating tRPC procedure.
   */
  mutation<TOutput = unknown>(path: string, input?: unknown): Promise<TOutput>
}

/**
 * Factory used by commands to create daemon clients for a selected server URL.
 */
export type DoppelClientFactory = (serverUrl: string) => DoppelClient

/**
 * Resolves the daemon base URL from an environment map.
 */
export function getDefaultServerUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DOPPEL_SERVER_URL ?? FALLBACK_SERVER_URL
}

/**
 * Builds the tRPC endpoint URL for a daemon base URL.
 */
export function getTrpcUrl(serverUrl: string): string {
  return new URL('/trpc', serverUrl).toString()
}

/**
 * Creates the default HTTP tRPC client used by CLI commands.
 */
export function createDoppelClient(serverUrl = getDefaultServerUrl()): DoppelClient {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: getTrpcUrl(serverUrl),
      }),
    ],
  })

  return {
    query: async <TOutput = unknown>(path: string, input?: unknown) => client.query(path, input) as Promise<TOutput>,
    mutation: async <TOutput = unknown>(path: string, input?: unknown) =>
      client.mutation(path, input) as Promise<TOutput>,
  }
}
