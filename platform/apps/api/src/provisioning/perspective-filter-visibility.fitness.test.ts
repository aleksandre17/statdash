// ── FF-FILTER-ITEM-PERSPECTIVE-VISIBILITY (P5.1) ───────────────────────────────
//
//  The law of P5.1: a filter ITEM may carry `visibleWhen` — the SAME VisibilityExpr
//  grammar / `evalVisibility` evaluator / `perspective-is` canon a NODE's
//  `view.visibleWhen` uses (a thin optional cross-cutting field on the shared
//  ParamMeta, DISTINCT from `showWhen`). The filter-bar shell SKIPS rendering the
//  control when the expr is false against the active `perspectiveState`. So after the
//  two time-mode bars collapse to ONE (P5), each perspective shows only its OWN time
//  selector(s): the year-selector in `year`, the from/to window pair in `range`.
//
//  TWO halves, BOTH non-vacuous, asserted over the LIVE migrated artifact:
//
//   (1) PER-PERSPECTIVE CONTROL VISIBILITY — for each filter-item gate, the same
//       evalVisibility the shell calls is TRUE in the gate's own perspective and FALSE
//       in the other; the year-gated vs range-gated key sets are disjoint (a genuine
//       flip, not a tautology).
//
//   (2) RENDER-ONLY — `visibleWhen` gates ONLY which control DISPLAYS, NEVER default
//       resolution. The default-resolution gate (useFilterState) keys on the P4.5
//       perspective-OWNERSHIP seam (`isAlwaysResolve || ownsActive || (!ownsAny &&
//       barShowWhen)`), which NEVER reads `visibleWhen`. We prove this STRUCTURALLY:
//       the set of params the ownership gate RESOLVES is byte-identical whether or not
//       the filter items carry `visibleWhen` (strip it → identical resolve-set), while
//       the VISIBILITY verdict flips. A hidden-but-owned param (range's window keys,
//       which are visible+owned) still resolves; a non-active-owned param (the year pin
//       in range) stays suppressed by OWNERSHIP, not by its visibleWhen. ⇒ The chart
//       render is byte-identical; only controls hide/show.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  parsePerspectiveAxes,
  perspectiveOwnedParamKeys,
  evalVisibility,
} from '@statdash/engine'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

const PAGES = ['accounts', 'gdp', 'regional'] as const
const PERSPECTIVES = ['year', 'range'] as const

type ParamDef = Record<string, unknown> & { type: string }
type FilterSchema = {
  bars: Record<string, { filters: Record<string, ParamDef>; showWhen?: Record<string, unknown> }>
}
type Perspectives = Record<string, { perspectives: Array<Record<string, unknown>> }> | undefined
interface PageCfg { filterSchema?: FilterSchema; modeOrder?: string[]; perspectives?: Perspectives }
interface Artifact { pages: Array<{ slug: string; config: PageCfg }> }

function loadArtifact(): Artifact {
  return JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Artifact
}

function pageConfig(art: Artifact, slug: string): PageCfg {
  const p = art.pages.find((x) => x.slug === slug)
  if (!p) throw new Error(`page ${slug} not found in artifact`)
  return p.config
}

/** The filter-item perspective-is gates on a schema, per param key. */
function itemGates(schema: FilterSchema): Array<{ key: string; perspective: string }> {
  const out: Array<{ key: string; perspective: string }> = []
  for (const bar of Object.values(schema.bars)) {
    for (const [key, def] of Object.entries(bar.filters)) {
      const vw = def.visibleWhen as Record<string, unknown> | undefined
      if (vw && vw.op === 'perspective-is') out.push({ key, perspective: vw.perspective as string })
    }
  }
  return out
}

/** Deep-clone a schema with every filter-item `visibleWhen` removed. */
function stripItemVisibleWhen(schema: FilterSchema): FilterSchema {
  const clone = JSON.parse(JSON.stringify(schema)) as FilterSchema
  for (const bar of Object.values(clone.bars)) {
    for (const def of Object.values(bar.filters)) delete def.visibleWhen
  }
  return clone
}

const isAlwaysResolve = (def: ParamDef): boolean =>
  def.type === 'hidden' && def.alwaysResolve === true

/**
 * The set of param keys the DEFAULT-RESOLUTION gate resolves for one active
 * perspective — replicating useFilterState's gate predicate EXACTLY. PERSPECTIVE
 * OWNERSHIP is the SOLE SSOT (P6): alwaysResolve OR active-owned OR owned-by-none.
 * NEVER reads `visibleWhen` — that is the whole point: the resolve-set is a function
 * of (ownership, alwaysResolve) only, never of render-only item visibility.
 */
