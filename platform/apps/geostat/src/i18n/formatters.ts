// ── Locale formatters — Intl.NumberFormat + Intl.DateTimeFormat ──────────
//
//  Registry + Strategy pattern (Grafana LocaleContext):
//    formatterRegistry.register(locale, formatter)
//  OCP: new locale = one register() call. Zero engine/react/plugins change.
//
//  Imported once at app startup (main.tsx / setupRegistrations).
//  Side-effect: populates formatterRegistry for 'ka' and 'en'.
//

import { formatterRegistry } from '@geostat/engine'
import type { LocaleFormatter } from '@geostat/engine'

function makeFormatter(tag: string): LocaleFormatter {
  return {
    number: (v, o) =>
      new Intl.NumberFormat(tag, {
        maximumFractionDigits: o?.decimals ?? 0,
        minimumFractionDigits: o?.decimals ?? 0,
      }).format(v * (o?.scale ?? 1)),

    percent: (v, o) =>
      new Intl.NumberFormat(tag, {
        style:                 'percent',
        maximumFractionDigits: o?.decimals ?? 1,
        minimumFractionDigits: o?.decimals ?? 1,
      }).format(v),

    currency: (v, c) =>
      new Intl.NumberFormat(tag, { style: 'currency', currency: c }).format(v),

    date: (d, o) =>
      o?.format === 'year'
        ? String(d.getFullYear())
        : o?.format === 'month'
        ? new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }).format(d)
        : new Intl.DateTimeFormat(tag).format(d),
  }
}

formatterRegistry
  .register('ka', makeFormatter('ka-GE'))
  .register('en', makeFormatter('en-US'))