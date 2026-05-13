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
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'

import { type Doppel, createDoppel } from '@c3-oss/doppel-core'

import { type TrpcContext, createAppRouter } from '../trpc/router.js'

/**
 * Options for constructing the daemon Fastify app without binding a socket.
 *
 * The daemon app owns the `/health`, `/trpc`, `/ws/terminal/:sessionName`,
 * `/session-view`, and daemon root routes. Use {@link startServer} when the app
 * should also listen on a network port.
 */
export interface CreateServerOptions {
  /** Directory used by the default Doppel engine for persisted daemon state. */
  dataDir?: string
  /**
   * Enables Fastify request logging.
   *
   * Defaults to disabled for {@link createServer}; {@link startServer} enables
   * logging unless callers explicitly pass `false`.
   */
  logger?: boolean
  /** Log encoding used when {@link logger} is enabled. */
  logFormat?: ServerLogFormat
  /**
   * Prebuilt Doppel engine to mount into the server.
   *
   * This is primarily for tests and embedders that need to share an engine
   * instance. The server closes the engine from its `onClose` hook.
   */
  doppel?: Doppel
}

/** Options for constructing and listening with the daemon server. */
export interface StartServerOptions extends CreateServerOptions {
  /** Host interface to bind. Defaults to `HOST` or `0.0.0.0`. */
  host?: string
  /** TCP port to bind. Defaults to `PORT` or `3000`. */
  port?: number
}

/**
 * Options for constructing the administrative web UI server.
 *
 * The web UI server is intentionally separate from the daemon/tRPC server. It
 * serves static browser assets and a runtime config script that points clients
 * at the daemon URL.
 */
export interface CreateWebUiServerOptions {
  /** Base URL for the daemon server exposed through `/doppel-config.js`. */
  daemonUrl?: string
  /**
   * Enables Fastify request logging.
   *
   * Defaults to disabled for {@link createWebUiServer};
   * {@link startWebUiServer} enables logging unless callers pass `false`.
   */
  logger?: boolean
  /** Log encoding used when {@link logger} is enabled. */
  logFormat?: ServerLogFormat
  /** Directory containing the built web UI assets, including `index.html`. */
  webRoot?: string
}

/** Options for constructing and listening with the administrative web UI. */
export interface StartWebUiServerOptions extends CreateWebUiServerOptions {
  /** Host interface to bind. Defaults to `HOST` or `0.0.0.0`. */
  host?: string
  /** TCP port to bind. Defaults to `WEB_UI_PORT` or `3001`. */
  port?: number
}

/**
 * Minimal browser terminal assets served by the daemon for `/session-view`.
 *
 * These are loaded from package files at request time so the terminal-only
 * browser page works in packaged builds without depending on the admin web UI.
 */
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

/** Request log format used by the daemon and administrative web UI servers. */
export type ServerLogFormat = 'json' | 'pretty'

/**
 * Creates the daemon Fastify app without starting a listener.
 *
 * Route contract:
 * - `GET /health` returns `{ ok: true, service: 'doppel-server' }`.
 * - `GET|POST /trpc/*` exposes the application tRPC router.
 * - `GET /ws/terminal/:sessionName` bridges a terminal session over WebSocket.
 * - `GET /session-view` serves a terminal-only browser page for one session.
 * - `GET /session-view/assets/*` serves the xterm assets required by that page.
 * - `GET /` returns a plain text daemon status message, not the admin UI.
 *
 * The terminal WebSocket accepts JSON client messages with either
 * `{ type: 'input', data: string }` or
 * `{ type: 'resize', cols: number, rows: number }`. Server messages are JSON
 * status, output, and exit events.
 */
export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const doppel = options.doppel ?? createDoppel({ dataDir: options.dataDir })
  const app = Fastify({
    logger: createFastifyLoggerOptions(options),
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

  /**
   * Terminal protocol:
   * - First sends the ensured session status and buffered history.
   * - Streams subsequent output and process exit events from the engine.
   * - Accepts input and resize messages from the browser or CLI client.
   */
  app.get('/ws/terminal/:sessionName', { websocket: true }, (socket, request) => {
    const params = request.params as { sessionName?: string }
    const sessionName = params.sessionName ?? 'default'
    const session = doppel.terminal.ensure({ name: sessionName })

    sendJson(socket, {
      type: 'status',
      session,
    })

    const history = doppel.terminal.getHistory(sessionName)
    if (history.length > 0) {
      sendJson(socket, {
        type: 'output',
        data: history,
      })
    }

    const unsubscribe = doppel.terminal.subscribe(
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
        doppel.terminal.send(sessionName, message.data)
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
        doppel.terminal.resize(sessionName, cols, rows)
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
        doppel,
      }),
    },
  })

  /**
   * Terminal-only daemon page. This is deliberately separate from the
   * administrative web UI and only renders a session terminal client.
   */
  app.get('/session-view', async (request, reply) => {
    const query = request.query as { session?: string }
    return reply.type('text/html; charset=utf-8').send(renderSessionViewHtml(query.session))
  })

  /** Package-backed static assets required by the terminal-only session page. */
  for (const [assetPath, asset] of Object.entries(SESSION_VIEW_ASSETS)) {
    app.get(assetPath, async (_, reply) => {
      return reply.type(asset.contentType).send(fs.createReadStream(require.resolve(asset.packagePath)))
    })
  }

  app.get('/', async (_, reply) => {
    return reply.type('text/plain; charset=utf-8').send('doppel daemon is running\n')
  })

  app.addHook('onClose', async () => {
    doppel.close()
  })

  doppel.schedules.start()

  return app
}

