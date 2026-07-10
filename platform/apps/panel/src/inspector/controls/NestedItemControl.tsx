// ── NestedItemControl — the generic recursive nested-item editor (D7.1) ─────
//
//  The controls that make the D7.0 `PropField.itemSchema` seam VISIBLE. An
//  array/object field that carries an `itemSchema` (ADR-022) is no longer an
//  opaque raw-JSON blob: it becomes a STRUCTURED editor an author drives
//  item-by-item — reach a KPI-strip item, a hero card, a chart axis…
//
//    ArrayOfControl  — `type:'array'`  + itemSchema → a LIST of items, each with
//                      add / remove / reorder, each item's body authored through
//                      the SAME generic Inspector over `itemSchema`.
//    ObjectControl   — `type:'object'` + itemSchema → the object's fields authored
//                      through the same Inspector over `itemSchema`.
//
//  RECURSION (arbitrary depth): each item body is a nested <Inspector> driven by
//  a fixed schema source (`itemSchema`). The Inspector resolves EACH sub-field
//  through the SAME `fieldControlRegistry`, so a sub-field that itself carries an
//  `itemSchema` descends into another ArrayOf/Object control — for free, and
//  stack-safe (React reconciliation, not manual recursion). A depth cap
//  (`NestingDepthContext`) is a hard backstop against a pathological cyclic
//  itemSchema — beyond it we degrade to the raw-JSON control rather than loop.
//
//  This MIRRORS `ParamDefEditor`: an item is modeled as a `CanvasNode`
//  ({ type, props: item }) and rendered by the one generic Inspector — no bespoke
//  per-item form (OCP / the one-Inspector mandate).
//
//  WRITES are immutable nested writes through `setAtPath` on the dot-path
//  `items.N.field` (D7.0 grammar): only the touched item's branch is cloned,
//  every sibling item stays referentially stable.
//
//  App-agnostic: GENERIC over any PropSchema. No node/plugin/Geostat field names,
//  no domain literals — the editor knows only `PropSchema` + the dot-path grammar.
//
import './NestedItemControl.css'
import {
  createContext, useContext, useEffect, useMemo, useRef,
  type ReactNode,
} from 'react'
import type { PropSchema, PropertyGroup, LocaleString } from '@statdash/react/engine'
import type { FieldControlProps } from '../fieldControl.types'
import type { SchemaSource } from '../schemaSource'
import type { CanvasNode, Locale } from '../../types/constructor'
import { Inspector } from '../Inspector'
import { getAtPath, setAtPath } from '../showWhen'
import { readLocale } from '../localeString'
import { JsonControl } from './primitives'

// ── Recursion depth backstop ────────────────────────────────────────────────
//
//  itemSchema nesting is a finite DATA structure, so normal recursion always
//  terminates. This guard exists ONLY for a malformed/cyclic itemSchema (a meta
//  bug): once nesting passes MAX_NESTING levels we render the raw-JSON control
//  instead of descending further — bounded, never an infinite render loop.
//
const NestingDepthContext = createContext(0)
const MAX_NESTING = 8

// ── Helpers (pure) ──────────────────────────────────────────────────────────

/** A SchemaSource that returns a FIXED schema + groups (the field's itemSchema),
 *  independent of the modeled node — the port the nested Inspector reads. */
function fixedSchemaSource(schema: PropSchema, groups: PropertyGroup[]): SchemaSource {
  return { getSchema: () => schema, getGroups: () => groups }
}

/** Seed a fresh item from its schema's declared defaults (immutable build). */
function makeDefaultItem(schema: PropSchema): Record<string, unknown> {
  let out: Record<string, unknown> = {}
  for (const f of schema) {
    if (f.default !== undefined) out = setAtPath(out, f.field, f.default)
  }
  return out
}

/** Display title for an item: the `itemLabel` dot-path value (locale-resolved for
 *  a LocaleString), else the 1-based "Item N" fallback. */
function itemTitle(
  item: unknown, itemLabel: string | undefined, index: number, locale: Locale,
): string {
  const fallback = `Item ${index + 1}`
  if (!itemLabel) return fallback
  const raw = getAtPath(item, itemLabel)
  if (raw == null) return fallback
  if (typeof raw === 'string') return raw || fallback
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  if (typeof raw === 'object') {
    // LocaleString or similar record → show the active-locale string.
    const s = readLocale(raw as never, locale)
    return s || fallback
  }
  return fallback
}

// ── ArrayOfControl (type:'array' + itemSchema) ──────────────────────────────

