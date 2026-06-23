// ── LocaleField — multi-locale authoring control (C1) ───────────────────────
//
//  Renders one input per ACTIVE locale and emits a COMPLETE LocaleString record
//  (every active locale present). This is the control for:
//    - PropFieldType 'LocaleString'
//    - any PropField with coverage:'localized' (the engine-agent addition)
//
//  Why a complete record (not just the edited locale)?
//    V13/V14 gold enforces LocaleString completeness — a localized field must
//    carry every active locale. Authoring the full record here makes the
//    illegal "partial localization" state unrepresentable at the source.
//
//  Accessibility (WCAG 2.1 AA, Project Law 9):
//    Each locale input is a labelled <input> (label[htmlFor]); the locale code
//    is exposed as a visible badge AND in the accessible name, so the per-locale
//    distinction is not conveyed by position/colour alone.
//
import type { FieldControlProps } from '../fieldControl.types'
import { readLocale, writeLocale, type LocaleStringValue } from '../localeString'
import './LocaleField.css'

export function LocaleField({ field, id, value, locales, onChange }: FieldControlProps) {
  const ls = value as LocaleStringValue

  return (
    <div className="insp-locale" role="group" aria-label={`${field.field} (localized)`}>
      {locales.map((loc, i) => {
        const inputId = i === 0 ? id : `${id}-${loc}`
        return (
          <div className="insp-locale__row" key={loc}>
            <label className="insp-locale__lang" htmlFor={inputId}>
              <span className="insp-locale__badge" aria-hidden="true">{loc}</span>
              <span className="insp-locale__sr">{loc} value</span>
            </label>
            <input
              id={inputId}
              type="text"
              className="insp-locale__input"
              value={readLocale(ls, loc)}
              onChange={(e) => onChange(writeLocale(ls, loc, e.target.value, locales))}
            />
          </div>
        )
      })}
    </div>
  )
}
