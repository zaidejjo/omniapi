#!/usr/bin/env bun
import { program } from 'commander'
import { runCommand } from '../src/commands/run'
import { exportCommand } from '../src/commands/export'
import { importCommand } from '../src/commands/import'
import { envCommand } from '../src/commands/env'

program
  .name('om')
  .description('OmniAPI CLI — blazing-fast API client for CI/CD')
  .version('0.1.0')

program
  .command('run')
  .description('Execute a collection or single request (TAP output for CI/CD)')
  .argument('<path>', 'Path to collection JSON file')
  .option('-e, --env <path>', 'Path to environment JSON file')
  .option('-v, --variable <key=value...>', 'Inline variables (repeatable)')
  .option('--timeout <ms>', 'Per-request timeout in milliseconds', '30000')
  .option('--fail-fast', 'Stop execution on first failure')
  .action(runCommand)

program
  .command('export')
  .description('Export collection to JSON')
  .argument('<collection-id>', 'Collection ID')
  .option('-o, --output <path>', 'Output file path')
  .action(exportCommand)

program
  .command('import')
  .description('Import collection from JSON')
  .argument('<path>', 'Path to collection JSON')
  .option('-w, --workspace <id>', 'Target workspace ID')
  .action(importCommand)

program
  .command('env')
  .description('Manage environments')
  .argument('<action>', 'Action: list, set, get, delete')
  .argument('[key]', 'Variable key')
  .argument('[value]', 'Variable value')
  .option('-w, --workspace <id>', 'Workspace ID')
  .option('-n, --name <name>', 'Environment name')
  .action(envCommand)

program.parse()
