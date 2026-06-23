// ── PropSchemaForm — schema-driven property form (Pattern D) ───────────────
//
//  THE framework gap this closes:
//    Every slice already declares a typed PropSchema (PropField[]) in its meta,
//    and the platform already exposes it (nodeRegistry.getSchema / describeApp().
//    propertySchemas / propSchemaToJsonSchema). But until now NOTHING rendered a
//    FORM from a PropSchema — the Constructor (apps/panel) hand-writes a form per
//    node type. That is the classic schema-driven-rendering miss: the schema is
//    the Single Source of Truth, yet the UI duplicates it by hand. A new node
//    type gets a palette tile and a slot contract for free, but NOT a form.
//
//  PropSchemaForm is the generic renderer: give it a PropSchema + a value object
//  and it produces the whole property panel. A new node type now gets its form
//  for free — schema-driven, JSON-Forms / RJSF / Retool-property-panel class.
//
//  Law 3 (Clean Architecture): app-agnostic. NO react-admin, NO MUI, NO i18next.
//    • Locale is resolved by a pure prop (`locale`, default 'en') over the
//      LocaleString shape — apps pass their active locale; the engine stays free
//      of any locale model.
//    • Renders semantic, accessible HTML (label[htmlFor] + native inputs) so it
//      satisfies the WCAG 2.1 AA baseline (Project Law 9) with zero deps.
//
//  Controlled component (React-controlled-form standard):
//    value      — current config object (dot-paths read against it)
//    onChange   — (field, nextValue) per edit; the app owns the value store
//    Keeping it controlled means it composes with the Constructor's existing
//    undo/redo history store (apps/panel constructor.history) unchanged.
//
//  Open for extension (OCP), closed for modification:
//    Field rendering dispatches through FIELD_RENDERERS keyed by PropFieldType.
//    A new field type = a new entry, the form body unchanged. Rich types
//    (object/array/DataSpec/ChartDef) fall back to a raw-JSON editor — the same
//    "raw JSON editor fallback" the Constructor docs specify when no richer
//    editor is registered.
//

import './PropSchemaForm.css'
import { useCallback, type ReactNode } from 'react'
import type { PropField, PropSchema, PropFieldType } from '../engine/types'

// ── LocaleString resolution (pure, app-agnostic) ───────────────────────────

type AnyLocaleString = string | Record<string, string> | undefined

/** Resolve a LocaleString to a plain string for the active locale. */
function resolveLabel(ls: AnyLocaleString, locale: string, fallback: string): string {
  if (!ls) return fallback
  if (typeof ls === 'string') return ls
  return ls[locale] ?? ls['en'] ?? Object.values(ls)[0] ?? fallback
}

// ── dot-path get (read field value off the controlled value object) ────────

function getAtPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

// ── showWhen — documented simple equality form only (NO eval) ──────────────
//
//  PropField.showWhen documents "chartType === 'bar'" style conditions. We
//  support exactly that safe, declarative shape ( `field === 'value'` /
//  `field === value` ) by parsing — never eval. Anything we can't parse is
//  treated as "always visible" (Postel's Law: liberal, never throw on author
//  input; richer expression support is a later, sandboxed enhancement).
//
function isVisible(showWhen: string | undefined, value: Record<string, unknown>): boolean {
  if (!showWhen) return true
  const m = /^\s*([\w.]+)\s*===\s*(.+?)\s*$/.exec(showWhen)
  if (!m) return true
  const [, lhs, rhsRaw] = m
  const actual   = getAtPath(value, lhs)
  const rhs      = rhsRaw.replace(/^['"]|['"]$/g, '')
  // Compare as strings so 'bar' === 'bar' and 5 === '5' both behave intuitively.
  return String(actual ?? '') === rhs
}

// ── Field renderer registry (OCP dispatch by PropFieldType) ────────────────

export interface FieldRenderProps {
  field:    PropField
  id:       string
  value:    unknown
  locale:   string
  onChange: (next: unknown) => void
}

type FieldRenderer = (p: FieldRenderProps) => ReactNode

const textInput: FieldRenderer = ({ id, value, field, onChange }) =>
  <input
    id={id}
    type="text"
    className="psf__input"
    value={(value as string) ?? ''}
    pattern={field.validation?.pattern}
    onChange={e => onChange(e.target.value)}
  />

const numberInput: FieldRenderer = ({ id, value, field, onChange }) =>
  <input
    id={id}
    type="number"
    className="psf__input"
    value={value === undefined || value === null ? '' : (value as number)}
    min={field.validation?.min}
    max={field.validation?.max}
    onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
  />

const booleanInput: FieldRenderer = ({ id, value, onChange }) =>
  <input
    id={id}
    type="checkbox"
    className="psf__checkbox"
    checked={Boolean(value)}
    onChange={e => onChange(e.target.checked)}
  />

const colorInput: FieldRenderer = ({ id, value, onChange }) =>
  <input
    id={id}
    type="color"
    className="psf__color"
    value={(value as string) ?? '#000000'}
    onChange={e => onChange(e.target.value)}
  />

/** Rich/opaque types: raw-JSON editor fallback (Constructor's documented default). */
const jsonInput: FieldRenderer = ({ id, value, onChange }) =>
  <textarea
    id={id}
    className="psf__json"
    rows={4}
    defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
    onBlur={e => {
      const raw = e.target.value.trim()
      if (raw === '') { onChange(undefined); return }
      try { onChange(JSON.parse(raw)) } catch { /* keep last valid value on parse error */ }
    }}
  />

/** A select renderer is built per-field because options carry LocaleString labels. */
function selectInput(locale: string): FieldRenderer {
  return ({ id, value, field, onChange }) =>
    <select
      id={id}
      className="psf__select"
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value)}
    >
      {!field.required && <option value="">—</option>}
      {field.options!.map(o =>
        <option key={o.value} value={o.value}>
          {resolveLabel(o.label as AnyLocaleString, locale, o.value)}
        </option>,
      )}
    </select>
}

