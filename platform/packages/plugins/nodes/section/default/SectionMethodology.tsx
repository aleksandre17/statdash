// ── SectionMethodology — section data-integrity disclosure panel ──────────
//
//  Law 9 data-integrity home. Consolidates (AR-39) the section's provenance in
//  ONE reachable place: preliminary status + note + source + last-updated + a
//  close control. Shown when the info toggle is open AND the section has
//  something to disclose (authored methodology OR a preliminary aggregate).
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
  /** Authored methodology block (may be absent when the panel opens only to explain preliminary status). */
  methodology?:   SectionMethodologyDef
  /**
   * The consolidated preliminary flag for this section (AR-39): the OR-fold of
   * child-panel reports and the author override. Renders a labelled, non-color-only
   * status line at the top of the disclosure so the ONE section indicator is fully
   * explained here (Law 9 reachability).
   */
  preliminary:    boolean
  /** Canonical template resolver bound to the section's RenderContext. */
  resolve:        Resolve
  /** Close the panel (parent owns the open state). */
  onClose:        () => void
  t:              T
}

export function SectionMethodology({
  methodology,
  preliminary,
  resolve,
  onClose,
  t,
}: SectionMethodologyProps) {
  const note        = resolve(methodology?.note)
  const source      = resolve(methodology?.source)
  const lastUpdated = resolve(methodology?.lastUpdated)

  return (
    <div className="section__methodology" role="region" aria-label={t('methodology')}>
      {preliminary && (
        <p className="section__integrity-note">
          <span className="section__integrity-dot" aria-hidden="true" />
          <span className="section__methodology-label">{t('preliminary')}</span>
        </p>
      )}
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
