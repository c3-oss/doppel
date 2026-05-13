function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item))
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJsonValue(nested)]),
  )
}

export function deterministicJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value ?? null))
}

export function writeJson(stdout: NodeJS.WriteStream, value: unknown): void {
  stdout.write(`${deterministicJson(value)}\n`)
}

const COLUMN_SEPARATOR = '  '
const DEFAULT_TERMINAL_WIDTH = 200
const MIN_COLUMN_WIDTH = 6
const RULE_CHAR = '-'
const TRUNCATION_MARKER = '...'

export interface TableOptions {
  columns: readonly string[]
  maxColumnWidths?: Readonly<Record<string, number>>
  tailColumns?: ReadonlySet<string>
  terminalWidth?: number
}

export function writeTable(stdout: NodeJS.WriteStream, rows: readonly object[], options: TableOptions): void {
  const columns = options.columns
  const terminalWidth = options.terminalWidth ?? stdout.columns ?? DEFAULT_TERMINAL_WIDTH
  const maxColumnWidths = options.maxColumnWidths ?? {}
  const tailColumns = options.tailColumns ?? new Set<string>()
  const cells = rows.map((row) => {
    const record = row as Record<string, unknown>
    return columns.map((column) => formatCell(record[column]))
  })
  const widths = columns.map((column, index) => {
    let max = column.length

    for (const row of cells) {
      const cell = row[index] ?? ''
      if (cell.length > max) {
        max = cell.length
      }
    }

    return max
  })

  for (let index = 0; index < columns.length; index++) {
    const column = columns[index]
    if (column === undefined) {
      continue
    }

    const cap = maxColumnWidths[column]
    if (cap !== undefined && (widths[index] ?? 0) > cap) {
      widths[index] = cap
    }
  }

  const separatorBudget = (columns.length - 1) * COLUMN_SEPARATOR.length
  const floors = columns.map((column) => Math.max(MIN_COLUMN_WIDTH, column.length))

  while (totalWidth(widths) + separatorBudget > terminalWidth) {
    const candidate = pickShrinkCandidate(widths, floors)
    if (candidate === null) {
      break
    }

    widths[candidate] = (widths[candidate] ?? 0) - 1
  }

  const header = columns.map((column, index) => column.padEnd(widths[index] ?? 0)).join(COLUMN_SEPARATOR)
  const rule = columns.map((_, index) => RULE_CHAR.repeat(widths[index] ?? 0)).join(COLUMN_SEPARATOR)
  stdout.write(`${header}\n${rule}\n`)

  for (const row of cells) {
    const line = row
      .map((cell, index) => {
        const width = widths[index] ?? 0
        const column = columns[index] ?? ''
        return fitCell(cell, width, tailColumns.has(column)).padEnd(width)
      })
      .join(COLUMN_SEPARATOR)
    stdout.write(`${line}\n`)
  }
}

function totalWidth(widths: readonly number[]): number {
  return widths.reduce((sum, width) => sum + width, 0)
}

function pickShrinkCandidate(widths: readonly number[], floors: readonly number[]): number | null {
  let index = -1
  let width = -1

  for (let candidate = 0; candidate < widths.length; candidate++) {
    const current = widths[candidate] ?? 0
    const floor = floors[candidate] ?? MIN_COLUMN_WIDTH

    if (current > floor && current > width) {
      index = candidate
      width = current
    }
  }

  return index === -1 ? null : index
}

function fitCell(value: string, width: number, tail: boolean): string {
  if (width <= 0) {
    return ''
  }

  if (value.length <= width) {
    return value
  }

  if (width <= TRUNCATION_MARKER.length) {
    return TRUNCATION_MARKER.slice(0, width)
  }

  if (tail) {
    return `${TRUNCATION_MARKER}${value.slice(value.length - (width - TRUNCATION_MARKER.length))}`
  }

  return `${value.slice(0, width - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`
}

function formatCell(value: unknown): string {
  if (value == null) {
    return ''
  }

  const text =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : deterministicJson(value)

  return text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
}
