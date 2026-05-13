#!/usr/bin/env node
import { formatCliError } from '../errors.js'
import { runCli } from '../main.js'

runCli(process.argv).catch((error: unknown) => {
  process.stderr.write(`Error: ${formatCliError(error)}\n`)
  process.exit(1)
})
