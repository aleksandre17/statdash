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
import { createElement }                      from 'react'
import type { ReactNode }                     from 'react'
import { ChromeSlotConfigProvider }           from '../context/ChromeSlotConfigContext'
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
          {createElement(Shell)}
        </ChromeSlotConfigProvider>
      ))}
    </div>
  )
}