const FIELD_RENDERERS: Record<PropFieldType, FieldRenderer> = {
  string:       textInput,
  number:       numberInput,
  boolean:      booleanInput,
  color:        colorInput,
  icon:         textInput,       // plain string key; richer icon-picker is an app concern
  LocaleString: textInput,       // edits the active-locale string; multi-locale UI is app-level
  object:       jsonInput,
  array:        jsonInput,
  DataSpec:     jsonInput,
  ChartDef:     jsonInput,
  // enum-ref: options come from a runtime catalog (field.source) the engine can
  // NOT resolve (Law 3 — the panel resolves it against its discovery APIs). At
  // the engine level we degrade to a free-text input for the ref value; a field
  // that also carries static `options` is upgraded to a <select> by renderField.
  // The panel replaces this with a source-resolving control (cube measures, etc).
  'enum-ref':   textInput,
}

// ── PropSchemaForm ─────────────────────────────────────────────────────────

export interface PropSchemaFormProps {
  /** The slice's PropSchema (nodeRegistry.getSchema(type) / describeApp().propertySchemas). */
  schema:   PropSchema
  /** Current config object — dot-path fields are read against it. */
  value:    Record<string, unknown>
  /** Per-edit callback: (dot-path field, next value). The caller owns the store. */
  onChange: (field: string, next: unknown) => void
  /** Active locale for LocaleString labels. Defaults to 'en'. */
  locale?:  string
  /** Optional id prefix to namespace field ids (multiple forms on one page). */
  idPrefix?: string
}

/**
 * Render a complete property form from a PropSchema. A new node type gets its
 * Constructor form for free — no per-type form code. Controlled: the caller
 * holds the value and applies onChange edits.
 *
 * Renders nothing (empty form) for an empty/absent schema — the caller falls
 * back to a raw JSON editor in that case (matching describeRegistry's contract
 * that a null schema means "raw JSON editor").
 */
export function PropSchemaForm({
  schema,
  value,
  onChange,
  locale = 'en',
  idPrefix = 'psf',
}: PropSchemaFormProps): ReactNode {
  const renderField = useCallback((field: PropField): ReactNode => {
    if (!isVisible(field.showWhen, value)) return null

    const id       = `${idPrefix}-${field.field.replace(/\./g, '-')}`
    const renderer = field.options && field.options.length > 0
      ? selectInput(locale)
      : FIELD_RENDERERS[field.type] ?? jsonInput
    const label    = resolveLabel(field.label as AnyLocaleString, locale, field.field)

    return (
      <div className="psf__field" key={field.field}>
        <label className="psf__label" htmlFor={id}>
          {label}{field.required && <span className="psf__required" aria-hidden="true"> *</span>}
        </label>
        {renderer({
          field,
          id,
          value:    getAtPath(value, field.field),
          locale,
          onChange: next => onChange(field.field, next),
        })}
      </div>
    )
  }, [value, onChange, locale, idPrefix])

  return (
    <div className="psf" role="group">
      {schema.map(renderField)}
    </div>
  )
}
