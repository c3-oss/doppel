import fs from 'node:fs';
import path from 'node:path';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';

import { ScheduleScheduler } from '../schedules/scheduler.js';
import { ScheduleStore } from '../schedules/store.js';
import type { ServerServices } from '../services.js';
import { PtySessionManager } from '../terminal/pty-session-manager.js';
import { type TrpcContext, createAppRouter } from '../trpc/router.js';

export interface CreateServerOptions {
  dataDir?: string;
  logger?: boolean;
  services?: ServerServices;
  webRoot?: string;
}

export interface StartServerOptions extends CreateServerOptions {
  host?: string;
  port?: number;
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const services = options.services ?? createServerServices(options);
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

  await app.register(fastifyWebsocket);

  app.get('/ws/terminal/:sessionName', { websocket: true }, (socket, request) => {
    const params = request.params as { sessionName?: string };
    const sessionName = params.sessionName ?? 'default';
    const session = services.terminal.ensure({ name: sessionName });

    sendJson(socket, {
      type: 'status',
      session,
    });

    const history = services.terminal.getHistory(sessionName);
    if (history.length > 0) {
      sendJson(socket, {
        type: 'output',
        data: history,
      });
    }

    const unsubscribe = services.terminal.subscribe(
      sessionName,
      (data) => {
        sendJson(socket, {
          type: 'output',
          data,
        });
      },
      (event) => {
        sendJson(socket, {
          type: 'exit',
          exitCode: event.exitCode,
          signal: event.signal,
        });
      },
    );

    socket.on('message', (rawMessage: unknown) => {
      const message = parseWebSocketMessage(rawMessage);
      const cols = message?.cols;
      const rows = message?.rows;

      if (message?.type === 'input' && typeof message.data === 'string') {
        services.terminal.send(sessionName, message.data);
        return;
      }

      if (
        message?.type === 'resize' &&
        typeof cols === 'number' &&
        typeof rows === 'number' &&
        Number.isInteger(cols) &&
        Number.isInteger(rows) &&
        cols > 0 &&
        rows > 0
      ) {
        services.terminal.resize(sessionName, cols, rows);
      }
    });

    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: createAppRouter(),
      createContext: ({ req }: CreateFastifyContextOptions): TrpcContext => ({
        requestId: req.id,
        services,
      }),
    },
  });

  const webRoot = resolveWebRoot(options.webRoot);
  if (webRoot) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
    });
  } else {
    app.get('/', async (_, reply) => {
      return reply.type('text/html').send(`<!doctype html>
<html>
  <head><title>Doppel</title></head>
  <body>
    <h1>Doppel daemon is running</h1>
    <p>Build the web UI or pass --web-root to serve the browser app.</p>
  </body>
</html>`);
    });
  }

  app.addHook('onClose', async () => {
    services.schedules.close();
    services.terminal.close();
    services.scheduleStore.close();
  });

  services.schedules.start();

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

export function createServerServices(options: Pick<CreateServerOptions, 'dataDir'> = {}) {
  const terminal = new PtySessionManager();
  const scheduleStore = new ScheduleStore({
    dataDir: options.dataDir,
  });
  const schedules = new ScheduleScheduler({
    store: scheduleStore,
    terminal,
  });

  return {
    terminal,
    scheduleStore,
    schedules,
  };
}

function resolveWebRoot(webRoot?: string): string | undefined {
  const candidates = webRoot
    ? [webRoot]
    : [path.join(process.cwd(), 'apps/web/dist'), path.join(process.cwd(), 'dist/web')];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, 'index.html'))) {
      return resolved;
    }
  }

  return undefined;
}

function sendJson(socket: { readyState: number; send(data: string): void }, value: unknown): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(value));
  }
}

function parseWebSocketMessage(rawMessage: unknown): Record<string, unknown> | null {
  try {
    const message = rawMessageToString(rawMessage);
    const parsed = JSON.parse(message);

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function rawMessageToString(rawMessage: unknown): string {
  if (typeof rawMessage === 'string') {
    return rawMessage;
  }

  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.toString('utf8');
  }

  if (Array.isArray(rawMessage) && rawMessage.every(Buffer.isBuffer)) {
    return Buffer.concat(rawMessage).toString('utf8');
  }

  if (rawMessage instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(rawMessage)).toString('utf8');
  }

  throw new Error('Unsupported WebSocket message type.');
}
