// @vitest-environment node
//
// ── defaults-guard.fitness.test.ts — defaults-vs-save-guard contract ──────────
//
//  The Constructor saveGuard (apps/panel/src/save/saveGuard.ts, check 4
//  "locale-complete") REJECTS a page whose any coverage:'localized' / LocaleString
//  field is PRESENT but does not carry a non-empty value for every active locale.
//  An OPTIONAL localized field that is entirely ABSENT is fine (the author chose
//  not to use it); a REQUIRED localized field must be complete.
//
//  That guard is CORRECT and must not be weakened. The failure mode it exposed is
//  in the DEFAULTS: a freshly-dropped element whose getDefaults(type) seeds an
//  OPTIONAL localized field as an empty-but-present record (`{ka:'',en:''}`) can
//  never be saved until the author fills OR clears it. The contract this fitness
//  LOCKS:
//
//    getDefaults(type) must always produce a SAVE-GUARD-VALID element —
//      • OPTIONAL localized field → ABSENT in defaults (guard skips it), OR
//      • REQUIRED localized field → COMPLETE LocaleString in defaults (non-empty
//        for every active locale).
//    Never an empty-but-present localized default.
//
//  The guard lives in apps/panel (above the dependency arrow — engine/plugins
//  cannot import it). So this fitness REPLICATES the guard's locale-completeness
//  predicate minimally here (the same `missingLocales` logic) and asserts the
//  structural invariant directly against each meta's `schema` + `defaults`.
//
//  Lives in engine/plugins — the only layer permitted to import plugin META
//  (arrow: engine/core ← engine/react ← engine/plugins). META imports resolve to
//  pure `meta.ts` files (no Shell/React/apexcharts transitive deps).
//

import { describe, it, expect } from 'vitest'
import type { PropField, PropSchema } from '@statdash/react/engine/slice-meta'

// ── Node metas ────────────────────────────────────────────────────────────────
import { META as section }       from '../section/default/meta'
import { META as modeBar }       from '../mode-bar/default/meta'
import { META as perspectiveBar } from '../perspective-bar/default/meta'
import { META as filterBar }     from '../filter-bar/default/meta'
import { META as pageHeader }    from '../page-header/default/meta'
import { META as geograph }     from '../geograph/default/meta'
import { META as links }         from '../links/default/meta'
import { META as repeat }        from '../repeat/default/meta'
import { META as hero }          from '../hero/default/meta'
import { META as statsCarousel } from '../stats-carousel/default/meta'

// ── Layout node metas ───────────────────────────────────────────────────────
import { META as row }     from '../layout/row/default/meta'
import { META as grid }    from '../layout/grid/default/meta'
import { META as columns } from '../layout/columns/default/meta'
import { META as stack }   from '../layout/stack/default/meta'
import { META as card }    from '../layout/card/default/meta'
import { META as divider } from '../layout/divider/default/meta'
import { META as spacer }  from '../layout/spacer/default/meta'
import { META as wrap }    from '../layout/wrap/default/meta'

// ── Panel metas ───────────────────────────────────────────────────────────────
import { META as chart }    from '../../panels/chart/default/meta'
import { META as kpiStrip } from '../../panels/kpi-strip/default/meta'
import { META as table }    from '../../panels/table/default/meta'
import { META as map }      from '../../panels/map/default/meta'
import { META as gauge }    from '../../panels/gauge/default/meta'
import { META as text }     from '../../panels/text/default/meta'

// ── Chrome metas (the only chrome slices carrying a localized schema) ──────────
import { META as appFooter }   from '../../chrome/app-footer/default/meta'
import { META as innerSidebar } from '../../chrome/inner-sidebar/default/meta'

// A meta with the two surfaces this contract reconciles: its prop schema and the
// initial values a freshly-dropped instance is seeded with. Chrome metas use the
// same `schema`/`defaults` shape as node/panel metas (ChromeSliceMeta), so the
// same predicate applies — they are folded into the same corpus by `.label`-less
// structural access (no `.type` indexing, which chrome metas lack).
interface MetaWithDefaults {
  schema?:   PropSchema
  defaults?: Record<string, unknown>
}

/** Stable id for failure messages (node/panel use `.type`, chrome uses `.slot`). */
function metaId(m: object): string {
  const r = m as { type?: string; slot?: string; key?: string }
  return r.type ?? `${r.slot}:${r.key}`
}

