import type { KpiSpec } from '@geostat/react'

export const GDP_KPIS: KpiSpec[] = [

  // ── year mode ──────────────────────────────────────────────────────
  {
    id: 'gdp-total', label: 'მშპ საბაზრო ფასებში', unit: 'მლნ ₾', color: '#0080BE', mode: 'year',
    value: { type: 'point',  measure: 'GDP',        format: 'mln_gel' },
    trend: { type: 'yoy',    measure: 'GDP' },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'gdp-growth', label: 'რეალური ზრდა', unit: '%', color: '#00A896', mode: 'year',
    value: { type: 'point',  measure: 'GDP_GROWTH', format: 'sign_pct' },
    trend: { type: 'static', value: 'რეალური', dir: 'up' },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'gdp-per-capita', label: 'მშპ ერთ სულზე', unit: '$', color: '#4ECDC4', mode: 'year',
    value: { type: 'point',  measure: 'GDP_PER_CAPITA', format: 'mln_gel' },
    trend: { type: 'yoy',    measure: 'GDP_PER_CAPITA' },
    trendSub: 'წინა წელთან შედარებით',
  },
  {
    id: 'gdp-deflator', label: 'მშპ-ს დეფლატორი', unit: '%', color: '#7B6CF6', mode: 'year',
    value: { type: 'point', measure: 'GDP_DEFLATOR', format: 'sign_pct' },
    trend: { type: 'yoy',   measure: 'GDP_DEFLATOR' },
    trendSub: 'ფასების ცვლილება',
  },

  // ── range mode ─────────────────────────────────────────────────────
  {
    id: 'gdp-cagr', label: 'მშპ — საშუალო წლიური ზრდა', unit: '%', color: '#0080BE', mode: 'range',
    value: { type: 'cagr', measure: 'GDP', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', measure: 'GDP', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },
  {
    id: 'gdp-growth-avg', label: 'საშუალო რეალური ზრდა', unit: '%', color: '#00A896', mode: 'range',
    value: { type: 'cagr', measure: 'GDP_GROWTH', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', measure: 'GDP_GROWTH', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },
  {
    id: 'gdp-per-cap-last', label: 'ერთ სულ მოსახლეზე', unit: '$', color: '#4ECDC4', mode: 'range',
    value: { type: 'point', measure: 'GDP_PER_CAPITA', format: 'mln_gel', time: { $ctx: 'toYear' } },
    trend: { type: 'yoy',   measure: 'GDP_PER_CAPITA', time: { $ctx: 'toYear' } },
    trendSub: '{toYear}',
  },
  {
    id: 'gdp-svc-cagr', label: 'მშპ-ს დეფლატორი', unit: '%', color: '#7B6CF6', mode: 'range',
    value: { type: 'cagr', measure: 'GDP_SVC', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trend: { type: 'cagr', measure: 'GDP_SVC', from: { $ctx: 'fromYear' }, to: { $ctx: 'toYear' } },
    trendSub: '{fromYear}–{toYear}',
  },
]