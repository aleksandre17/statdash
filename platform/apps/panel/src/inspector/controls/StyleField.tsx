// ── StyleField — the token-constrained STYLE control (PropFieldType 'style') ─────
//
//  The first FACET control: it edits a whole-element `NodeStyles` object (`view.styles`)
//  as grouped, token-picked properties — NOT a raw-JSON blob (FF-NO-RAW-JSON-DEFAULT).
//  Registered in FieldControlRegistry under `type:'style'`, so the generic Inspector
//  dispatches the STYLE facet's `contract` field to it (genericity in the DISPATCH).
//
//  Per property: a design-token PICKER (constrain-by-default, options from
//  TOKENS_CATALOG via `tokenOptions`, scoped to the property's `TokenGroup`) PLUS a raw
//  escape input (Tailwind `[13px]` discipline — governed, not the default path). Both
//  write the SAME property through the pure `setStyleProp` reducer; the Inspector owns
//  the store write (undo/redo composes). `applyNodeStyles` already renders the result,
//  so the canvas restyles live.
//
//  Controlled component: value in (the current NodeStyles), onChange out (the next whole
//  object). WCAG 2.1 AA: each group is a <fieldset>/<legend>; each control is labelled.
//
import { readLocale } from '../localeString'
import { tokenOptions } from '../../discovery/tokenCatalogOptions'
import type { FieldControlProps } from '../fieldControl.types'
import type { NodeStyles } from '@statdash/styles'
import {
  STYLE_PROPERTY_GROUPS, setStyleProp, flatStyleValue,
  type StyleProperty,
} from './styleFieldModel'
import './StyleField.css'

// Neutral, localized placeholder for the raw-escape input — never the literal
// `var(--…) / 12px` CSS syntax (P1: the token picker is the affordance).
const RAW_VALUE_HINT = { ka: 'მორგებული მნიშვნელობა', en: 'Custom value' }

export function StyleField({ id, value, locale, onChange }: FieldControlProps) {
  const styles = value as NodeStyles | undefined

  const write = (key: string, next: string | undefined) =>
    onChange(setStyleProp(styles, key, next))

  return (
    <div className="insp-style" data-testid="style-field">
      {STYLE_PROPERTY_GROUPS.map((group, gi) => {
        const groupLabel = readLocale(group.label, locale)
        return (
          <fieldset className="insp-style__group" key={groupLabel || gi}>
            <legend className="insp-style__legend">{groupLabel}</legend>
            {group.props.map((prop) => (
              <StyleRow
                key={prop.key}
                prop={prop}
                idBase={`${id}-${prop.key}`}
                current={flatStyleValue(styles, prop.key)}
                locale={locale}
                onWrite={(next) => write(prop.key, next)}
              />
            ))}
          </fieldset>
        )
      })}
    </div>
  )
}

// ── StyleRow — one property: token picker (default) + raw escape (by intent) ──────
function StyleRow({
  prop, idBase, current, locale, onWrite,
}: {
  prop:    StyleProperty
  idBase:  string
  current: string
  locale:  FieldControlProps['locale']
  onWrite: (next: string | undefined) => void
}) {
  const label   = readLocale(prop.label, locale)
  const options = tokenOptions(prop.tokenGroup, locale)
  // The token select reflects the current value only when it IS one of the offered
  // tokens; a raw value leaves the select on '—' and shows in the escape input.
  const selectValue = options.some((o) => o.value === current) ? current : ''

  return (
    <div className="insp-style__row">
      <label className="insp-style__label" htmlFor={`${idBase}-token`}>{label}</label>
      <div className="insp-style__controls">
        <select
          id={`${idBase}-token`}
          className="insp-field__select insp-style__token"
          value={selectValue}
          onChange={(e) => onWrite(e.target.value || undefined)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          aria-label={`${label} (raw value)`}
          className="insp-field__input insp-style__raw"
          // The token SELECT above is the affordance; this is the governed escape
          // hatch. Never teach raw `var(--…)` syntax to the author (P1) — a neutral,
          // localized hint instead.
          placeholder={readLocale(RAW_VALUE_HINT, locale)}
          value={current}
          onChange={(e) => onWrite(e.target.value.trim() || undefined)}
        />
      </div>
    </div>
  )
}
