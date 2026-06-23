// ── LocaleFormatter — number/date formatting strategy (Registry + Strategy) ──
//
//  New locale: formatterRegistry.register('hy', hyFormatter) → done. OCP ✅
//  Zero code change in engine/react/plugins for new locale.
//  Grafana: LocaleContext · Intl.NumberFormat pattern.
//

export interface LocaleFormatter {
  number:   (value: number, opts?: { decimals?: number; scale?: number }) => string
  percent:  (value: number, opts?: { decimals?: number })                 => string
  currency: (value: number, currency: string)                             => string
  date:     (value: Date,   opts?: { format?: 'year' | 'month' | 'full' }) => string
}

// ── builtinFormatter — locale-agnostic fallback ───────────────────────────────

const builtinFormatter: LocaleFormatter = {
  number: (v, o) => {
    const factor = 10 ** (o?.decimals ?? 0)
    return String(Math.round(v * (o?.scale ?? 1) * factor) / factor)
  },
  percent:  (v, o) => `${(v * 100).toFixed(o?.decimals ?? 1)}%`,
  currency: (v, c) => `${v.toFixed(2)} ${c}`,
  date:     (d, o) => o?.format === 'year' ? String(d.getFullYear()) : d.toLocaleDateString(),
}

// ── LocaleFormatterRegistry ───────────────────────────────────────────────────

class LocaleFormatterRegistry {
  private map = new Map<string, LocaleFormatter>()

  register(locale: string, formatter: LocaleFormatter): this {
    this.map.set(locale, formatter)
    return this
  }

  get(locale: string, fallback: string): LocaleFormatter {
    return this.map.get(locale) ?? this.map.get(fallback) ?? builtinFormatter
  }
}

export const formatterRegistry = new LocaleFormatterRegistry()