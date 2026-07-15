import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import {
  buildThemeVars,
  applyThemeOverrides,
  THEME_OVERRIDES_STYLE_ID,
} from '@statdash/styles'
import { CanvasView } from './CanvasView'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import type { NodePageConfig } from '@statdash/react/engine'

// ── FF-CHROME-FAITHFUL — the canvas chrome wears the PUBLISHED brand ─────────────
//
//  Canon C2 ("the canvas never lies") extends to chrome BRAND. The site's brand used
//  to be baked into the geostat APP (`[data-tenant="geostat"]` CSS), invisible to the
//  Constructor canvas — so the canvas painted the tool's Strata skin (or a brand-less
//  accent), never the published GeoStat blue. The Law-5 fix makes brand PORTABLE:
//  `SiteDef.themeOverrides` (authoring) === `SiteManifest.themeOverrides` (delivery,
//  projected verbatim by apps/api bootstrap), and BOTH the canvas and the runner apply
//  that ONE map through the ONE `@statdash/styles` transform:
//    - canvas : `buildThemeVars(site.themeOverrides)` as the canvas-root inline style;
//    - runner : `applyThemeOverrides(manifest.themeOverrides)` as a `:root {}` rule.
//  Same map + same transform ⇒ the canvas brand is PROVABLY the runner brand (modulo
//  the authoring anchors the canvas adds on top). This fitness bites: on the pre-fix,
//  themeVars-less canvas the brand custom property is ABSENT (brand-less); after the
//  seam it carries the published accent, byte-equal to the runner's.
//
beforeAll(() => { setupCanvasRegistry() })
afterEach(() => {
  document.getElementById(THEME_OVERRIDES_STYLE_ID)?.remove()
  vi.clearAllMocks()
})

const page = {
  type: 'inner-page',
  id:   'page-gdp',
  path: 'gdp',
  children: [{ type: 'section', id: 'sec-1', title: 'GDP', children: [] }],
} as unknown as NodePageConfig

// The GeoStat brand as PORTABLE config (the provisioning `themeOverrides` seed) — a
// flat tokenKey → CSS value map, NOT baked app CSS. Accent = the published GeoStat blue.
const GEOSTAT_BRAND: Record<string, string> = {
  'color.accent':          '#0080BE',
  'color.accent-hover':    '#006A9E',
  'color.heading-display': '#0d3b66',
}

/** The applied `--color-accent` the runner would resolve from an overrides map. */
function runnerAccent(overrides: Record<string, string>): string {
  const el = applyThemeOverrides(overrides, document)
  const m = el?.textContent?.match(/--color-accent:([^;}]+)/)
  return (m?.[1] ?? '').trim()
}

const canvasRoot = () =>
  document.querySelector('[data-testid="canvas-root"]') as HTMLElement

describe('FF-CHROME-FAITHFUL — canvas brand ≡ runner brand', () => {
  it('the pre-fix canvas (no themeVars) carries NO site brand — the accent is brand-less', () => {
    // RED baseline: without the portable-brand seam the canvas root declares no
    // `--color-accent`, so the chrome falls through to the ambient (tool) accent — the
    // exact infidelity the owner saw as "chrome doesn't look like the published site".
    render(<CanvasView page={page} onSelectNode={vi.fn()} onDropNode={vi.fn()} />)
    expect(canvasRoot().style.getPropertyValue('--color-accent')).toBe('')
  })

  it('the canvas applies the SITE brand on its root (the published accent, not the tool skin)', () => {
    const themeVars = buildThemeVars(GEOSTAT_BRAND)
    render(
      <CanvasView page={page} themeVars={themeVars} onSelectNode={vi.fn()} onDropNode={vi.fn()} />,
    )
    // The canvas root now declares the published brand — the same map the runner gets.
    expect(canvasRoot().style.getPropertyValue('--color-accent')).toBe('#0080BE')
    expect(canvasRoot().style.getPropertyValue('--color-heading-display')).toBe('#0d3b66')
  })

  it('canvas brand === runner brand for the SAME overrides (one map, one transform)', () => {
    // The bootstrap projects site.themeOverrides → manifest.themeOverrides VERBATIM, so
    // the canvas and the runner apply the identical map. Prove both resolve the SAME
    // accent through their respective @statdash/styles applications.
    const canvasVars = buildThemeVars(GEOSTAT_BRAND)
    render(
      <CanvasView page={page} themeVars={canvasVars} onSelectNode={vi.fn()} onDropNode={vi.fn()} />,
    )
    const canvasApplied = canvasRoot().style.getPropertyValue('--color-accent')
    const runnerApplied = runnerAccent(GEOSTAT_BRAND)

    expect(canvasApplied).toBe('#0080BE')     // published brand, not neutral / Strata
    expect(runnerApplied).toBe('#0080BE')
    expect(canvasApplied).toBe(runnerApplied) // canvas never lies — it IS the runner brand
  })

  it('a brand-less site is byte-identical both sides (empty map ⇒ no brand rule)', () => {
    // Postel: an unbranded site applies nothing — the canvas shows the brand-neutral
    // platform default, and the runner injects no `:root` rule at all (removed).
    expect(buildThemeVars({})).toEqual({})
    expect(applyThemeOverrides({}, document)).toBeNull()
    expect(document.getElementById(THEME_OVERRIDES_STYLE_ID)).toBeNull()
  })

  it('the runner rule is dark-SAFE — a single :root selector that loses to [data-theme=dark]', () => {
    // A light-tuned brand must not freeze the dark cascade: the injected rule is a
    // single `:root` (specificity 0,1,0), beaten by `[data-theme="dark"]` (0,2,0).
    const el = applyThemeOverrides(GEOSTAT_BRAND, document)
    expect(el?.textContent?.startsWith(':root{')).toBe(true)
    expect(el?.textContent).not.toMatch(/:root:root|\[data-theme/)
  })
})
