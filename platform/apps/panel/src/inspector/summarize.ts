// ── summarize — the glance projection of a rich/opaque value (SPEC §3.1) ────────
//
//  The Summary Corollary of the Placement Law: `dock ⟵ summarize(subject)`. Every
//  rich/heavy subject the dock cannot fit as scalars is shown as a CONSTANT-SIZE,
//  *populated* card — never a raw-JSON dump, never a void. This module is the
//  read-model that powers that card: `summarize(field, value) → {primary, secondary,
//  badges}`, a legible glance of what the value IS.
//
//  ── OCP, one registration per rich type (Law 1 / Law 8) ────────────────────────
//  Summarizers are keyed by the PropField's declared type in an open registry —
//  a new rich type = one `register()` call, the card component unchanged. A GENERIC
//  field-count / value fallback covers every type with no bespoke summarizer, so NO
//  value can ever regress to raw JSON: `summarize()` is total, always human-legible.
//
//  Pure + framework-free: no React, no store, no DOM. The card renders the result.
//
import type { PropField } from '@statdash/react/engine'
import type { Locale } from '../types/constructor'
import { readLocale, type LocaleStringValue } from './localeString'

/** The glance projection of ONE rich value — what the SummaryCard renders. */
export interface SubjectSummary {
  /** The headline glance line — the subject in one legible phrase (never JSON). */
  primary: string
  /** An optional sub-line — the shape/grain detail beneath the headline. */
  secondary?: string
  /** Small chips — type, unit, integrity/preliminary flags (Law 9 at a glance). */
  badges?: string[]
}

/** Derive a glance summary from a value + its field descriptor (pure, total). */
export type Summarizer = (value: unknown, field: PropField, locale: Locale) => SubjectSummary

// ── helpers ─────────────────────────────────────────────────────────────────────
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v)

const fieldLabel = (field: PropField, locale: Locale): string =>
  readLocale(field.label as unknown as LocaleStringValue, locale) || field.field

const truncate = (s: string, n = 48): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** A short, human count phrase — "3 items" / "1 property" (no locale plural rules). */
const countPhrase = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

// ── the GENERIC fallback — never returns JSON, covers every un-registered type ───
//
//  Array → a count of its items (labelled by the field). Object → a count of its
//  own keys, with a preview of the first few. Scalar-ish → the stringified value,
//  truncated. This is the floor that makes `summarize()` total: a rich type with no
//  bespoke summarizer still lands as a legible glance, never a raw-JSON textarea.
//
export function genericSummary(value: unknown, field: PropField, locale: Locale): SubjectSummary {
  const label = fieldLabel(field, locale)

  if (Array.isArray(value)) {
    return { primary: label, secondary: countPhrase(value.length, 'item', 'items'), badges: ['array'] }
  }
  if (isRecord(value)) {
    // Craft: the glance shows the SHAPE (a field count), never a raw-key dump
    // (`by · op · prefix · source` — the screenshot-04 disease). The keys belong in the
    // themed StructuredValueView tree reached via "Open", not inline as opaque text.
    const keys = Object.keys(value)
    return {
      primary:   label,
      secondary: keys.length ? countPhrase(keys.length, 'field', 'fields') : 'empty',
      badges:    ['object'],
    }
  }
  if (value == null) return { primary: label, secondary: 'not set' }
  return { primary: label, secondary: truncate(String(value)) }
}

// ── the open registry ─────────────────────────────────────────────────────────
class SummarizeRegistryImpl {
  private map = new Map<string, Summarizer>()

  /** Register (or override) the summarizer for a PropFieldType. Chainable. */
  register(key: string, summarizer: Summarizer): this {
    this.map.set(key, summarizer)
    return this
  }

  /** True if a bespoke summarizer is registered for the type. */
  has(key: string): boolean {
    return this.map.has(key)
  }

  /**
   * Summarize a field's value — the bespoke summarizer for its type, else the
   * generic fallback. TOTAL: always returns a legible glance, never raw JSON.
   */
  summarize(field: PropField, value: unknown, locale: Locale): SubjectSummary {
    const s = this.map.get(field.type)
    try {
      return s ? s(value, field, locale) : genericSummary(value, field, locale)
    } catch {
      // A malformed value must never blank the dock or leak a stack — fall to generic.
      return genericSummary(value, field, locale)
    }
  }
}

export type SummarizeRegistry = SummarizeRegistryImpl

// ── built-in summarizers for the platform's rich types ──────────────────────────

/** DataSpec → "GDP (current) · query · by year" (measure, spec kind, grain). */
function summarizeDataSpec(value: unknown, field: PropField, locale: Locale): SubjectSummary {
  if (!isRecord(value)) return genericSummary(value, field, locale)
  const kind = typeof value.type === 'string' ? value.type : 'spec'
  const query = isRecord(value.query) ? value.query : undefined

  // The bound measure/metric — the noun the spec resolves. Defensive across branches.
  const metrics = value.metrics
  const measure =
    (query?.measure as string | undefined) ??
    (value.measure as string | undefined) ??
    (value.metric as string | undefined) ??
    (Array.isArray(metrics) ? metrics.join(', ') : undefined)

  // The grain — `by` dims, or the query's dimension keys.
  const by = value.by
  const dims = isRecord(query?.dims) ? Object.keys(query!.dims as Record<string, unknown>) : []
  const grain = Array.isArray(by) ? by.join(', ') : typeof by === 'string' ? by : dims.join(', ')

  return {
    primary:   measure ? truncate(String(measure)) : `${kind} spec`,
    secondary: grain ? `${kind} · by ${grain}` : kind,
    badges:    [kind],
  }
}

/** ChartDef → "bar chart · GDP" (mark, label, key view flags). */
function summarizeChartDef(value: unknown, field: PropField, locale: Locale): SubjectSummary {
  if (!isRecord(value)) return genericSummary(value, field, locale)
  const type = typeof value.type === 'string' ? value.type : 'chart'
  const label = typeof value.label === 'string' ? value.label : ''
  const flags = [
    value.stacked ? 'stacked' : '',
    value.distributed ? 'by category' : '',
    typeof value.height === 'number' ? `${value.height}px` : '',
  ].filter(Boolean)
  return {
    primary:   label ? truncate(label) : `${type} chart`,
    secondary: [`${type} chart`, ...flags].join(' · '),
    badges:    [type],
  }
}

/**
 * The platform default registry, pre-populated with summarizers for the known rich
 * types. Apps register richer summaries by calling `.register()` — OCP, no edit here.
 */
export const summarizeRegistry: SummarizeRegistry = new SummarizeRegistryImpl()
  .register('DataSpec', summarizeDataSpec)
  .register('ChartDef', summarizeChartDef)

/** The one call every consumer uses — total, never raw JSON. */
export function summarize(field: PropField, value: unknown, locale: Locale): SubjectSummary {
  return summarizeRegistry.summarize(field, value, locale)
}
