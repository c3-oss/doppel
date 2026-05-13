import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

export interface TrpcContext {
  requestId?: string;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const healthPayload = z.object({
  ok: z.literal(true),
  service: z.literal('doppel-server'),
});

export function createAppRouter() {
  return t.router({
    health: t.procedure.output(healthPayload).query(() => ({
      ok: true,
      service: 'doppel-server',
    })),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
