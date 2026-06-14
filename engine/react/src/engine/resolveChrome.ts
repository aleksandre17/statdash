// ── resolveChrome — 4-layer chrome resolution engine ────────────────────
//
//  Pure function: site chrome config + page overrides → ChromeLayout.
//  No side effects; safe to call in useMemo.
//
//  Resolution priority per slot (highest → lowest):
//    variant  = page[slot].variant ?? site[slot].variant ?? 'default'
//    region   = page[slot].region  ?? site[slot].region  ?? meta.defaultRegion
//    order    = page[slot].order   ?? site[slot].order   ?? meta.defaultOrder
//    config   = page[slot].config  ?? site[slot].config  ?? {}
//
//  Pattern: Grafana variable override chain · Builder.io slot config per page.
//  Constructor Phase 2: page-level overrides read from DB JSONB column.
//
import type { ReactNode }                        from 'react'
import type { ChromeEntry }                      from './types'
import { chromeRegistry, NullChromeSlot }        from './chromeRegistry'

export interface ResolvedChromeEntry {
  /** Slot name — used as React key. */
  slot:   string
  /** Shell component — zero-prop, reads data via hooks. */
  Shell:  () => ReactNode
  /** Per-instance config — read by shells via useSlotConfig(). */
  config: Record<string, unknown>
  /** Sort order within the region — lower = earlier. */
  order:  number
}

/** Region name → sorted list of resolved entries for that region. */
export type ChromeLayout = Map<string, ResolvedChromeEntry[]>

// ── Entry field extractors ─────────────────────────────────────────────

function pickVariant(e: ChromeEntry | undefined): string | undefined {
  if (typeof e === 'string') return e
  return e?.variant
}

function pickRegion(e: ChromeEntry | undefined): string | undefined {
  if (typeof e === 'string' || e == null) return undefined
  return e.region
}

function pickOrder(e: ChromeEntry | undefined): number | undefined {
  if (typeof e === 'string' || e == null) return undefined
  return e.order
}

function pickConfig(e: ChromeEntry | undefined): Record<string, unknown> | undefined {
  if (typeof e === 'string' || e == null) return undefined
  return e.config
}

// ── resolveChrome ──────────────────────────────────────────────────────

export function resolveChrome(
  siteChrome:    Record<string, ChromeEntry>,
  pageOverrides: Record<string, ChromeEntry>,
): ChromeLayout {
  const layout = new Map<string, ResolvedChromeEntry[]>()

  for (const meta of chromeRegistry.listSlotMeta()) {
    const { slot } = meta
    const page = pageOverrides[slot]
    const site = siteChrome[slot]

    const variant = pickVariant(page) ?? pickVariant(site) ?? 'default'
    const rgn     = pickRegion(page)  ?? pickRegion(site)  ?? meta.defaultRegion
    const ord     = pickOrder(page)   ?? pickOrder(site)   ?? meta.defaultOrder
    const cfg     = pickConfig(page)  ?? pickConfig(site)  ?? {}

    const Shell  = chromeRegistry.get(slot, variant) ?? NullChromeSlot
    const bucket = layout.get(rgn) ?? []
    bucket.push({ slot, Shell, config: cfg, order: ord })
    layout.set(rgn, bucket)
  }

  // Sort each region's entries by order ascending
  for (const [rgn, entries] of layout) {
    layout.set(rgn, [...entries].sort((a, b) => a.order - b.order))
  }

  return layout
}