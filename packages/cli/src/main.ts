import { Command } from 'commander';

import { healthCommand } from './commands/health.js';
import { scheduleCommand } from './commands/schedule.js';
import { sendCommand, sendKeyCommand } from './commands/send.js';
import { sessionCommand } from './commands/session.js';
import { viewCommand } from './commands/view.js';

const VERSION = '0.1.0';

function stripLeadingDoubleDash(argv: readonly string[]): string[] {
  if (argv.length >= 3 && argv[2] === '--') {
    return [argv[0]!, argv[1]!, ...argv.slice(3)];
  }

  return [...argv];
}

export async function runCli(argv: readonly string[]): Promise<void> {
  const program = new Command()
    .name('doppel')
    .enablePositionalOptions()
    .description('Command line client for the doppel server.')
    .version(VERSION, '-v, --version');

  program.addCommand(healthCommand());
  program.addCommand(sendCommand());
  program.addCommand(sendKeyCommand());
  program.addCommand(sessionCommand());
  program.addCommand(scheduleCommand());
  program.addCommand(viewCommand());

  await program.parseAsync(stripLeadingDoubleDash(argv));
}
