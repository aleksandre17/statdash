// ── Inspector — schema-driven property panel (C1) ───────────────────────────
//
//  THE missing consumer of the existing PropSchema seam (the ADR's central
//  finding): the schema is the Single Source of Truth, yet until now the panel
//  hand-wrote a per-type form. The Inspector renders the WHOLE property panel
//  GENERICALLY from `nodeRegistry.getSchema(type)` — no per-type UI. Every
//  registered type with a schema is inspectable; a newly-registered type gets
//  its form for free (schema-driven rendering: JSON-Forms / RJSF / Retool class).
//
//  Dispatch is fully open (OCP):
//    type   → nodeRegistry.getSchema(type)           (open node registry)
//    field  → fieldControlRegistry.resolve(field)     (open control registry)
//  A new node type = a new schema (no panel change). A new field type = a new
//  control registration (no Inspector change).
//
//  Editing writes through to the selected node's `props` in the unified store
//  (C2) → CanvasView re-renders via the real NodePageRenderer (WYSIWYG).
//
//  Accessibility (WCAG 2.1 AA, Project Law 9): grouped <fieldset>/<legend>
//  sections, every control labelled (label[htmlFor]), required marked in the
//  accessible name, validation errors associated via aria-describedby.
//
import { useCallback, useMemo } from 'react'
import type { PropField, PropSchema, PropertyGroup, LocaleString } from '@statdash/react/engine'
import { fieldControlRegistry } from './FieldControlRegistry'
import { isVisible, getAtPath } from './showWhen'
import { validateField } from './validateField'
import { useActiveLocales } from './useActiveLocales'
import { useSite } from '../store/constructor.store'
import { nodeSchemaSource, type SchemaSource } from './schemaSource'
import type { CanvasNode, Locale } from '../types/constructor'
import './Inspector.css'

// ── Label resolution (active-locale, pure) ──────────────────────────────────

function resolveLabel(ls: LocaleString | undefined, locale: Locale, fallback: string): string {
  if (!ls) return fallback
  if (typeof ls === 'string') return ls
  const rec = ls as Record<string, string>
  return rec[locale] ?? rec['en'] ?? Object.values(rec)[0] ?? fallback
}

// ── Field grouping (PropField.group → PropertyGroup; ungrouped = a tail set) ─

interface FieldGroup {
  key:    string
  label:  string
  fields: PropField[]
}

function groupFields(
  schema: PropSchema,
  groups: PropertyGroup[],
  locale: Locale,
): FieldGroup[] {
  const byField = new Map<string, PropField>(schema.map((f) => [f.field, f]))
  const placed  = new Set<string>()
  const out: FieldGroup[] = []

  // Declared groups first, in declaration order, fields in the group's order.
  for (const g of groups) {
    const label  = resolveLabel(g.label as LocaleString, locale, '')
    const fields = g.fields.map((fp) => byField.get(fp)).filter((f): f is PropField => f != null)
    fields.forEach((f) => placed.add(f.field))
    if (fields.length) out.push({ key: label || `group-${out.length}`, label, fields })
  }

  // Any field not claimed by a group → an unlabelled tail section.
  const rest = schema.filter((f) => !placed.has(f.field))
  if (rest.length) out.push({ key: '__ungrouped', label: '', fields: rest })

  return out
}

// ── Inspector ───────────────────────────────────────────────────────────────

export interface InspectorProps {
  /** The selected element, modeled as a CanvasNode (node/panel/chrome/control). */
  node: CanvasNode
  /** Write a single prop value (dot-path field) on the node. Inspector owns no store. */
  onChange: (field: string, next: unknown) => void
  /**
   * Where this element's schema comes from (Dependency Inversion). Defaults to
   * the node registry so node/panel selection is unchanged; chrome selection
   * passes `chromeSchemaSource` — the SAME Inspector renders both. A new slice
   * kind = a new source, this component unchanged (OCP).
   */
  schemaSource?: SchemaSource
}

export function Inspector({ node, onChange, schemaSource = nodeSchemaSource }: InspectorProps) {
  const site    = useSite()
  const locales = useActiveLocales()
  const locale  = site.defaultLocale

  const schema = useMemo(
    () => schemaSource.getSchema(node),
    [schemaSource, node],
  )
  const groups = useMemo(
    () => schemaSource.getGroups(node),
    [schemaSource, node],
  )

  const fieldGroups = useMemo(
    () => groupFields(schema, groups, locale),
    [schema, groups, locale],
  )

  const renderField = useCallback(
    (field: PropField) => {
      if (!isVisible(field.showWhen, node.props)) return null

      const id      = `insp-${field.field.replace(/\./g, '-')}`
      const Control = fieldControlRegistry.resolve(field)
      const label   = resolveLabel(field.label as LocaleString, locale, field.field)
      const value   = getAtPath(node.props, field.field)
      const error   = validateField(field, value)
      const errId   = error ? `${id}-err` : undefined

      return (
        <div className="insp-field" key={field.field}>
          <label className="insp-field__label" htmlFor={id}>
            {label}
            {field.required && <span className="insp-field__required" aria-hidden="true"> *</span>}
            {field.required && <span className="insp-field__sr"> (required)</span>}
          </label>
          <div className="insp-field__control" aria-describedby={errId}>
            <Control
              field={field}
              id={id}
              value={value}
              locales={locales}
              locale={locale}
              siblingValues={node.props}
              onChange={(next) => onChange(field.field, next)}
            />
          </div>
          {error && (
            <p id={errId} className="insp-field__error" role="alert">{error}</p>
          )}
        </div>
      )
    },
    [node.props, locale, locales, onChange],
  )

  if (schema.length === 0) {
    // No schema → the type is still inspectable, just with no typed fields yet.
    // (describeRegistry's contract: a null schema means "raw JSON editor"; here
    // we surface the open invitation rather than a dead panel.)
    return (
      <div className="insp" data-testid="inspector">
        <p className="insp__empty">
          No property schema for <code>{node.type}</code> yet.
        </p>
      </div>
    )
  }

  return (
    <div className="insp" data-testid="inspector">
      {fieldGroups.map((g) =>
        g.label ? (
          <fieldset className="insp__group" key={g.key}>
            <legend className="insp__legend">{g.label}</legend>
            {g.fields.map(renderField)}
          </fieldset>
        ) : (
          <div className="insp__group insp__group--plain" key={g.key} role="group">
            {g.fields.map(renderField)}
          </div>
        ),
      )}
    </div>
  )
}
