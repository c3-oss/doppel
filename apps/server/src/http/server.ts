import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import fastifyWebsocket from '@fastify/websocket'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import Fastify, { type FastifyInstance } from 'fastify'

import { ScheduleScheduler } from '../schedules/scheduler.js'
import { ScheduleStore } from '../schedules/store.js'
import type { ServerServices } from '../services.js'
import { PtySessionManager } from '../terminal/pty-session-manager.js'
import { type TrpcContext, createAppRouter } from '../trpc/router.js'

export interface CreateServerOptions {
  dataDir?: string
  logger?: boolean
  services?: ServerServices
}

export interface StartServerOptions extends CreateServerOptions {
  host?: string
  port?: number
}

export interface CreateWebUiServerOptions {
  daemonUrl?: string
  logger?: boolean
  webRoot?: string
}

export interface StartWebUiServerOptions extends CreateWebUiServerOptions {
  host?: string
  port?: number
}

const SESSION_VIEW_ASSETS = {
  '/session-view/assets/xterm.css': {
    contentType: 'text/css; charset=utf-8',
    packagePath: '@xterm/xterm/css/xterm.css',
  },
  '/session-view/assets/xterm.mjs': {
    contentType: 'text/javascript; charset=utf-8',
    packagePath: '@xterm/xterm/lib/xterm.mjs',
  },
  '/session-view/assets/addon-fit.mjs': {
    contentType: 'text/javascript; charset=utf-8',
    packagePath: '@xterm/addon-fit/lib/addon-fit.mjs',
  },
} as const

const require = createRequire(import.meta.url)

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const services = options.services ?? createServerServices(options)
  const app = Fastify({
    logger: options.logger ?? false,
  })

  await app.register(cors, {
    origin: true,
  })
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        connectSrc: ["'self'", 'ws:', 'wss:'],
        defaultSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })

  app.get('/health', async () => ({
    ok: true,
    service: 'doppel-server',
  }))

  await app.register(fastifyWebsocket)

  app.get('/ws/terminal/:sessionName', { websocket: true }, (socket, request) => {
    const params = request.params as { sessionName?: string }
    const sessionName = params.sessionName ?? 'default'
    const session = services.terminal.ensure({ name: sessionName })

    sendJson(socket, {
      type: 'status',
      session,
    })

    const history = services.terminal.getHistory(sessionName)
    if (history.length > 0) {
      sendJson(socket, {
        type: 'output',
        data: history,
      })
    }

    const unsubscribe = services.terminal.subscribe(
      sessionName,
      (data) => {
        sendJson(socket, {
          type: 'output',
          data,
        })
      },
      (event) => {
        sendJson(socket, {
          type: 'exit',
          exitCode: event.exitCode,
          signal: event.signal,
        })
      },
    )

    socket.on('message', (rawMessage: unknown) => {
      const message = parseWebSocketMessage(rawMessage)
      const cols = message?.cols
      const rows = message?.rows

      if (message?.type === 'input' && typeof message.data === 'string') {
        services.terminal.send(sessionName, message.data)
        return
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
        services.terminal.resize(sessionName, cols, rows)
      }
    })

    socket.on('close', unsubscribe)
    socket.on('error', unsubscribe)
  })

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: createAppRouter(),
      createContext: ({ req }: CreateFastifyContextOptions): TrpcContext => ({
        requestId: req.id,
        services,
      }),
    },
  })

  app.get('/session-view', async (request, reply) => {
    const query = request.query as { session?: string }
    return reply.type('text/html; charset=utf-8').send(renderSessionViewHtml(query.session))
  })

  for (const [assetPath, asset] of Object.entries(SESSION_VIEW_ASSETS)) {
    app.get(assetPath, async (_, reply) => {
      return reply.type(asset.contentType).send(fs.createReadStream(require.resolve(asset.packagePath)))
    })
  }

  app.get('/', async (_, reply) => {
    return reply.type('text/plain; charset=utf-8').send('doppel daemon is running\n')
  })

  app.addHook('onClose', async () => {
    services.schedules.close()
    services.terminal.close()
    services.scheduleStore.close()
  })

  services.schedules.start()

  return app
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const app = await createServer({
    dataDir: options.dataDir,
    logger: options.logger ?? true,
    services: options.services,
  })
  const host = options.host ?? process.env.HOST ?? '0.0.0.0'
  const port = options.port ?? Number(process.env.PORT ?? 3000)

  await app.listen({ host, port })
  return app
}

export async function createWebUiServer(options: CreateWebUiServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  })
  const daemonUrl = options.daemonUrl ?? 'http://localhost:3000'
  const webRoot = resolveWebRoot(options.webRoot)

  app.get('/doppel-config.js', async (_, reply) => {
    return reply.type('text/javascript; charset=utf-8').send(
      `window.__DOPPEL_CONFIG__ = ${JSON.stringify({
        serverUrl: daemonUrl,
      })};\n`,
    )
  })

  if (webRoot) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
    })
  } else {
    app.get('/', async (_, reply) => {
      return reply
        .code(500)
        .type('text/html; charset=utf-8')
        .send(`<!doctype html>
<html>
  <head><title>Doppel</title></head>
  <body>
    <h1>Doppel web UI assets are missing</h1>
    <p>Run pnpm build before starting the packaged server.</p>
  </body>
</html>`)
    })
  }

  return app
}

