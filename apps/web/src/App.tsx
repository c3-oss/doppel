import { QueryClientProvider } from '@tanstack/react-query';

import { Layout } from './components/Layout.js';
import { HealthPage } from './pages/HealthPage.js';
import { trpc } from './trpc.js';
import { createDoppelTrpcClient, queryClient } from './utils/trpc.js';

const trpcClient = createDoppelTrpcClient();

export function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <HealthPage />
        </Layout>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
