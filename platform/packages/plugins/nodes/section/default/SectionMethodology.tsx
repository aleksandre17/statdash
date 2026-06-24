// ── SectionMethodology — methodology disclosure panel ─────────────────
//
//  Data-integrity panel (Law 9): note + source + last-updated, with a close
//  control. Shown only when authored AND the info toggle is open (the caller
//  gates rendering). The note supports template vars; source/lastUpdated are
//  literal display strings.
//

import type { SectionMethodology as SectionMethodologyDef } from './SectionNode'

type T = (key: string) => string

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
  methodology:    SectionMethodologyDef
  /** Canonical template resolver bound to the section's RenderContext. */
  resolve:        (tpl?: string) => string | undefined
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
  return (
    <div className="section__methodology" role="region" aria-label={t('methodology')}>
      {methodology.note && (
        <p className="section__methodology-note">
          {resolve(methodology.note)}
        </p>
      )}
      {methodology.source      && <MetaRow label={t('source')}       value={methodology.source} />}
      {methodology.lastUpdated && <MetaRow label={t('last-updated')} value={methodology.lastUpdated} />}
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