export async function startWebUiServer(options: StartWebUiServerOptions = {}): Promise<FastifyInstance> {
  const app = await createWebUiServer({
    daemonUrl: options.daemonUrl,
    logger: options.logger ?? true,
    webRoot: options.webRoot,
  })
  const host = options.host ?? process.env.HOST ?? '0.0.0.0'
  const port = options.port ?? Number(process.env.WEB_UI_PORT ?? 3001)

  await app.listen({ host, port })
  return app
}

export function createServerServices(options: Pick<CreateServerOptions, 'dataDir'> = {}) {
  const terminal = new PtySessionManager()
  const scheduleStore = new ScheduleStore({
    dataDir: options.dataDir,
  })
  const schedules = new ScheduleScheduler({
    store: scheduleStore,
    terminal,
  })

  return {
    terminal,
    scheduleStore,
    schedules,
  }
}

function resolveWebRoot(webRoot?: string): string | undefined {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = webRoot
    ? [webRoot]
    : [
        path.join(moduleDir, '..', 'web'),
        path.join(process.cwd(), 'apps/web/dist'),
        path.join(process.cwd(), '../web/dist'),
        path.join(process.cwd(), 'dist/web'),
      ]

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (fs.existsSync(path.join(resolved, 'index.html'))) {
      return resolved
    }
  }

  return undefined
}

function renderSessionViewHtml(sessionName?: string): string {
  const normalizedSessionName = sessionName?.trim() || 'default'
  const serializedSessionName = JSON.stringify(normalizedSessionName)

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Doppel Session</title>
    <link rel="stylesheet" href="/session-view/assets/xterm.css">
    <style>
      html,
      body,
      #terminal {
        width: 100%;
        height: 100%;
      }

      body {
        overflow: hidden;
        margin: 0;
        background: #000;
      }

      #terminal {
        background: #000;
      }

      .xterm {
        height: 100%;
        padding: 8px;
      }
    </style>
  </head>
  <body>
    <div id="terminal"></div>
    <script type="module">
      import { Terminal } from '/session-view/assets/xterm.mjs';
      import { FitAddon } from '/session-view/assets/addon-fit.mjs';

      const sessionName = ${serializedSessionName};
      const terminalHost = document.getElementById('terminal');
      const terminal = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        scrollback: 10000,
        theme: {
          background: '#000000',
          foreground: '#f8fafc',
          cursor: '#f8fafc',
          selectionBackground: '#334155'
        }
      });
      const fitAddon = new FitAddon();

      terminal.loadAddon(fitAddon);
      terminal.open(terminalHost);
      terminal.focus();

      const fit = () => {
        fitAddon.fit();
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
          }));
        }
      };
      const baseUrl = new URL(window.location.href);
      const websocketUrl = new URL('/ws/terminal/' + encodeURIComponent(sessionName), baseUrl);
      websocketUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(websocketUrl);

      terminal.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'input',
            data
          }));
        }
      });

      socket.addEventListener('open', fit);
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'output') {
            terminal.write(String(message.data ?? ''));
          } else if (message.type === 'exit') {
            const exitCode = typeof message.exitCode === 'number' ? String(message.exitCode) : 'unknown';
            const signal = typeof message.signal === 'string' ? ' (' + message.signal + ')' : '';
            terminal.writeln('\\r\\n[process exited: ' + exitCode + signal + ']');
          }
        } catch {
          terminal.write(String(event.data));
        }
      });
      socket.addEventListener('close', () => terminal.writeln('\\r\\n[session disconnected]'));
      socket.addEventListener('error', () => terminal.writeln('\\r\\n[session connection error]'));

      window.addEventListener('resize', fit);
      new ResizeObserver(fit).observe(terminalHost);
      window.setTimeout(fit, 0);
    </script>
  </body>
</html>`
}

function sendJson(socket: { readyState: number; send(data: string): void }, value: unknown): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(value))
  }
}

function parseWebSocketMessage(rawMessage: unknown): Record<string, unknown> | null {
  try {
    const message = rawMessageToString(rawMessage)
    const parsed = JSON.parse(message)

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function rawMessageToString(rawMessage: unknown): string {
  if (typeof rawMessage === 'string') {
    return rawMessage
  }

  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.toString('utf8')
  }

  if (Array.isArray(rawMessage) && rawMessage.every(Buffer.isBuffer)) {
    return Buffer.concat(rawMessage).toString('utf8')
  }

  if (rawMessage instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(rawMessage)).toString('utf8')
  }

  throw new Error('Unsupported WebSocket message type.')
}
