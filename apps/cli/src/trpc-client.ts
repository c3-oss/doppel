import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'

export const FALLBACK_SERVER_URL = 'http://localhost:3000'

export interface DoppelClient {
  query<TOutput = unknown>(path: string, input?: unknown): Promise<TOutput>
  mutation<TOutput = unknown>(path: string, input?: unknown): Promise<TOutput>
}

export type DoppelClientFactory = (serverUrl: string) => DoppelClient

export function getDefaultServerUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DOPPEL_SERVER_URL ?? FALLBACK_SERVER_URL
}

export function getTrpcUrl(serverUrl: string): string {
  return new URL('/trpc', serverUrl).toString()
}

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
