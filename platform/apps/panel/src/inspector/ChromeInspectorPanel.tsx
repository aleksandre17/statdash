// ── ChromeInspectorPanel — chrome authoring via the GENERIC Inspector (Phase C)
//
//  When a CHROME element is selected, its per-element config is authored through
//  the SAME generic Inspector that renders node/panel schemas — there is NO
//  chrome-specific property UI. The only chrome-specific glue is:
//
//    1. WHERE the schema comes from — `chromeSchemaSource`, backed by
//       `chromeRegistry.getMeta(slot,key).schema` (the per-element seam).
//    2. WHAT the edits write to — the slot's per-element config under
//       `site.chrome[slot].config` (store.updateChromeConfig).
//
//  The chrome selection is adapted into a CanvasNode (type=slot, variant=key,
//  props=current per-slot config) so the Inspector path is byte-for-byte the
//  node path. This is the "one Inspector, all slice kinds" requirement made
//  concrete: the chrome consumer is ~adapter + source, not a forked panel.
//
import { useCallback, useMemo } from 'react'
import { chromeRegistry } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/react/engine'
import { Inspector } from './Inspector'
import { chromeSchemaSource } from './schemaSource'
import { useChromeSelection, useSite, useConstructorStore } from '../store/constructor.store'
import type { CanvasNode, Locale } from '../types/constructor'

// ── Slot label resolution (active-locale, pure) ──────────────────────────────
function resolveLabel(ls: LocaleString | undefined, locale: Locale, fallback: string): string {
  if (!ls) return fallback
  if (typeof ls === 'string') return ls
  const rec = ls as Record<string, string>
  return rec[locale] ?? rec['en'] ?? Object.values(rec)[0] ?? fallback
}

export function ChromeInspectorPanel() {
  const selection          = useChromeSelection()
  const site               = useSite()
  const updateChromeConfig = useConstructorStore((s) => s.updateChromeConfig)
  const locale             = site.defaultLocale

  // Adapt the chrome selection into the CanvasNode shape the Inspector consumes:
  // type=slot, variant=key, props=the slot's current authored per-element config.
  const node: CanvasNode | null = useMemo(() => {
    if (!selection) return null
    const props = { ...(site.chrome[selection.slot]?.config ?? {}) }
    return { id: `chrome:${selection.slot}`, type: selection.slot, variant: selection.key, props, childIds: [] }
  }, [selection, site.chrome])

  // Edits write through to the slot's per-element config (store-owned).
  const onChange = useCallback(
    (field: string, value: unknown) => {
      if (!selection) return
      updateChromeConfig(selection.slot, field, value)
    },
    [selection, updateChromeConfig],
  )

  if (!selection || !node) return null

  const meta  = chromeRegistry.getMeta(selection.slot, selection.key)
  const title = resolveLabel(meta?.label as LocaleString | undefined, locale, selection.slot)

  return (
    <div className="insp-chrome" data-testid="chrome-inspector">
      <p className="insp-chrome__title">{title}</p>
      {/* The SAME generic Inspector — only the schema source differs. */}
      <Inspector node={node} onChange={onChange} schemaSource={chromeSchemaSource} />
    </div>
  )
}
