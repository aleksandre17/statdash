// ── P3-1: Constructor round-trip — primitives ─────────────────────────────────
//
//  Covers: LocaleString · VisibilityExpr (all ops) · RowSpec · ColumnDef · TableConfig
//
//  WHY: Constructor (Phase 2) round-trips NodePageConfig through JSON.  Any
//  non-serializable value is silently dropped.  These tests prove the primitive
//  schema types are lossless before the canvas editor exists.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { RowSpec, ColumnDef, TableConfig } from './data-spec'
import type { VisibilityExpr }                  from './visibility'
import type { LocaleString } from '../i18n/types'

// ── utility ───────────────────────────────────────────────────────────────────

function roundTrip<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }

function expectRoundTrip<T>(v: T): void { expect(roundTrip(v)).toEqual(v) }

// ── LocaleString ──────────────────────────────────────────────────────────────

describe('LocaleString — round-trip', () => {

  it('plain string survives', () => expectRoundTrip<LocaleString>('მშპ'))

  it('bilingual record survives', () => expectRoundTrip<LocaleString>({ ka: 'მშპ', en: 'GDP' }))

  it('multi-locale record survives', () =>
    expectRoundTrip<LocaleString>({ ka: 'სულ', en: 'Total', ru: 'Всего' }))

})

// ── VisibilityExpr ────────────────────────────────────────────────────────────

describe('VisibilityExpr — round-trip (all ops)', () => {

  const leaf:  VisibilityExpr = { op: 'eq',  param: 'geo',     is: 'GE' }
  const leaf2: VisibilityExpr = { op: 'neq', param: 'sector',  is: '_T' }

  it('eq',       () => expectRoundTrip(leaf))
  it('neq',      () => expectRoundTrip(leaf2))
  it('in',       () => expectRoundTrip<VisibilityExpr>({ op: 'in',    param: 'geo',  values: ['GE', 'AM'] }))
  it('isset',    () => expectRoundTrip<VisibilityExpr>({ op: 'isset', param: 'breakdown' }))
  it('and',      () => expectRoundTrip<VisibilityExpr>({ op: 'and',   exprs: [leaf, leaf2] }))
  it('or',       () => expectRoundTrip<VisibilityExpr>({ op: 'or',    exprs: [leaf, { op: 'isset', param: 'breakdown' }] }))
  it('not',      () => expectRoundTrip<VisibilityExpr>({ op: 'not',   expr: leaf }))
  it('mode-is',  () => expectRoundTrip<VisibilityExpr>({ op: 'mode-is',  mode:  'year' }))
  it('mode-in',  () => expectRoundTrip<VisibilityExpr>({ op: 'mode-in',  modes: ['year', 'range'] }))
  it('mode-not', () => expectRoundTrip<VisibilityExpr>({ op: 'mode-not', mode:  'compare' }))

  it('null "is" value survives (no-selection state)', () =>
    expectRoundTrip<VisibilityExpr>({ op: 'eq', param: 'geo', is: null }))

  it('deeply nested boolean tree', () => {
    const expr: VisibilityExpr = {
      op: 'and',
      exprs: [
        { op: 'or',       exprs: [leaf, leaf2] },
        { op: 'not',      expr:  { op: 'in', param: 'geo', values: ['RU'] } },
        { op: 'mode-in',  modes: ['year'] },
      ],
    }
    expectRoundTrip(expr)
  })

})

// ── RowSpec ───────────────────────────────────────────────────────────────────

describe('RowSpec — round-trip', () => {

  it('minimal', () => expectRoundTrip<RowSpec>({ code: 'B1G' }))

  it('full — all optional fields', () => expectRoundTrip<RowSpec>({
    code:    'D1',
    label:   { ka: 'ხელფასი', en: 'Wages' },
    color:   '#1f77b4',
    negate:  false,
    isTotal: false,
    pctOf:   'B1G',
  }))

})

// ── ColumnDef ─────────────────────────────────────────────────────────────────

describe('ColumnDef — round-trip', () => {

  it('minimal', () =>
    expectRoundTrip<ColumnDef>({ key: 'value', label: { ka: 'მნიშვნელობა', en: 'Value' } }))

  it('full — all optional fields', () => expectRoundTrip<ColumnDef>({
    key:    'pct',
    label:  { ka: 'წილი', en: 'Share' },
    format: 'pct',
    width:  '120px',
    align:  'r',
    bar:    { min: 0, max: 100 },
  }))

  it('bar: true (boolean form)', () => {
    const c: ColumnDef = { key: 'value', label: 'Value', bar: true }
    expectRoundTrip(c)
    expect(roundTrip(c).bar).toBe(true)
  })

})

// ── TableConfig ───────────────────────────────────────────────────────────────

describe('TableConfig — round-trip', () => {

  it('full — all optional fields', () => expectRoundTrip<TableConfig>({
    colLabel:    'Region',
    columns:     [
      { key: 'value', label: { ka: 'მნიშვნელობა', en: 'Value' }, format: 'mln_gel', align: 'r' },
      { key: 'pct',   label: { ka: 'წილი',         en: 'Share'  }, format: 'pct',    align: 'r', bar: true },
    ],
    valueLabel:   'Amount',
    color:        '#aec7e8',
    indent:       true,
    statusFlags:  true,
    caption:      'Source: GeoStat, 2024',
    footer:       { value: 'sum', pct: 'avg' },
    footerLabel:  'Total',
    seriesFormat: { 'B1G': 'mln_gel', 'D1': 'sign_pct' },
    seriesOrder:  ['B1G', 'D1', 'B2A3G'],
  }))

})

// ── Non-serializable guard ────────────────────────────────────────────────────

describe('Non-serializable guard', () => {

  it('undefined field values are dropped by JSON (constructor must omit, not undefined)', () => {
    // JSON.stringify converts undefined values → absent keys.
    // Constructor must omit fields rather than set to undefined.
    const obj = { a: 1, b: undefined }
    const back = JSON.parse(JSON.stringify(obj)) as typeof obj
    expect(back).not.toHaveProperty('b')
    expect(back.a).toBe(1)
  })

})
