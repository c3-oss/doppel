import { z } from 'zod'

import { terminalKeyMap } from './terminal/keys.js'

export const sessionNameInput = z.object({
  name: z.string().trim().min(1).default('default'),
})

export const sessionsEnsureInput = z.object({
  name: z.string().trim().min(1).default('default'),
  shell: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
})

export const sessionsSendInput = z.object({
  name: z.string().trim().min(1).default('default'),
  data: z.string(),
  enter: z.boolean().optional(),
})

export const terminalKeyInput = z.object({
  name: z.string().trim().min(1).default('default'),
  key: z.enum(Object.keys(terminalKeyMap) as [keyof typeof terminalKeyMap, ...Array<keyof typeof terminalKeyMap>]),
})

export const scheduleMode = z.enum(['ephemeral', 'session'])

export const scheduleCreateInput = z.object({
  name: z.string().trim().min(1),
  cron: z.string().trim().min(1),
  command: z.string().min(1),
  mode: scheduleMode.optional(),
  sessionName: z.string().trim().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  cwd: z.string().min(1).nullable().optional(),
  shell: z.string().min(1).nullable().optional(),
})

export const scheduleUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  cron: z.string().trim().min(1).optional(),
  command: z.string().min(1).optional(),
  mode: scheduleMode.optional(),
  sessionName: z.string().trim().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  cwd: z.string().min(1).nullable().optional(),
  shell: z.string().min(1).nullable().optional(),
})

export const scheduleIdInput = z.object({
  id: z.string().min(1),
})

export const scheduleEnableInput = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
})
