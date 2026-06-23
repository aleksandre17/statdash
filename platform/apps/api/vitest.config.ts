import { defineConfig } from 'vitest/config'

// apps/api — Fastify service. Tests run in Node (no DOM). The service owns its
// boundary DTOs (no cross-package engine source), so no resolve alias is required.
//
// scripts/**/*.test.ts is included for the build-time ETL tooling's fitness tests
// (e.g. seed-data.fitness.test.ts — ADR-0028 PROVE gate). Those tests reuse the
// seed mappers + verify-parity projection, which import geostat bundle DATA via the
// ACL; the bundles' `import type` from '@statdash/engine' erases at runtime under
// esbuild, so collecting them here introduces no runtime coupling against the
// dependency arrow (the same stance seed.ts/verify-parity.ts hold). Runtime src/
// code still must NOT import scripts/ — that boundary is unchanged.
export default defineConfig({
  test: {
    name:        'api',
    globals:     true,
    environment: 'node',
    include:     ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
