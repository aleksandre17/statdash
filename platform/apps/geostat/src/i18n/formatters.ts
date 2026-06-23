// ── Locale formatters — Intl.NumberFormat + Intl.DateTimeFormat ──────────
//
//  Registry + Strategy pattern (Grafana LocaleContext):
//    formatterRegistry.register(locale, formatter)
//  OCP: new locale = one more entry in manifest.i18n.locales. Zero code change.
//
//  ADR-0026: the locale LIST is manifest data, no longer hardcoded here.
//  registerFormatters(locales) is called at boot from manifest.i18n.locales
//  (App.tsx, post-bootstrap) so the same code serves any site's locale set —
//  local fallback or /api/bootstrap. The formatter STRATEGY (how a number /
//  date is built) stays here: that is implementation, not manifest data.
//
//  The locale code is used directly as the Intl tag (e.g. 'ka', 'en'); the
//  runtime applies sensible region defaults, so no app-specific 'ka-GE'/'en-US'
//  mapping is hardcoded. A site needing an explicit region tag would carry it
//  in its locale code (Phase B, when site_config defines the locale catalog).

import { formatterRegistry } from '@statdash/engine'
import type { LocaleFormatter } from '@statdash/engine'

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

/**
 * Register an Intl formatter for each locale the active manifest declares.
 * Idempotent: re-registering a locale overwrites with the same strategy.
 */
export function registerFormatters(locales: string[]): void {
  for (const locale of locales) {
    formatterRegistry.register(locale, makeFormatter(locale))
  }
}
