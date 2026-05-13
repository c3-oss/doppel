import { Command } from 'commander';
import { z } from 'zod';

const healthSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
});

export type HealthStatus = z.infer<typeof healthSchema>;

export async function readHealthStatus(
  serverUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthStatus> {
  const url = new URL('/health', serverUrl);
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }

  return healthSchema.parse(await response.json());
}

export function healthCommand(): Command {
  return new Command('health')
    .description('Check a running doppel server.')
    .option('-u, --url <url>', 'Server base URL.', 'http://localhost:3000')
    .action(async (options: { url: string }) => {
      const status = await readHealthStatus(options.url);
      process.stdout.write(`${JSON.stringify(status)}\n`);
    });
}
