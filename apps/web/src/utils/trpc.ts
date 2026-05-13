import { QueryClient } from '@tanstack/react-query';
import { getUntypedClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

import { trpc } from '../trpc.js';

export const queryClient = new QueryClient();

export function createDoppelTrpcClient() {
  const serverUrl = import.meta.env.VITE_DOPPEL_SERVER_URL ?? 'http://localhost:3000';

  return trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: new URL('/trpc', serverUrl).toString(),
      }),
    ],
  });
}

const daemonTrpcClient = getUntypedClient(createDoppelTrpcClient());

export function daemonQuery(path: string, input?: unknown) {
  return daemonTrpcClient.query(path, input);
}

export function daemonMutation(path: string, input?: unknown) {
  return daemonTrpcClient.mutation(path, input);
}
