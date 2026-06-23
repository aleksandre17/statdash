// ── primitives — the built-in FieldControls (C1) ────────────────────────────
//
//  One control per primitive PropFieldType. Each is a controlled component:
//  value in, onChange out — the Inspector owns the store write. Semantic,
//  accessible native inputs (WCAG 2.1 AA, Project Law 9), no MUI/react-admin
//  dependency so a control is a pure function of its props (testable in jsdom).
//
//  Rich/opaque types (object, array, DataSpec, ChartDef) fall back to a
//  raw-JSON editor — the Constructor's documented default when no richer editor
//  is registered. A dedicated DataSpecEditor already exists in features/; wiring
//  it as the 'DataSpec' control is a follow-up registration (OCP), not a rewrite.
//
import type { FieldControlProps } from '../fieldControl.types'
import { readLocale } from '../localeString'
import type { PropFieldOption } from '@statdash/react/engine'

export function TextControl({ id, value, field, onChange }: FieldControlProps) {
  return (
    <input
      id={id}
      type="text"
      className="insp-field__input"
      value={(value as string) ?? ''}
      pattern={field.validation?.pattern}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function NumberControl({ id, value, field, onChange }: FieldControlProps) {
  return (
    <input
      id={id}
      type="number"
      className="insp-field__input"
      value={value === undefined || value === null ? '' : (value as number)}
      min={field.validation?.min}
      max={field.validation?.max}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  )
}

export function BooleanControl({ id, value, onChange }: FieldControlProps) {
  return (
    <input
      id={id}
      type="checkbox"
      className="insp-field__checkbox"
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}

export function ColorControl({ id, value, onChange }: FieldControlProps) {
  return (
    <input
      id={id}
      type="color"
      className="insp-field__color"
      value={(value as string) ?? '#000000'}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * Static enum select — options carry LocaleString labels resolved to the active
 * locale. Used for any PropField that declares `options` (the schema-static
 * counterpart of EnumRefField's data-driven options).
 */
export function SelectControl({ id, value, field, locale, onChange }: FieldControlProps) {
  const options = (field.options ?? []) as PropFieldOption[]
  return (
    <select
      id={id}
      className="insp-field__select"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {!field.required && <option value="">—</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {readLocale(o.label as never, locale) || o.value}
        </option>
      ))}
    </select>
  )
}

/** Raw-JSON fallback for rich/opaque types (object, array, DataSpec, ChartDef). */
export function JsonControl({ id, value, onChange }: FieldControlProps) {
  return (
    <textarea
      id={id}
      className="insp-field__json"
      rows={4}
      defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
      onBlur={(e) => {
        const raw = e.target.value.trim()
        if (raw === '') { onChange(undefined); return }
        try { onChange(JSON.parse(raw)) } catch { /* keep last valid value on parse error */ }
      }}
    />
  )
}