/**
 * Creates and starts the daemon Fastify server.
 *
 * This is the network-bound variant of {@link createServer}. It enables request
 * logging by default and resolves bind defaults from `HOST` and `PORT`.
 */
export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const app = await createServer({
    dataDir: options.dataDir,
    logFormat: options.logFormat,
    logger: options.logger ?? true,
    doppel: options.doppel,
  })
  const host = options.host ?? process.env.HOST ?? '0.0.0.0'
  const port = options.port ?? Number(process.env.PORT ?? 3000)

  await app.listen({ host, port })
  return app
}

/**
 * Creates the administrative web UI Fastify app without starting a listener.
 *
 * Route contract:
 * - `GET /doppel-config.js` assigns `window.__DOPPEL_CONFIG__` with the daemon
 *   URL used by the browser client.
 * - `GET /*` serves static assets from `webRoot` when a built UI is available.
 * - `GET /` returns a 500 diagnostic page when no built UI assets can be found.
 */
export async function createWebUiServer(options: CreateWebUiServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createFastifyLoggerOptions(options),
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

/**
 * Creates and starts the administrative web UI server.
 *
 * This is the network-bound variant of {@link createWebUiServer}. It enables
 * request logging by default and resolves bind defaults from `HOST` and
 * `WEB_UI_PORT`.
 */
export async function startWebUiServer(options: StartWebUiServerOptions = {}): Promise<FastifyInstance> {
  const app = await createWebUiServer({
    daemonUrl: options.daemonUrl,
    logFormat: options.logFormat,
    logger: options.logger ?? true,
    webRoot: options.webRoot,
  })
  const host = options.host ?? process.env.HOST ?? '0.0.0.0'
  const port = options.port ?? Number(process.env.WEB_UI_PORT ?? 3001)

  await app.listen({ host, port })
  return app
}

/**
 * Resolves the web UI asset directory for source, workspace, and packaged
 * layouts. Returning `undefined` lets the caller expose a deterministic
 * diagnostic page instead of failing at startup.
 */
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

/**
 * Converts server logging options into Fastify/Pino configuration.
 *
 * Pretty logs are directed to stderr so structured command output can remain on
 * stdout for CLI callers.
 */
function createFastifyLoggerOptions(
  options: Pick<CreateServerOptions, 'logger' | 'logFormat'>,
): FastifyServerOptions['logger'] {
  if (options.logger !== true) {
    return false
  }

  if (options.logFormat === 'json') {
    return {
      base: undefined,
      level: 'info',
    }
  }

  return {
    base: undefined,
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: process.stderr.isTTY,
        destination: 2,
        ignore: 'pid,hostname',
        singleLine: false,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      },
    },
  }
}

/**
 * Renders the standalone terminal page served from the daemon.
 *
 * The session name is serialized with `JSON.stringify` before embedding so the
 * inline module receives data, not executable source.
 */
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
        overflow: hidden;
        box-sizing: border-box;
        padding: 8px;
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
      let terminalCols = 0;
      let terminalRows = 0;

      terminal.loadAddon(fitAddon);
      terminal.open(terminalHost);
      terminal.focus();

      const fit = () => {
        fitAddon.fit();
        if (terminalCols === terminal.cols && terminalRows === terminal.rows) {
          return;
        }
        terminalCols = terminal.cols;
        terminalRows = terminal.rows;
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
      new ResizeObserver(fit).observe(document.body);
      window.setTimeout(fit, 0);
    </script>
  </body>
</html>`
}

/** Sends a JSON WebSocket frame only while the socket is open. */
function sendJson(socket: { readyState: number; send(data: string): void }, value: unknown): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(value))
  }
}

/**
 * Parses the terminal WebSocket client protocol and ignores malformed frames.
 *
 * Returning `null` is intentional: unsupported input should not tear down the
 * terminal stream.
 */
function parseWebSocketMessage(rawMessage: unknown): Record<string, unknown> | null {
  try {
    const message = rawMessageToString(rawMessage)
    const parsed = JSON.parse(message)

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Normalizes the message shapes emitted by the WebSocket implementation into
 * UTF-8 text before JSON parsing.
 */
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
