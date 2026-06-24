// @vitest-environment jsdom
//
// ── tenant-override.fitness.test.tsx — FF-TENANT-OVERRIDE (theming works) ──────
//
//  The third cohesion invariant of the semantic-token / theming spine
//  (ADR adr_semantic_token_theming_spine §5.3). Proves the override SEAM is
//  LIVE: a tenant theme rebinds a Tier-2 role purely by scoping
//  `[data-tenant="…"]{ --color-accent: … }` on <html> — with ZERO edits to any
//  shell file. Re-theming is structural, not by convention.
//
//  We load the REAL default tokens.css (the brand-neutral :root theme), add a
//  one-line tenant override, and assert:
//    1. un-themed, --color-accent resolves to the brand-neutral default;
//    2. under [data-tenant="test"], the SAME role flips to the tenant value;
//    3. `cssVar()` (the helper every chart fill routes through) observes the flip.
//  The accent role is referenced by shell CSS only as `var(--color-accent)`, so a
//  flip of the role value re-tints every consumer — no shell edit involved.
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cssVar } from '@statdash/styles'

const TENANT_ACCENT = '#ff00ff'
const tokensCssPath = resolve(__dirname, '../../../styles/src/css/tokens.css')

beforeAll(() => {
  const tokens = readFileSync(tokensCssPath, 'utf8')
  const base = document.createElement('style')
  base.id = 'default-theme'
  base.textContent = tokens
  document.head.appendChild(base)

  // A tenant theme: one scoped rule rebinding a single role. No shell edits.
  const tenant = document.createElement('style')
  tenant.id = 'tenant-theme'
  tenant.textContent = `[data-tenant="test"]{ --color-accent: ${TENANT_ACCENT}; }`
  document.head.appendChild(tenant)
})

afterEach(() => {
  document.documentElement.removeAttribute('data-tenant')
})

function resolvedAccent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
}

describe('FF-TENANT-OVERRIDE — re-theming is structural (zero shell edits)', () => {
  it('the default theme binds --color-accent to a brand-neutral value (not the tenant brand)', () => {
    const dflt = resolvedAccent()
    expect(dflt).not.toBe('')
    expect(dflt.toLowerCase()).not.toBe(TENANT_ACCENT)
  })

  it('a [data-tenant] override flips --color-accent with no shell change', () => {
    const before = resolvedAccent()
    document.documentElement.setAttribute('data-tenant', 'test')
    const after = resolvedAccent()

    expect(after.toLowerCase()).toBe(TENANT_ACCENT)
    expect(after).not.toBe(before)
  })

  it('cssVar() (the chart-fill resolution path) observes the tenant flip', () => {
    document.documentElement.setAttribute('data-tenant', 'test')
    // cssVar reads the computed token — the same value a chart SVG fill receives.
    expect(cssVar('--color-accent', '#000000').toLowerCase()).toBe(TENANT_ACCENT)
  })
})
