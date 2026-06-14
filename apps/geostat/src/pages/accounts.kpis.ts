import { codesOf }              from '@geostat/engine'
import { ACCOUNTS_CLASSIFIERS } from '@/data/accounts/store'
import type { KpiSpec }         from '@geostat/react'

const _years     = (codesOf(ACCOUNTS_CLASSIFIERS.time) as number[]).slice().sort((a, b) => a - b)
const FIRST_YEAR = _years[0]
const LAST_YEAR  = _years[_years.length - 1]

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
    value: { type: 'cagr', measure: 'B1G', from: FIRST_YEAR, to: LAST_YEAR },
    trend: { type: 'cagr', measure: 'B1G', from: FIRST_YEAR, to: LAST_YEAR },
    trendSub: `${FIRST_YEAR}–${LAST_YEAR}`,
  },
  {
    id: 'p1-cagr', label: 'გამოშვება — საშუალო წლიური ზრდა',
    unit: '%', color: '#0080BE', mode: 'range',
    value: { type: 'cagr', measure: 'P1',  from: FIRST_YEAR, to: LAST_YEAR },
    trend: { type: 'cagr', measure: 'P1',  from: FIRST_YEAR, to: LAST_YEAR },
    trendSub: `${FIRST_YEAR}–${LAST_YEAR}`,
  },
  {
    id: 'labor-share', label: 'შრომის წილი დამატებულ ღირებულებაში',
    unit: '%', color: '#4ECDC4', mode: 'range',
    value: { type: 'share', num: { measure: 'D1', time: LAST_YEAR }, denom: { measure: 'B1G', time: LAST_YEAR } },
    trend: { type: 'static', value: 'სტაბილური', dir: 'flat' },
    trendSub: String(LAST_YEAR),
  },
  {
    id: 'b9', label: 'წმინდა დაკრედიტება/სესხება  (B9)',
    unit: 'მლნ ₾', color: '#E76F51', mode: 'range',
    value: { type: 'point', measure: 'B9', format: 'mln_gel', abs: true, time: LAST_YEAR },
    trend: { type: 'static', value: '−', dir: 'down' },
    trendSub: String(LAST_YEAR),
  },
]