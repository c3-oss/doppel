import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Plus, RefreshCcw, RotateCw, Save, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { TerminalPanel } from '../components/TerminalPanel.js'
import { daemonMutation, daemonQuery } from '../utils/trpc.js'

const DEFAULT_SESSION = 'default'

type SessionSummary = {
  name: string
  status?: string
  command?: string
  cwd?: string
  exitCode?: number | null
}

type ScheduleSummary = {
  id: string
  name: string
  sessionName: string
  command: string
  cron?: string
  enabled: boolean
  lastRunAt?: string
  nextRunAt?: string
}

function getInitialSessionName() {
  const sessionName = new URLSearchParams(window.location.search).get('session')?.trim()

  return sessionName || DEFAULT_SESSION
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  return value as Record<string, unknown>
}

function stringFrom(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function numberOrNullFrom(value: unknown) {
  return typeof value === 'number' ? value : value === null ? null : undefined
}

function arrayFromResponse(value: unknown, key: string) {
  if (Array.isArray(value)) {
    return value
  }

  const record = asRecord(value)
  const collection = record?.[key]

  return Array.isArray(collection) ? collection : []
}

function normalizeSession(value: unknown, fallbackName: string): SessionSummary {
  if (typeof value === 'string') {
    return {
      name: value,
    }
  }

  const record = asRecord(value)

  if (!record) {
    return {
      name: fallbackName,
    }
  }

  return {
    name: stringFrom(record.name) ?? fallbackName,
    status: stringFrom(record.status),
    command: stringFrom(record.command),
    cwd: stringFrom(record.cwd),
    exitCode: numberOrNullFrom(record.exitCode),
  }
}

function normalizeSessions(value: unknown) {
  return arrayFromResponse(value, 'sessions').map((session, index) => normalizeSession(session, `session-${index + 1}`))
}

function normalizeSchedule(value: unknown, fallbackIndex: number): ScheduleSummary {
  const record = asRecord(value)

  if (!record) {
    const fallbackName = `schedule-${fallbackIndex + 1}`

    return {
      id: fallbackName,
      name: fallbackName,
      sessionName: DEFAULT_SESSION,
      command: '',
      enabled: false,
    }
  }

  const id = stringFrom(record.id) ?? stringFrom(record.name) ?? `schedule-${fallbackIndex + 1}`

  return {
    id,
    name: stringFrom(record.name) ?? id,
    sessionName: stringFrom(record.sessionName) ?? stringFrom(record.session) ?? DEFAULT_SESSION,
    command: stringFrom(record.command) ?? '',
    cron: stringFrom(record.cron),
    enabled: Boolean(record.enabled),
    lastRunAt: stringFrom(record.lastRunAt),
    nextRunAt: stringFrom(record.nextRunAt),
  }
}

function normalizeSchedules(value: unknown) {
  return arrayFromResponse(value, 'schedules').map(normalizeSchedule)
}

function formatDate(value?: string) {
  if (!value) {
    return 'Not scheduled'
  }

  const timestamp = new Date(value)

  if (Number.isNaN(timestamp.getTime())) {
    return value
  }

  return timestamp.toLocaleString()
}

export function DaemonPage() {
  const queryClient = useQueryClient()
  const [selectedSession, setSelectedSession] = useState(getInitialSessionName)
  const [sessionDraft, setSessionDraft] = useState(selectedSession)
  const [scheduleName, setScheduleName] = useState('')
  const [scheduleCommand, setScheduleCommand] = useState('')
  const [scheduleCron, setScheduleCron] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(true)

  const sessionsQuery = useQuery({
    queryKey: ['daemon', 'sessions'],
    queryFn: async () => normalizeSessions(await daemonQuery('sessions.list')),
    refetchInterval: 5_000,
  })

  const selectedSessionQuery = useQuery({
    queryKey: ['daemon', 'sessions', selectedSession],
    queryFn: async () =>
      normalizeSession(await daemonQuery('sessions.get', { name: selectedSession }), selectedSession),
    refetchInterval: 3_000,
    retry: 1,
  })

  const schedulesQuery = useQuery({
    queryKey: ['daemon', 'schedules'],
    queryFn: async () => normalizeSchedules(await daemonQuery('schedules.list')),
    refetchInterval: 5_000,
  })

  const ensureSession = useMutation({
    mutationFn: (name: string) => daemonMutation('sessions.ensure', { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daemon', 'sessions'] })
    },
  })

  const killSession = useMutation({
    mutationFn: (name: string) => daemonMutation('sessions.kill', { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daemon', 'sessions'] })
    },
  })

  const createSchedule = useMutation({
    mutationFn: () =>
      daemonMutation('schedules.create', {
        name: scheduleName.trim(),
        sessionName: selectedSession,
        command: scheduleCommand,
        cron: scheduleCron.trim() || undefined,
        enabled: scheduleEnabled,
      }),
    onSuccess: async () => {
      setScheduleName('')
      setScheduleCommand('')
      setScheduleCron('')
      setScheduleEnabled(true)
      await queryClient.invalidateQueries({ queryKey: ['daemon', 'schedules'] })
    },
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => daemonMutation('schedules.delete', { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daemon', 'schedules'] })
    },
  })

  const setScheduleEnabledState = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      daemonMutation('schedules.enable', { id, enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daemon', 'schedules'] })
    },
  })

  const runScheduleNow = useMutation({
    mutationFn: (id: string) => daemonMutation('schedules.runNow', { id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daemon', 'schedules'] })
    },
  })

  const sessionOptions = useMemo(() => {
    const sessionNames = new Set([selectedSession])

    for (const session of sessionsQuery.data ?? []) {
      sessionNames.add(session.name)
    }

    return Array.from(sessionNames).sort((left, right) => left.localeCompare(right))
  }, [selectedSession, sessionsQuery.data])

  const selectedSessionDetails = selectedSessionQuery.data ?? {
    name: selectedSession,
  }

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('session', selectedSession)
    window.history.replaceState(null, '', url)
    setSessionDraft(selectedSession)
    ensureSession.mutate(selectedSession)
  }, [ensureSession.mutate, selectedSession])

  const selectSession = (name: string) => {
    const nextSession = name.trim()

    if (nextSession.length > 0) {
      setSelectedSession(nextSession)
    }
  }

  const daemonError =
    sessionsQuery.error ??
    selectedSessionQuery.error ??
    schedulesQuery.error ??
    ensureSession.error ??
    killSession.error ??
    createSchedule.error ??
    deleteSchedule.error ??
    setScheduleEnabledState.error ??
    runScheduleNow.error

  return (
    <div className="daemon-layout">
      <section className="session-panel" aria-label="Sessions">
        <div className="section-heading">
          <div>
            <h2>Sessions</h2>
            <p>{sessionsQuery.isFetching ? 'Refreshing sessions' : 'Daemon sessions'}</p>
          </div>
          <button
            aria-label="Refresh sessions"
            className="icon-button"
            onClick={() => void sessionsQuery.refetch()}
            type="button"
          >
            <RefreshCcw size={16} />
          </button>
        </div>

        <div className="session-picker">
          <select
            aria-label="Selected session"
            onChange={(event) => selectSession(event.target.value)}
            value={selectedSession}
          >
            {sessionOptions.map((sessionName) => (
              <option key={sessionName} value={sessionName}>
                {sessionName}
              </option>
            ))}
          </select>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault()
              selectSession(sessionDraft)
            }}
          >
            <input
              aria-label="Session name"
              onChange={(event) => setSessionDraft(event.target.value)}
              type="text"
              value={sessionDraft}
            />
            <button className="tool-button icon-only" type="submit" aria-label="Ensure session">
              <Plus size={16} />
            </button>
          </form>
        </div>

        <dl className="detail-list">
          <div>
            <dt>Status</dt>
            <dd>{selectedSessionDetails.status ?? 'unknown'}</dd>
          </div>
          <div>
            <dt>Command</dt>
            <dd>{selectedSessionDetails.command || 'shell'}</dd>
          </div>
          <div>
            <dt>CWD</dt>
            <dd>{selectedSessionDetails.cwd || 'server default'}</dd>
          </div>
        </dl>

        <div className="session-list" aria-label="Session list">
          {(sessionsQuery.data ?? []).map((session) => (
            <button
              className={session.name === selectedSession ? 'list-row selected' : 'list-row'}
              key={session.name}
              onClick={() => selectSession(session.name)}
              type="button"
            >
              <span>
                <strong>{session.name}</strong>
                <small>{session.command || session.cwd || 'shell'}</small>
              </span>
              <span className="muted">{session.status ?? 'unknown'}</span>
            </button>
          ))}
        </div>

        <button
          className="danger-button"
          disabled={killSession.isPending}
          onClick={() => killSession.mutate(selectedSession)}
          type="button"
        >
          <Trash2 size={16} aria-hidden="true" />
          Kill session
        </button>
      </section>

      <TerminalPanel sessionName={selectedSession} />

      <section className="schedules-panel" aria-label="Schedules">
        <div className="section-heading">
          <div>
            <h2>Schedules</h2>
            <p>{schedulesQuery.isFetching ? 'Refreshing schedules' : 'Scheduled commands'}</p>
          </div>
          <button
            aria-label="Refresh schedules"
            className="icon-button"
            onClick={() => void schedulesQuery.refetch()}
            type="button"
          >
            <RotateCw size={16} />
          </button>
        </div>

        <form
          className="schedule-form"
          onSubmit={(event) => {
            event.preventDefault()
            createSchedule.mutate()
          }}
        >
          <label>
            Name
            <input
              onChange={(event) => setScheduleName(event.target.value)}
              required
              type="text"
              value={scheduleName}
            />
          </label>
          <label>
            Command
            <input
              onChange={(event) => setScheduleCommand(event.target.value)}
              required
              type="text"
              value={scheduleCommand}
            />
          </label>
          <label>
            Cron
            <input
              onChange={(event) => setScheduleCron(event.target.value)}
              placeholder="*/15 * * * *"
              required
              type="text"
              value={scheduleCron}
            />
          </label>
          <label className="toggle-label align-start">
            <input
              checked={scheduleEnabled}
              onChange={(event) => setScheduleEnabled(event.target.checked)}
              type="checkbox"
            />
            Enabled
          </label>
          <button className="primary-button" disabled={createSchedule.isPending} type="submit">
            <Save size={16} aria-hidden="true" />
            Save
          </button>
        </form>

        <div className="schedule-list">
          {(schedulesQuery.data ?? []).map((schedule) => (
            <div className="schedule-row" key={schedule.id}>
              <div className="schedule-main">
                <strong>{schedule.name}</strong>
                <code>{schedule.command}</code>
                <small>
                  {schedule.sessionName} · {schedule.cron ?? 'manual'} · next {formatDate(schedule.nextRunAt)}
                </small>
              </div>
              <div className="row-actions">
                <button
                  aria-label={`Run ${schedule.name} now`}
                  className="tool-button icon-only"
                  onClick={() => runScheduleNow.mutate(schedule.id)}
                  type="button"
                >
                  <Play size={16} />
                </button>
                <button
                  aria-label={schedule.enabled ? `Disable ${schedule.name}` : `Enable ${schedule.name}`}
                  className="tool-button icon-only"
                  onClick={() =>
                    setScheduleEnabledState.mutate({
                      id: schedule.id,
                      enabled: !schedule.enabled,
                    })
                  }
                  type="button"
                >
                  {schedule.enabled ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                </button>
                <button
                  aria-label={`Delete ${schedule.name}`}
                  className="tool-button icon-only danger"
                  onClick={() => deleteSchedule.mutate(schedule.id)}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {daemonError ? <pre className="error-box">{daemonError.message}</pre> : null}
    </div>
  )
}
