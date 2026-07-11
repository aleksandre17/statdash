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
import { useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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

// ── Group presentation (D9 hybrid — DERIVED, never hardcoded) ─────────────────
//
//  The node's contextual sections come from the schema's OWN `group`s (Seam-2 is
//  untouched — we only *present* what groupFields already computed). Few groups →
//  a collapsible accordion (all open by default, WCAG disclosure buttons). Many →
//  a tablist, so a group-rich node does not become an unusable long scroll. A slice
//  that declares a new group gets a new section/tab for FREE (OCP — no triad here).
//
const GROUP_TAB_THRESHOLD = 4 // ≥ this many LABELLED groups → tabs; else accordion.
const MORE_LABEL: LocaleString = { ka: 'სხვა', en: 'More' } as Record<string, string>

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
  /**
   * DOM id namespace for this panel's controls (default `'insp'`). Every control,
   * tab, and group body id is prefixed with it so MULTIPLE Inspectors on one page
   * (the nested-item editor renders one per array item — D7.1) never collide on a
   * DOM id, keeping every `label[htmlFor]`/`aria-controls` association unique
   * (WCAG 2.1 AA). The default keeps every existing id byte-identical.
   */
  idPrefix?: string
}

export function Inspector({
  node, onChange, schemaSource = nodeSchemaSource, idPrefix = 'insp',
}: InspectorProps) {
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

  // Presentation state (D9): which accordion sections are collapsed (default: none)
  // and, in tabs mode, the active tab. Kept as view-state — the schema seam is pure.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [activeTab, setActiveTab] = useState(0)

  const labelledCount = fieldGroups.filter((g) => g.label).length
  const useTabs       = labelledCount >= GROUP_TAB_THRESHOLD
  const moreLabel     = resolveLabel(MORE_LABEL, locale, 'More')

  // The root dock Inspector keeps the canonical `data-testid="inspector"`; a NESTED
  // Inspector (the drill-in item editor + a promoted card's `value`/`trend` object
  // sub-editors render one per `idPrefix`) scopes its testid by prefix so multiple
  // Inspectors on one page never collide on `[data-testid="inspector"]` (the latent
  // collision R2-expand flagged once the kpi-card schema is wired). Same rationale
  // as the DOM-id `idPrefix` namespace above (WCAG-unique + query-unique).
  const testId = idPrefix === 'insp' ? 'inspector' : `inspector-${idPrefix}`

  const renderField = useCallback(
    (field: PropField) => {
      if (!isVisible(field.showWhen, node.props)) return null

      const id      = `${idPrefix}-${field.field.replace(/\./g, '-')}`
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
    [node.props, locale, locales, onChange, idPrefix],
  )

  // NB: the "no schema" dead-end panel is GONE by construction (Wave 8,
  // FF-SCHEMA-COMPLETE). Every placeable node/panel is guaranteed a non-empty,
  // interface-complete schema by the runtime completeness gate
  // (schema-completeness.fitness.test.ts) + the compile-time 1:1 asserts beside
  // each schema (schema-contract.ts). An empty `schema` here can therefore only
  // mean an UNREGISTERED type was selected — a wiring bug, not a normal state; we
  // assert it in dev and otherwise fall through to the normal (empty) render
  // rather than printing a friendlier dead message.
  if (import.meta.env.DEV && schema.length === 0) {
    console.assert(
      false,
      `[Inspector] no schema for '${node.type}' — an unregistered type reached the ` +
      `Inspector, or a placeable slipped past FF-SCHEMA-COMPLETE. Register the slice ` +
      `(nodeRegistry) and give it a PropSchema.`,
    )
  }

  // ── Tabs presentation (many groups) — an ARIA tablist over the schema groups ──
  //  All panels stay MOUNTED (inactive ones `hidden`) so field state never resets
  //  on tab-switch and every control is addressable — the tabs are pure chrome over
  //  the same generic renderer.
  if (useTabs) {
    const active = Math.min(activeTab, fieldGroups.length - 1)
    const onTabKey = (e: ReactKeyboardEvent, i: number) => {
      const last = fieldGroups.length - 1
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')      setActiveTab(i === last ? 0 : i + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')    setActiveTab(i === 0 ? last : i - 1)
      else if (e.key === 'Home')                                setActiveTab(0)
      else if (e.key === 'End')                                 setActiveTab(last)
      else return
      e.preventDefault()
    }
    return (
      <div className="insp" data-testid={testId}>
        <div className="insp__tablist" role="tablist" aria-label="Inspector sections">
          {fieldGroups.map((g, i) => (
            <button
              key={g.key}
              role="tab"
              type="button"
              id={`${idPrefix}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${idPrefix}-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              data-active={i === active || undefined}
              className="insp__tab"
              onClick={() => setActiveTab(i)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {g.label || moreLabel}
            </button>
          ))}
        </div>
        {fieldGroups.map((g, i) => (
          <div
            key={g.key}
            role="tabpanel"
            id={`${idPrefix}-panel-${i}`}
            aria-labelledby={`${idPrefix}-tab-${i}`}
            hidden={i !== active}
            className="insp__tabpanel"
          >
            {g.fields.map(renderField)}
          </div>
        ))}
      </div>
    )
  }

  // ── Accordion presentation (few groups) — collapsible fieldsets, open by default.
  //  <fieldset>/<legend> keeps the WCAG form-grouping semantics; the legend hosts a
  //  disclosure <button aria-expanded> controlling the body region. The unlabelled
  //  tail stays a plain group (nothing to collapse).
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="insp" data-testid={testId}>
      {fieldGroups.map((g) => {
        if (!g.label) {
          return (
            <div className="insp__group insp__group--plain" key={g.key} role="group">
              {g.fields.map(renderField)}
            </div>
          )
        }
        const open   = !collapsed.has(g.key)
        const bodyId = `${idPrefix}-body-${g.key.replace(/[^\w-]/g, '-')}`
        return (
          <fieldset className="insp__group" key={g.key} data-open={open || undefined}>
            <legend className="insp__legend">
              <button
                type="button"
                className="insp__toggle"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => toggle(g.key)}
              >
                {g.label}
              </button>
            </legend>
            <div id={bodyId} className="insp__group-body" hidden={!open}>
              {g.fields.map(renderField)}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
