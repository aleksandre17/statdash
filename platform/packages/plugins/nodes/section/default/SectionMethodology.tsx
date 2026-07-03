// ── SectionMethodology — section methodology disclosure panel ─────────────
//
//  Law 9 methodology home: the section's authored provenance in ONE reachable
//  place — note + source + last-updated + a close control. Shown when the info
//  toggle is open AND the section authored a methodology block. (Data-integrity
//  status is a PAGE-level summary now, AR-40 — not surfaced per section here.)
//
//  Every value flips with the URL locale (AR-37 P1): note/source/lastUpdated are
//  `LocaleString`s resolved through the canonical template resolver (collapses
//  locale THEN expands `{vars}`), so no field renders one frozen language.
//

import type { LocaleString } from '@statdash/engine'
import type { SectionMethodology as SectionMethodologyDef } from './SectionNode'

type T = (key: string) => string
/** The section's template resolver (useNodeTemplate) — accepts a LocaleString carrier. */
type Resolve = (tpl?: LocaleString) => string | undefined

/** One label/value meta row (source, last-updated). */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="section__methodology-meta">
      <span className="section__methodology-label">{label}:</span>
      {' '}{value}
    </p>
  )
}

export interface SectionMethodologyProps {
  /** Authored methodology block. */
  methodology?:   SectionMethodologyDef
  /** Canonical template resolver bound to the section's RenderContext. */
  resolve:        Resolve
  /** Close the panel (parent owns the open state). */
  onClose:        () => void
  t:              T
}

export function SectionMethodology({
  methodology,
  resolve,
  onClose,
  t,
}: SectionMethodologyProps) {
  const note        = resolve(methodology?.note)
  const source      = resolve(methodology?.source)
  const lastUpdated = resolve(methodology?.lastUpdated)

  return (
    <div className="section__methodology" role="region" aria-label={t('methodology')}>
      {note        && <p className="section__methodology-note">{note}</p>}
      {source      && <MetaRow label={t('source')}       value={source} />}
      {lastUpdated && <MetaRow label={t('last-updated')} value={lastUpdated} />}
      <button
        className="section__methodology-close"
        type="button"
        aria-label={t('close')}
        onClick={onClose}
      >
        {t('close')}
      </button>
    </div>
  )
}
