import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from '../http/server.js';
import { createAppRouter } from '../trpc/router.js';

const servers: Awaited<ReturnType<typeof createServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('doppel server', () => {
  it('responds to HTTP health checks', async () => {
    const server = await createServer();
    servers.push(server);

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'doppel-server',
    });
  });

  it('exposes tRPC health status', async () => {
    const caller = createAppRouter().createCaller({});

    await expect(caller.health()).resolves.toEqual({
      ok: true,
      service: 'doppel-server',
    });
  });
});
