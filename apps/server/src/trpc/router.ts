import { type Doppel, schemas } from '@c3-oss/doppel-core'
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { z } from 'zod'

/**
 * tRPC request context supplied by the Fastify adapter.
 *
 * Server callers provide the Doppel engine for all domain operations. Tests can
 * omit it for procedures, such as `health`, that do not need engine access.
 */
export interface TrpcContext {
  /** Fastify request id associated with the tRPC call, when one is available. */
  requestId?: string
  /** Engine instance backing terminal sessions and schedules. */
  doppel?: Doppel
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
})

const healthPayload = z.object({
  ok: z.literal(true),
  service: z.literal('doppel-server'),
})

/**
 * Creates the public tRPC router for daemon clients.
 *
 * Router contract:
 * - `health` returns the daemon health payload.
 * - `sessions.*` delegates terminal session operations to the Doppel engine.
 * - `schedules.*` delegates schedule CRUD and execution to the Doppel engine.
 *
 * Inputs are validated with schemas shared from `@c3-oss/doppel-core` so HTTP,
 * CLI, and web consumers use the same domain contract.
 */
export function createAppRouter() {
  return t.router({
    health: t.procedure.output(healthPayload).query(() => ({
      ok: true,
      service: 'doppel-server',
    })),
    sessions: t.router({
      list: t.procedure.query(({ ctx }) => requireDoppel(ctx).terminal.list()),
      get: t.procedure.input(schemas.sessionNameInput).query(({ ctx, input }) => {
        return requireDoppel(ctx).terminal.get(input.name)
      }),
      ensure: t.procedure.input(schemas.sessionsEnsureInput).mutation(({ ctx, input }) => {
        return requireDoppel(ctx).terminal.ensure(input)
      }),
      kill: t.procedure.input(schemas.sessionNameInput).mutation(({ ctx, input }) => ({
        killed: requireDoppel(ctx).terminal.kill(input.name),
      })),
      send: t.procedure.input(schemas.sessionsSendInput).mutation(({ ctx, input }) => {
        const terminal = requireDoppel(ctx).terminal
        terminal.ensure({ name: input.name })
        return terminal.send(input.name, `${input.data}${input.enter === true ? '\r' : ''}`)
      }),
      sendKey: t.procedure.input(schemas.terminalKeyInput).mutation(({ ctx, input }) => {
        const terminal = requireDoppel(ctx).terminal
        terminal.ensure({ name: input.name })
        return terminal.sendKey(input.name, input.key)
      }),
    }),
    schedules: t.router({
      list: t.procedure.query(({ ctx }) => requireDoppel(ctx).schedules.list()),
      create: t.procedure.input(schemas.scheduleCreateInput).mutation(({ ctx, input }) => {
        return requireDoppel(ctx).schedules.create(input)
      }),
      update: t.procedure.input(schemas.scheduleUpdateInput).mutation(({ ctx, input }) => {
        const { id, ...update } = input
        return requireDoppel(ctx).schedules.update(id, update)
      }),
      delete: t.procedure.input(schemas.scheduleIdInput).mutation(({ ctx, input }) => ({
        deleted: requireDoppel(ctx).schedules.delete(input.id),
      })),
      enable: t.procedure.input(schemas.scheduleEnableInput).mutation(({ ctx, input }) => {
        return requireDoppel(ctx).schedules.enable(input.id, input.enabled)
      }),
      runNow: t.procedure.input(schemas.scheduleIdInput).mutation(({ ctx, input }) => {
        return requireDoppel(ctx).schedules.runNow(input.id)
      }),
    }),
  })
}

/**
 * Returns the request's Doppel engine or fails fast for procedures that require
 * domain access.
 */
function requireDoppel(ctx: TrpcContext): Doppel {
  if (!ctx.doppel) {
    throw new Error('Doppel engine is not available in the tRPC context.')
  }

  return ctx.doppel
}

/** Public tRPC router type consumed by the web app and CLI clients. */
export type AppRouter = ReturnType<typeof createAppRouter>