export function ArrayOfControl(props: FieldControlProps): ReactNode {
  const { field, id, value, onChange, locale } = props
  const depth = useContext(NestingDepthContext)

  const itemSchema = field.itemSchema ?? []
  const itemGroups = field.itemGroups ?? []
  const items = Array.isArray(value) ? (value as unknown[]) : []

  const source = useMemo(
    () => fixedSchemaSource(itemSchema, itemGroups),
    [itemSchema, itemGroups],
  )

  // Focus target after add/remove — resolved post-commit against the fresh DOM.
  const rootRef  = useRef<HTMLDivElement>(null)
  const focusReq = useRef<{ index: number } | null>(null)
  useEffect(() => {
    const req = focusReq.current
    if (!req || !rootRef.current) return
    focusReq.current = null
    const root = rootRef.current
    const target =
      root.querySelector<HTMLElement>(`[data-item-index="${req.index}"] .insp-nested__remove`) ??
      root.querySelector<HTMLElement>('.insp-nested__add')
    target?.focus()
  })

  // Depth backstop for a malformed/cyclic itemSchema — never loop.
  if (depth >= MAX_NESTING) return <JsonControl {...props} />

  const emit       = (next: unknown[]) => onChange(next)
  const updateItem = (i: number, subfield: string, next: unknown) =>
    emit(setAtPath(items, `${i}.${subfield}`, next))
  const addItem = () => {
    focusReq.current = { index: items.length }             // the new last item
    emit([...items, makeDefaultItem(itemSchema)])
  }
  const removeItem = (i: number) => {
    focusReq.current = { index: Math.min(i, items.length - 2) } // next item, else add-btn
    emit(items.filter((_, idx) => idx !== i))
  }
  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    emit(next)
  }

  const label = readLocale(field.label as never, locale) || field.field

  return (
    <NestingDepthContext.Provider value={depth + 1}>
      <div className="insp-nested" role="group" aria-label={label} ref={rootRef}>
        {items.length === 0 ? (
          <p className="insp-nested__empty">No items yet.</p>
        ) : (
          <ul className="insp-nested__list">
            {items.map((item, i) => {
              const prefix   = `${id}-item-${i}`
              const title    = itemTitle(item, field.itemLabel, i, locale)
              const itemNode: CanvasNode = {
                id:       prefix,
                type:     field.field,
                props:    (item && typeof item === 'object' ? item : {}) as Record<string, unknown>,
                childIds: [],
              }
              return (
                <li key={i} className="insp-nested__item" data-item-index={i}>
                  <div className="insp-nested__head">
                    <span className="insp-nested__title">{title}</span>
                    <div className="insp-nested__actions">
                      <button
                        type="button"
                        className="insp-nested__btn insp-nested__up"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${title} up`}
                      >↑</button>
                      <button
                        type="button"
                        className="insp-nested__btn insp-nested__down"
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                        aria-label={`Move ${title} down`}
                      >↓</button>
                      <button
                        type="button"
                        className="insp-nested__btn insp-nested__remove"
                        onClick={() => removeItem(i)}
                        aria-label={`Remove ${title}`}
                      >✕</button>
                    </div>
                  </div>
                  <div className="insp-nested__body">
                    <Inspector
                      node={itemNode}
                      schemaSource={source}
                      idPrefix={prefix}
                      onChange={(subfield, next) => updateItem(i, subfield, next)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <button
          type="button"
          className="insp-nested__btn insp-nested__add"
          onClick={addItem}
        >+ Add item</button>
      </div>
    </NestingDepthContext.Provider>
  )
}

// ── ObjectControl (type:'object' + itemSchema) ──────────────────────────────

export function ObjectControl(props: FieldControlProps): ReactNode {
  const { field, id, value, onChange, locale } = props
  const depth = useContext(NestingDepthContext)

  const itemSchema = field.itemSchema ?? []
  const itemGroups = field.itemGroups ?? []
  const obj = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {}

  const source = useMemo(
    () => fixedSchemaSource(itemSchema, itemGroups),
    [itemSchema, itemGroups],
  )

  if (depth >= MAX_NESTING) return <JsonControl {...props} />

  const prefix = `${id}-obj`
  const node: CanvasNode = { id: prefix, type: field.field, props: obj, childIds: [] }
  const label = readLocale(field.label as LocaleString as never, locale) || field.field

  return (
    <NestingDepthContext.Provider value={depth + 1}>
      <div className="insp-nested" role="group" aria-label={label}>
        <Inspector
          node={node}
          schemaSource={source}
          idPrefix={prefix}
          onChange={(subfield, next) => onChange(setAtPath(obj, subfield, next))}
        />
      </div>
    </NestingDepthContext.Provider>
  )
}
