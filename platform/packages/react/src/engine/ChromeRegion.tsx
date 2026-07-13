// ── ChromeRegion — renders all chrome entries for a layout region ───────
//
//  Wraps each shell in ChromeSlotConfigProvider so shells can read their
//  per-instance config via useSlotConfig() — zero prop drilling.
//
//  display:contents on .chrome-region (non-overlay): shells are direct
//  flex/grid items of the parent .app-shell — no layout-breaking wrappers.
//
//  Pattern: Builder.io region · Grafana row — ordered list of panels in zone.
//
//  S6 authoring anchor: like `ChromeSlot` (the nested-slot dispatcher), each region
//  entry is wrapped in the ONE generic `<PartAnchor field={slot} index={0}>` — the
//  `data-part-*` family the CanvasOverlay frames. This is what makes the APP-SHELL
//  chrome (header · banner · footer · left · right) CANVAS-SELECTABLE, the same way the
//  page-embedded InnerSidebar already is: chrome is a `sourced` Part of the site-frame,
//  and BOTH dispatch paths (ChromeSlot + ChromeRegion) must stamp the identical anchor so
//  every rendered region is authorable through the ONE `PartAddress`. `PartAnchor` is
//  INERT off the authoring canvas (a zero-DOM Fragment) — byte-identical runtime output.
//
import { createElement }                      from 'react'
import type { ReactNode }                     from 'react'
import { ChromeSlotConfigProvider }           from '../context/ChromeSlotConfigContext'
import { PartAnchor }                          from './partAnchor'
import type { ResolvedChromeEntry }           from './resolveChrome'

export function ChromeRegion({
  region,
  entries,
}: {
  region:  string
  entries: ResolvedChromeEntry[]
}): ReactNode {
  if (entries.length === 0) return null
  return (
    <div className={`chrome-region chrome-region--${region}`}>
      {entries.map(({ slot, Shell, config }) => (
        <ChromeSlotConfigProvider key={slot} config={config}>
          <PartAnchor field={slot} index={0}>
            {createElement(Shell)}
          </PartAnchor>
        </ChromeSlotConfigProvider>
      ))}
    </div>
  )
}