const ALL_METAS: ReadonlyArray<MetaWithDefaults & object> = [
  section, modeBar, perspectiveBar, filterBar, pageHeader, geograph, links, repeat, hero,
  statsCarousel,
  row, grid, columns, stack, card, divider, spacer, wrap,
  chart, kpiStrip, table, map, gauge, text,
  appFooter, innerSidebar,
]

// The active-locale set defaults are authored against. ka+en is the platform's
// bilingual baseline (the same pair every meta's `label`/`i18n` carries). The
// contract must hold for every active locale, so we check the full set.
const ACTIVE_LOCALES = ['ka', 'en'] as const

// ── Replicated guard predicate (mirror of saveGuard.ts check 4) ───────────────

/** A field requiring a complete LocaleString — coverage:'localized' or LocaleString. */
function isLocalized(field: PropField): boolean {
  return (field as { coverage?: string }).coverage === 'localized'
    || field.type === 'LocaleString'
}

/**
 * Active locales NOT covered by a localized value (empty/missing string counts as
 * missing). Mirror of saveGuard.missingLocales for the Record form, which is what
 * defaults seed. A defaults author should never use the plain-string form.
 */
function missingLocales(value: unknown, locales: readonly string[]): string[] {
  if (value == null || typeof value !== 'object') return [...locales]
  const rec = value as Record<string, unknown>
  return locales.filter((l) => {
    const v = rec[l]
    return typeof v !== 'string' || v.trim() === ''
  })
}

/** Read a dot-path value out of a defaults bag (matches saveGuard.getAt). */
function getAt(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/**
 * The save-guard verdict for ONE element's defaults (the same logic the real
 * guard runs over a page node's props). Returns the offending field message, or
 * null if the defaults would pass the locale-completeness check.
 */
function guardVerdict(meta: MetaWithDefaults): string | null {
  const schema = meta.schema ?? []
  for (const field of schema) {
    if (!isLocalized(field)) continue
    const value = getAt(meta.defaults, field.field)
    // Optional + absent → the guard skips it. This is the correct shape for an
    // optional localized default.
    if (value == null && !field.required) continue
    const missing = missingLocales(value, ACTIVE_LOCALES)
    if (missing.length > 0) {
      return field.required
        ? `required localized field '${field.field}' default is incomplete (missing: ${missing.join(', ')})`
        : `optional localized field '${field.field}' default is empty-but-present (missing: ${missing.join(', ')}) — it must be ABSENT`
    }
  }
  return null
}

// ── Fitness — every meta's defaults pass the save-guard locale-completeness check

describe('defaults-vs-save-guard contract (locale completeness)', () => {

  it('every node/panel/chrome default is save-guard-valid (no empty-present localized default)', () => {
    const offenders = ALL_METAS
      .map(m => ({ id: metaId(m), reason: guardVerdict(m) }))
      .filter(o => o.reason != null)
      .map(o => `${o.id}: ${o.reason}`)

    expect(offenders).toEqual([])
  })

  it('the flagged hero default is now guard-valid (title complete, subtitle absent)', () => {
    // Regression guard for the exact reported interaction: subtitle was an empty
    // record `{ka:'',en:''}`, title was empty-present.
    const m = hero as MetaWithDefaults
    expect(guardVerdict(m)).toBeNull()
    expect(getAt(m.defaults, 'subtitle')).toBeUndefined()      // optional → absent
    expect(missingLocales(getAt(m.defaults, 'title'), ACTIVE_LOCALES)).toEqual([])  // required → complete
  })

  // ── Probe — the fitness MUST fire on a reintroduced empty-present default ────
  it('PROBE: the predicate rejects an empty-present optional localized default', () => {
    const badOptional: MetaWithDefaults = {
      schema:   [{ field: 'subtitle', type: 'LocaleString', label: 'x' }],
      defaults: { subtitle: { ka: '', en: '' } },
    }
    expect(guardVerdict(badOptional)).toMatch(/empty-but-present/)
  })

  it('PROBE: the predicate rejects an incomplete required localized default', () => {
    const badRequired: MetaWithDefaults = {
      schema:   [{ field: 'title', type: 'LocaleString', label: 'x', required: true }],
      defaults: { title: { ka: 'სათაური' } },   // missing 'en'
    }
    expect(guardVerdict(badRequired)).toMatch(/incomplete/)
  })

  it('PROBE: an absent optional localized default passes (the correct shape)', () => {
    const goodOptional: MetaWithDefaults = {
      schema:   [{ field: 'subtitle', type: 'LocaleString', label: 'x' }],
      defaults: {},
    }
    expect(guardVerdict(goodOptional)).toBeNull()
  })

})
