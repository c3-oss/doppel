import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

import type { ServerServices } from '../services.js';
import { terminalKeyMap } from '../terminal/keys.js';

export interface TrpcContext {
  requestId?: string;
  services?: ServerServices;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

const healthPayload = z.object({
  ok: z.literal(true),
  service: z.literal('doppel-server'),
});

const sessionNameInput = z.object({
  name: z.string().trim().min(1).default('default'),
});

const sessionsEnsureInput = z.object({
  name: z.string().trim().min(1).default('default'),
  shell: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
});

const sessionsSendInput = z.object({
  name: z.string().trim().min(1).default('default'),
  data: z.string(),
  enter: z.boolean().optional(),
});

const terminalKeyInput = z.object({
  name: z.string().trim().min(1).default('default'),
  key: z.enum(
    Object.keys(terminalKeyMap) as [
      keyof typeof terminalKeyMap,
      ...Array<keyof typeof terminalKeyMap>,
    ],
  ),
});

const scheduleMode = z.enum(['ephemeral', 'session']);

const scheduleCreateInput = z.object({
  name: z.string().trim().min(1),
  cron: z.string().trim().min(1),
  command: z.string().min(1),
  mode: scheduleMode.optional(),
  sessionName: z.string().trim().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  cwd: z.string().min(1).nullable().optional(),
  shell: z.string().min(1).nullable().optional(),
});

const scheduleUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  cron: z.string().trim().min(1).optional(),
  command: z.string().min(1).optional(),
  mode: scheduleMode.optional(),
  sessionName: z.string().trim().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  cwd: z.string().min(1).nullable().optional(),
  shell: z.string().min(1).nullable().optional(),
});

const scheduleIdInput = z.object({
  id: z.string().min(1),
});

const scheduleEnableInput = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

export function createAppRouter() {
  return t.router({
    health: t.procedure.output(healthPayload).query(() => ({
      ok: true,
      service: 'doppel-server',
    })),
    sessions: t.router({
      list: t.procedure.query(({ ctx }) => requireServices(ctx).terminal.list()),
      get: t.procedure.input(sessionNameInput).query(({ ctx, input }) => {
        return requireServices(ctx).terminal.get(input.name);
      }),
      ensure: t.procedure.input(sessionsEnsureInput).mutation(({ ctx, input }) => {
        return requireServices(ctx).terminal.ensure(input);
      }),
      kill: t.procedure.input(sessionNameInput).mutation(({ ctx, input }) => ({
        killed: requireServices(ctx).terminal.kill(input.name),
      })),
      send: t.procedure.input(sessionsSendInput).mutation(({ ctx, input }) => {
        const terminal = requireServices(ctx).terminal;
        terminal.ensure({ name: input.name });
        return terminal.send(input.name, `${input.data}${input.enter === true ? '\r' : ''}`);
      }),
      sendKey: t.procedure.input(terminalKeyInput).mutation(({ ctx, input }) => {
        const terminal = requireServices(ctx).terminal;
        terminal.ensure({ name: input.name });
        return terminal.sendKey(input.name, input.key);
      }),
    }),
    schedules: t.router({
      list: t.procedure.query(({ ctx }) => requireServices(ctx).schedules.list()),
      create: t.procedure.input(scheduleCreateInput).mutation(({ ctx, input }) => {
        return requireServices(ctx).schedules.create(input);
      }),
      update: t.procedure.input(scheduleUpdateInput).mutation(({ ctx, input }) => {
        const { id, ...update } = input;
        return requireServices(ctx).schedules.update(id, update);
      }),
      delete: t.procedure.input(scheduleIdInput).mutation(({ ctx, input }) => ({
        deleted: requireServices(ctx).schedules.delete(input.id),
      })),
      enable: t.procedure.input(scheduleEnableInput).mutation(({ ctx, input }) => {
        return requireServices(ctx).schedules.enable(input.id, input.enabled);
      }),
      runNow: t.procedure.input(scheduleIdInput).mutation(({ ctx, input }) => {
        return requireServices(ctx).schedules.runNow(input.id);
      }),
    }),
  });
}

function requireServices(ctx: TrpcContext): ServerServices {
  if (!ctx.services) {
    throw new Error('Server services are not available.');
  }

  return ctx.services;
}

export type AppRouter = ReturnType<typeof createAppRouter>;
