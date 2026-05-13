import { z } from 'zod'

import { terminalKeyMap } from './terminal/keys.js'

/** Input schema for operations that address a terminal session by name. */
export const sessionNameInput = z.object({
  name: z.string().trim().min(1).default('default'),
})

/** Input schema for creating or returning an existing terminal session. */
export const sessionsEnsureInput = z.object({
  name: z.string().trim().min(1).default('default'),
  shell: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
})

/** Input schema for writing raw data to a terminal session. */
export const sessionsSendInput = z.object({
  name: z.string().trim().min(1).default('default'),
  data: z.string(),
  enter: z.boolean().optional(),
})

/** Input schema for sending one mapped key sequence to a terminal session. */
export const terminalKeyInput = z.object({
  name: z.string().trim().min(1).default('default'),
  key: z.enum(Object.keys(terminalKeyMap) as [keyof typeof terminalKeyMap, ...Array<keyof typeof terminalKeyMap>]),
})

/** Schedule execution mode schema. */
export const scheduleMode = z.enum(['ephemeral', 'session'])

/** Input schema for creating a persisted command schedule. */
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

/** Input schema for updating a persisted command schedule. */
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

/** Input schema for operations that address a schedule by id. */
export const scheduleIdInput = z.object({
  id: z.string().min(1),
})

/** Input schema for enabling or disabling a schedule by id. */
export const scheduleEnableInput = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
})
