// ── nestedItemControl.helpers — pure helpers for the nested-item DRILL editor ───
//
//  Extracted from `NestedItemControl.tsx` (one-body / one-concern hygiene): the
//  dot-path grammar helpers and the pure label/summary/seed functions the drill
//  editor and its screens share. No React, no state — trivially testable, and kept
//  out of the component file so it stays under the size ceiling.
//
import type { PropSchema, PropertyGroup, PropField } from '@statdash/react/engine'
import type { SchemaSource } from '../schemaSource'
import type { Locale } from '../../types/constructor'
import { getAtPath, setAtPath } from '../showWhen'
import { readLocale } from '../localeString'

// ── Path helpers (dot-path grammar; empty path = the root value itself) ───────

/** Read a value at an absolute dot-path from the root; '' addresses the root. */
export function readAt(root: unknown, dotPath: string): unknown {
  return dotPath === '' ? root : getAtPath(root, dotPath)
}
/** Immutable write at an absolute dot-path from the root; '' replaces the root. */
export function writeAt(root: unknown, dotPath: string, value: unknown): unknown {
  return dotPath === '' ? value : setAtPath(root, dotPath, value)
}
/** Append a segment to a dot-path ('' base → the segment alone). */
export function joinPath(base: string, seg: string): string {
  return base === '' ? seg : `${base}.${seg}`
}
/** Namespace a DOM id by dot-path so each drill level's controls never collide. */
export function pathToId(prefix: string, dotPath: string): string {
  return dotPath === '' ? prefix : `${prefix}-${dotPath.replace(/\./g, '-')}`
}

// ── Pure helpers ────────────────────────────────────────────────────────────────

/** A SchemaSource that returns a FIXED schema + groups (the field's itemSchema),
 *  independent of the modeled node — the port the level Inspector reads. */
export function fixedSchemaSource(schema: PropSchema, groups: PropertyGroup[]): SchemaSource {
  return { getSchema: () => schema, getGroups: () => groups }
}

/** Seed a fresh item from its schema's declared defaults (immutable build). */
export function makeDefaultItem(schema: PropSchema): Record<string, unknown> {
  let out: Record<string, unknown> = {}
  for (const f of schema) {
    if (f.default !== undefined) out = setAtPath(out, f.field, f.default)
  }
  return out
}

/** A field's display label, active-locale-resolved (LocaleString | string). */
export function fieldLabel(field: PropField, locale: Locale): string {
  return readLocale(field.label as never, locale) || field.field
}

/** Display title for an item: the `itemLabel` dot-path value (locale-resolved for
 *  a LocaleString), else the 1-based "Item N" fallback. */
export function itemTitle(
  item: unknown, itemLabel: string | undefined, index: number, locale: Locale,
): string {
  const fallback = `Item ${index + 1}`
  if (!itemLabel) return fallback
  const raw = getAtPath(item, itemLabel)
  if (raw == null) return fallback
  if (typeof raw === 'string') return raw || fallback
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  if (typeof raw === 'object') {
    const s = readLocale(raw as never, locale) // LocaleString or similar record
    return s || fallback
  }
  return fallback
}

/** Row summary for a nested ARRAY drill-affordance (count, no fields shown). */
export function summarizeArray(value: unknown): string {
  const n = Array.isArray(value) ? value.length : 0
  return n === 0 ? 'No items' : n === 1 ? '1 item' : `${n} items`
}

/** Row summary for a nested OBJECT drill-affordance (its itemLabel value, if any). */
export function summarizeObject(value: unknown, field: PropField, locale: Locale): string {
  if (field.itemLabel) return itemTitle(value, field.itemLabel, 0, locale)
  return ''
}
