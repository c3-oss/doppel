import { describe, expect, it } from 'vitest';

import { buildScheduleCreatePayload } from '../commands/schedule.js';

describe('schedule command helpers', () => {
  it('builds create payloads with optional schedule fields', () => {
    expect(
      buildScheduleCreatePayload({
        name: 'daily-check',
        cron: '0 9 * * *',
        command: 'pnpm test',
        mode: 'session',
        session: 'default',
        disabled: true,
        cwd: '/tmp/project',
        shell: '/bin/zsh',
      }),
    ).toEqual({
      name: 'daily-check',
      cron: '0 9 * * *',
      command: 'pnpm test',
      mode: 'session',
      sessionName: 'default',
      enabled: false,
      cwd: '/tmp/project',
      shell: '/bin/zsh',
    });
  });

  it('requires core create options', () => {
    expect(() =>
      buildScheduleCreatePayload({
        name: 'missing-cron',
        command: 'pnpm test',
      }),
    ).toThrow('Missing required option --cron.');
  });

  it('rejects conflicting enabled flags', () => {
    expect(() =>
      buildScheduleCreatePayload({
        name: 'conflict',
        cron: '* * * * *',
        command: 'true',
        enabled: true,
        disabled: true,
      }),
    ).toThrow('Use only one of --enabled or --disabled.');
  });
});
