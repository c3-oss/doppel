import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';

import { type TrpcContext, createAppRouter } from '../trpc/router.js';

export interface CreateServerOptions {
  logger?: boolean;
}

export interface StartServerOptions extends CreateServerOptions {
  host?: string;
  port?: number;
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  await app.register(cors, {
    origin: true,
  });
  await app.register(helmet);

  app.get('/health', async () => ({
    ok: true,
    service: 'doppel-server',
  }));

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: createAppRouter(),
      createContext: ({ req }: CreateFastifyContextOptions): TrpcContext => ({
        requestId: req.id,
      }),
    },
  });

  return app;
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const app = await createServer({
    logger: options.logger ?? true,
  });
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const port = options.port ?? Number(process.env.PORT ?? 3000);

  await app.listen({ host, port });
  return app;
}