function resolvedKeys(schema: FilterSchema, perspectives: Perspectives, activeMode: string): string[] {
  const axes = parsePerspectiveAxes({ perspectives: perspectives as never })
  const ownership = perspectiveOwnedParamKeys(axes, { mode: activeMode })
  const ownsActive = ownership.active
  const ownsAny    = ownership.all

  const keys: string[] = []
  for (const bar of Object.values(schema.bars)) {
    for (const [key, def] of Object.entries(bar.filters)) {
      const resolves =
        isAlwaysResolve(def) ||
        ownsActive.has(key) ||
        !ownsAny.has(key)
      if (resolves) keys.push(key)
    }
  }
  return keys.sort()
}

describe('FF-FILTER-ITEM-PERSPECTIVE-VISIBILITY (P5.1) — perspective-scoped filter-item visibility', () => {
  // ── (1) per-perspective control visibility ──────────────────────────────────

  it('the live artifact gates year→year, from/to→range on all 3 pages (9 gates, disjoint sets)', () => {
    const art = loadArtifact()
    const all = PAGES.flatMap((slug) => itemGates(pageConfig(art, slug).filterSchema!))
    expect(all.length).toBe(9)   // (year + fromYear + toYear) × 3 pages
    const yearGated  = [...new Set(all.filter((g) => g.perspective === 'year').map((g) => g.key))].sort()
    const rangeGated = [...new Set(all.filter((g) => g.perspective === 'range').map((g) => g.key))].sort()
    expect(yearGated).toEqual(['year'])
    expect(rangeGated).toEqual(['fromYear', 'toYear'])
  })

  it('each filter-item gate is shown in its own perspective, hidden in the other (the shell verdict)', () => {
    const art = loadArtifact()
    for (const slug of PAGES) {
      for (const g of itemGates(pageConfig(art, slug).filterSchema!)) {
        const expr = { op: 'perspective-is', perspective: g.perspective } as never
        // filterParams ({}) is irrelevant — perspective-is reads only perspectiveState.
        expect(evalVisibility(expr, {}, { mode: g.perspective })).toBe(true)   // own ⇒ shown
        const other = g.perspective === 'year' ? 'range' : 'year'
        expect(evalVisibility(expr, {}, { mode: other })).toBe(false)          // other ⇒ hidden
      }
    }
  })

  // ── (2) render-only: visibleWhen never feeds default resolution ──────────────

  it('RENDER-ONLY — stripping every filter-item visibleWhen leaves the resolved-key set byte-identical', () => {
    const art = loadArtifact()
    for (const slug of PAGES) {
      const cfg = pageConfig(art, slug)
      const gated    = cfg.filterSchema!
      const stripped = stripItemVisibleWhen(gated)
      // Non-vacuous: the gated config HAS 3 item gates, the stripped one has NONE.
      expect(itemGates(gated).length).toBe(3)
      expect(itemGates(stripped).length).toBe(0)

      for (const perspective of PERSPECTIVES) {
        const withGate    = resolvedKeys(gated,    cfg.perspectives, perspective)
        const withoutGate = resolvedKeys(stripped, cfg.perspectives, perspective)
        // The resolve-set is IDENTICAL with and without visibleWhen ⇒ render-only.
        expect(withoutGate).toEqual(withGate)
      }
    }
  })

  it('RENDER-ONLY corollary — a hidden-but-owned param still resolves; a non-active-owned one stays suppressed', () => {
    const art = loadArtifact()
    for (const slug of PAGES) {
      const cfg = pageConfig(art, slug)
      const range = resolvedKeys(cfg.filterSchema!, cfg.perspectives, 'range')
      // fromYear/toYear: visible (visibleWhen:range) AND range-owned ⇒ RESOLVE.
      expect(range).toContain('fromYear')
      expect(range).toContain('toYear')
      // year: HIDDEN in range (visibleWhen:year) yet its suppression is by OWNERSHIP
      // (year-owned/inactive), proven because it does NOT resolve in range…
      expect(range).not.toContain('year')

      const year = resolvedKeys(cfg.filterSchema!, cfg.perspectives, 'year')
      // …and DOES resolve in year (the year-owned pin) — render-only gate never blocked it.
      expect(year).toContain('year')
      // from/to hidden in year AND range-owned/inactive ⇒ suppressed by ownership.
      expect(year).not.toContain('fromYear')
      expect(year).not.toContain('toYear')
    }
  })
})
