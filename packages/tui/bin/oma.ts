#!/usr/bin/env bun
import { main } from '../src/app'

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
