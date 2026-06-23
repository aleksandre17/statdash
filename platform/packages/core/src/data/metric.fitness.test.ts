import { readFileSync } from 'fs'
import { resolve }      from 'path'
import { describe, it, expect } from 'vitest'

/**
 * Purity invariant for metric.ts [N26].
 *
 * metric.ts must remain a pure vocabulary leaf — no registry/, no
 * interpretSpec, no defaultRegistry imports. Violating this creates a
 * circular dependency (registry/ → data/spec.ts → metric.ts → registry/).
 *
 * If this test fails, move the offending logic to registry/resolvers.ts
 * (following the MetricResolver pattern) rather than importing registry
 * modules into metric.ts.
 */
describe('metric.ts — purity invariant', () => {
  const src = readFileSync(resolve(__dirname, 'metric.ts'), 'utf8')

  // Strip single-line comments so the design-invariant comment block
  // ("must NOT import defaultRegistry …") does not self-trip the assertions.
  const code = src.split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n')

  it('must not import from registry/', () => {
    expect(code).not.toMatch(/from ['"].*\/registry/)
  })

  it('must not reference interpretSpec', () => {
    expect(code).not.toMatch(/interpretSpec/)
  })

  it('must not reference defaultRegistry', () => {
    expect(code).not.toMatch(/defaultRegistry/)
  })
})
