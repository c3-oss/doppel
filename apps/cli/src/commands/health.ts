import { Command } from 'commander'
import { z } from 'zod'

import { formatCliError } from '../errors.js'
import { writeJson } from '../output.js'
import { getDefaultServerUrl } from '../trpc-client.js'

const healthSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
})

export type HealthStatus = z.infer<typeof healthSchema>
export type OfflineHealthStatus = {
  ok: false
  error: string
}

export async function readHealthStatus(
  serverUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthStatus | OfflineHealthStatus> {
  try {
    const url = new URL('/health', serverUrl)
    const response = await fetchImpl(url)

    if (!response.ok) {
      return {
        ok: false,
        error: `Health check failed with HTTP ${response.status}`,
      }
    }

    return healthSchema.parse(await response.json())
  } catch (error) {
    return {
      ok: false,
      error: formatCliError(error),
    }
  }
}

export function healthCommand(): Command {
  return new Command('health')
    .description('Check a running doppel server.')
    .option('-u, --url <url>', 'Server base URL.', getDefaultServerUrl())
    .option('--json', 'Emit JSON output.')
    .action(async (options: { json?: boolean; url: string }) => {
      const status = await readHealthStatus(options.url)

      if (options.json === true) {
        writeJson(process.stdout, status)
        return
      }

      if (status.ok) {
        process.stdout.write(`doppel server is healthy (${status.service})\n`)
        return
      }

      process.stdout.write(`doppel server is offline: ${status.error}\n`)
    })
}
