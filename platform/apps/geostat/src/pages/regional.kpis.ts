import type { KpiSpec } from '@geostat/react'

const GVA: Pick<Extract<KpiSpec['value'], { type: 'point' }>, 'measure'> = { measure: 'GVA' }

export const REGIONAL_KPIS: KpiSpec[] = [

  // ── year mode ──────────────────────────────────────────────────────
  {
    id: 'reg-gva',       label: 'მთლიანი დამატებული ღირებულება', unit: 'მლნ ₾', color: '#0080BE', mode: 'year',
    value: { type: 'point', ...GVA, format: 'mln_gel' },
    trend: { type: 'yoy',   ...GVA },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'reg-growth',    label: 'წლიური ზრდა', unit: '%', color: '#00A896', mode: 'year',
    value: { type: 'yoy',  ...GVA },
    trend: { type: 'yoy',  ...GVA },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'reg-share',     label: 'ეროვნული მშპ-ში წილი', unit: '%', color: '#4ECDC4', mode: 'year',
    value: {
      type:  'share',
      num:   { measure: 'GVA' },
      denom: { measure: 'GVA', filter: { geo: '' } },
    },
    trend:    { type: 'static', value: 'ეროვნული ჯამიდან', dir: 'flat' },
    trendSub: 'ეროვნული ჯამიდან',
  },
  {
    id: 'reg-cagr-year', label: 'საშუალო წლიური ზრდა ({fromYear}–{toYear})', unit: '%', color: '#7B6CF6', mode: 'year',
    value: { type: 'cagr', ...GVA, from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', ...GVA, from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },

  // ── range mode ─────────────────────────────────────────────────────
  {
    id: 'reg-cagr',      label: 'დამატებული ღირებულება — საშუალო წლიური ზრდა', unit: '%', color: '#0080BE', mode: 'range',
    value: { type: 'cagr', ...GVA, from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', ...GVA, from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },
  {
    id: 'reg-gva-last',  label: 'დამატებული ღირებულება — {toYear}', unit: 'მლნ ₾', color: '#00A896', mode: 'range',
    value: { type: 'point', ...GVA, time: { $ctx: 'toYear' },  format: 'mln_gel' },
    trend: { type: 'yoy',   ...GVA, time: { $ctx: 'toYear' } },
    trendSub: '{toYear}',
  },
  {
    id: 'reg-gva-first', label: 'დამატებული ღირებულება — {fromYear}', unit: 'მლნ ₾', color: '#4ECDC4', mode: 'range',
    value: { type: 'point', ...GVA, time: { $ctx: 'fromYear' }, format: 'mln_gel' },
    trend: { type: 'static', value: 'საწყისი', dir: 'flat' },
    trendSub: '{fromYear}',
  },
  {
    id: 'reg-avg-growth', label: 'საშუალო წლიური ზრდა', unit: '%', color: '#7B6CF6', mode: 'range',
    value: { type: 'cagr', ...GVA, from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', ...GVA, from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear} · საშუალო წლიური ზრდა',
  },
]