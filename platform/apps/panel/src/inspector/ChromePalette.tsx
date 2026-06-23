// ── ChromePalette — registered chrome slots, selectable for authoring (Phase C)
//
//  Capability discovery (the "Constructor sees only what's registered" rule):
//  lists every chrome slot the chromeRegistry knows, with its variants. Picking
//  a slot+variant selects it (store.selectChrome) → the ChromeInspectorPanel
//  then renders its schema through the generic Inspector.
//
//  No hardcoded slot list — slots/variants come from the registry, so a newly
//  registered chrome element is authorable with zero code change here (OCP).
//
import { useMemo } from 'react'
import { chromeRegistry } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/react/engine'
import { useChromeSelection, useSite, useConstructorStore } from '../store/constructor.store'
import type { Locale } from '../types/constructor'

function resolveLabel(ls: LocaleString | undefined, locale: Locale, fallback: string): string {
  if (!ls) return fallback
  if (typeof ls === 'string') return ls
  const rec = ls as Record<string, string>
  return rec[locale] ?? rec['en'] ?? Object.values(rec)[0] ?? fallback
}

export function ChromePalette() {
  const selection    = useChromeSelection()
  const site         = useSite()
  const selectChrome = useConstructorStore((s) => s.selectChrome)
  const locale       = site.defaultLocale

  // (slot, key) pairs that carry a schema — only those are authorable.
  const entries = useMemo(
    () =>
      chromeRegistry
        .list()
        .flatMap((slot) =>
          chromeRegistry.listVariants(slot).map((key) => ({
            slot,
            key,
            meta: chromeRegistry.getMeta(slot, key),
          })),
        )
        .filter((e) => (e.meta?.schema?.length ?? 0) > 0),
    [],
  )

  if (entries.length === 0) return null

  return (
    <ul className="chrome-palette" data-testid="chrome-palette" role="list">
      {entries.map(({ slot, key, meta }) => {
        const active = selection?.slot === slot && selection?.key === key
        return (
          <li key={`${slot}::${key}`}>
            <button
              type="button"
              className={`chrome-palette__item${active ? ' chrome-palette__item--active' : ''}`}
              aria-pressed={active}
              onClick={() => selectChrome({ kind: 'chrome', slot, key })}
            >
              {resolveLabel(meta?.label as LocaleString | undefined, locale, slot)}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
