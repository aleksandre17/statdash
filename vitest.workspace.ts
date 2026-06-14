import { defineWorkspace } from 'vitest/config'

// Platform test projects — each package owns its own vitest.config.ts.
// This file is the only place that knows which packages exist; it knows
// nothing about their internal structure.
export default defineWorkspace([
  'engine/core',
  'engine/react',
])
