import type { KpiSpec } from '@geostat/react'

export const ACCOUNTS_KPIS: KpiSpec[] = [

  // ── year mode ──────────────────────────────────────────────────────
  {
    id: 'b5g', label: 'მთლიანი ეროვნული შემოსავალი (B5G)', unit: 'მლნ ₾', color: '#4ECDC4', mode: 'year',
    value: { type: 'point', measure: 'B5G', format: 'mln_gel' },
    trend: { type: 'yoy',   measure: 'B5G' },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'b6g', label: 'მთლიანი განკარგვადი შემოსავალი (B6G)', unit: 'მლნ ₾', color: '#7B6CF6', mode: 'year',
    value: { type: 'point', measure: 'B6G', format: 'mln_gel' },
    trend: { type: 'yoy',   measure: 'B6G' },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'b8g', label: 'მთლიანი დანაზოგი (B8G)', unit: 'მლნ ₾', color: '#F4A261', mode: 'year',
    value: { type: 'point', measure: 'B8G', format: 'mln_gel' },
    trend: { type: 'yoy',   measure: 'B8G' },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'b9-year', label: 'წმინდა დაკრედიტება/სესხება (B9)', unit: 'მლნ ₾', color: '#E76F51', mode: 'year',
    value: { type: 'point', measure: 'B9', format: 'mln_gel' },
    trend: { type: 'yoy',   measure: 'B9' },
    trendSub: 'წინა წელთან შედარებით',
  },

  // ── range mode ─────────────────────────────────────────────────────
  {
    id: 'b1g-cagr', label: 'დამატებული ღირებულება — საშუალო წლიური ზრდა',
    unit: '%', color: '#00A896', mode: 'range',
    value: { type: 'cagr', measure: 'B1G', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', measure: 'B1G', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },
  {
    id: 'p1-cagr', label: 'გამოშვება — საშუალო წლიური ზრდა',
    unit: '%', color: '#0080BE', mode: 'range',
    value: { type: 'cagr', measure: 'P1',  from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', measure: 'P1',  from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },
  {
    id: 'labor-share', label: 'შრომის წილი დამატებულ ღირებულებაში',
    unit: '%', color: '#4ECDC4', mode: 'range',
    value: { type: 'share', num: { measure: 'D1', time: { $ctx: 'toYear' } }, denom: { measure: 'B1G', time: { $ctx: 'toYear' } } },
    trend: { type: 'static', value: 'სტაბილური', dir: 'flat' },
    trendSub: '{toYear}',
  },
  {
    id: 'b9', label: 'წმინდა დაკრედიტება/სესხება  (B9)',
    unit: 'მლნ ₾', color: '#E76F51', mode: 'range',
    value: { type: 'point', measure: 'B9', format: 'mln_gel', abs: true, time: { $ctx: 'toYear' } },
    trend: { type: 'static', value: '−', dir: 'down' },
    trendSub: '{toYear}',
  },
]