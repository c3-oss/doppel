import { describe, expect, it } from 'vitest';

import { buildSessionEnsurePayload } from '../commands/session.js';

describe('session command helpers', () => {
  it('builds session ensure payloads', () => {
    expect(
      buildSessionEnsurePayload('codex', {
        cwd: '/tmp/project',
        shell: '/bin/zsh',
        cols: '120',
        rows: '40',
      }),
    ).toEqual({
      name: 'codex',
      cwd: '/tmp/project',
      shell: '/bin/zsh',
      cols: 120,
      rows: 40,
    });
  });

  it('rejects invalid terminal dimensions', () => {
    expect(() =>
      buildSessionEnsurePayload('codex', {
        cols: '0',
      }),
    ).toThrow('cols must be a positive integer.');
  });
});
