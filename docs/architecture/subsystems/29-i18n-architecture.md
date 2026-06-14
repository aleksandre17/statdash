# Migration — I18n Platform-Grade Architecture

> **Reference** — originated as a migration spec; moved to the corpus 2026-06-02 (migration DONE).
> Authority: live code + `docs/plan/SYSTEM-PIPELINE-TREE.md`. Describes the **implemented** subsystem.


> Sanity (structured content) + Grafana (locale plugin registry) + Eurostat (SDMX multilingual + URL prefix) + ONS (namespace translations).
> **Phase 1: locales ['ka', 'en'] both implemented. System strings in Phase 1. fromSDMX extracts ka+en.**
> Platform rule: new locale = 0 code change in engine/react/plugins.

---

## სამი სახის ტექსტი — სამი განსხვავებული მექანიზმი (SRP)

```
1. Content strings  — NodeDef titles, labels, units, classifier labels
   → LocaleString inline (Sanity structured content pattern)
   → stored in DB as JSON, Constructor reads/writes directly

2. System UI strings — button labels, error messages, tooltips
   → Plugin META.i18n namespace (Grafana plugin translations pattern)
   → loaded at setupRegistrations(), accessed via useT(ns, key)

3. Data formatting  — numbers, dates, percentages
   → LocaleFormatterRegistry (Strategy + Registry pattern)
   → new locale = register one formatter → OCP ✅
```

---

## Layer ① — engine/core (agnostic)

### LocaleString + resolvers

```ts
// engine/core/src/i18n/types.ts
export type LocaleString =
  | string                    // 'მშპ' — backward compat ✅
  | Record<string, string>    // { ka: 'მშპ', en: 'GDP' } — JSON-serializable ✅
// JSON.parse(JSON.stringify({ ka: 'მშპ', en: 'GDP' })) === same ✅

// engine/core/src/i18n/resolve.ts
export function resolveLocaleString(s: LocaleString, locale: string, fallback: string): string {
  if (typeof s === 'string') return s
  return s[locale] ?? s[fallback] ?? Object.values(s)[0] ?? ''
}

export function resolveLabel(
  code: string, classifier: Record<string, LocaleString> | undefined,
  locale: string, fallback: string,
): string {
  const entry = classifier?.[code]
  if (!entry) return code                      // unknown code → show as-is
  return resolveLocaleString(entry, locale, fallback)
}
```

### LocaleFormatterRegistry

```ts
// engine/core/src/i18n/format.ts
export interface LocaleFormatter {
  number:   (value: number, opts?: { decimals?: number; scale?: number }) => string
  percent:  (value: number, opts?: { decimals?: number })                 => string
  currency: (value: number, currency: string)                             => string
  date:     (value: Date,   opts?: { format?: 'year' | 'month' | 'full' }) => string
}

class LocaleFormatterRegistry {
  private map = new Map<string, LocaleFormatter>()
  register(locale: string, formatter: LocaleFormatter): this { this.map.set(locale, formatter); return this }
  get(locale: string, fallback: string): LocaleFormatter {
    return this.map.get(locale) ?? this.map.get(fallback) ?? builtinFormatter
  }
}
export const formatterRegistry = new LocaleFormatterRegistry()
// New locale: formatterRegistry.register('hy', hyFormatter) → done. OCP ✅
```

```ts
// src/i18n/formatters.ts — app layer registers (knows 'ka-GE', 'en-US')
formatterRegistry.register('ka', {
  number:  (v, o) => new Intl.NumberFormat('ka-GE', { maximumFractionDigits: o?.decimals ?? 1 })
                       .format(v * (o?.scale ?? 1)),
  percent: (v, o) => new Intl.NumberFormat('ka-GE', { style: 'percent',
                       maximumFractionDigits: o?.decimals ?? 1 }).format(v),
  currency:(v, c) => new Intl.NumberFormat('ka-GE', { style: 'currency', currency: c }).format(v),
  date:    (d, o) => o?.format === 'year' ? String(d.getFullYear())
                       : new Intl.DateTimeFormat('ka-GE').format(d),
})
formatterRegistry.register('en', { /* same with 'en-US' */ })
```

### Classifier + DisplayMap — multilingual

```ts
// engine/core/src/data/store.ts
// BEFORE: type Classifier = Record<string, string>
// AFTER:  backward compat: plain string ∈ LocaleString ✅
export type Classifier = Record<string, LocaleString>
// { 'GE': { ka: 'საქართველო', en: 'Georgia' }, 'A': { ka: 'სოფლის მეურნეობა', en: 'Agriculture' } }

export interface DisplayMap {
  label?:       LocaleString    // locale-aware
  description?: LocaleString    // locale-aware
  unit?:        LocaleString    // 'მლნ. ლარი' vs 'mln GEL' — locale differs
  unitShort?:   LocaleString    // chart axis label
  decimals?:    number          // locale-agnostic
  scale?:       number          // locale-agnostic
  colorScale?:  string          // locale-agnostic
}
```

### SectionContext — locale channel

```ts
export interface SectionContext {
  timeMode: TimeMode
  dims:     Record<string, DimVal>
  locale?:  string   // NEW — ExternalStore: GET /api?lang=ka. Engine: agnostic (never reads it).
}
```

### SiteManifest — i18n config

```ts
interface SiteManifest {
  // ...existing...
  i18n: {
    locales:        string[]   // ['ka', 'en'] — Constructor shows input per locale
    defaultLocale:  string     // 'ka' — URL root → redirect
    fallbackLocale: string     // 'ka' — missing translation → fallback
  }
}
// Multi-tenant: Geostat=['ka','en'] · ENstat=['et','en','ru'] · ArmStat=['hy','en','ru']
// engine/react/plugins = 0 change per tenant ✅
```

### Exports from engine/index.ts

```ts
export { LocaleString, resolveLocaleString, resolveLabel } from './i18n/types'
export { LocaleFormatter, formatterRegistry }               from './i18n/format'
```

---

## Layer ② — engine/react (adapter)

### RenderContext i18n additions

```ts
// ❌ DEPRECATED: fmt: LocaleFormatter — function object in data ctx (SRP violation)
//    same reason set() was removed. Functions → hooks only.
// ✅ CANONICAL: pure data in ctx
interface RenderContext {
  // ...existing...
  locale:         string                     // 'ka' | 'en' — from URL, cascades tree
  fallbackLocale: string                     // from manifest.i18n.fallbackLocale
  classifiers:    Record<string, Classifier> // pre-extracted renderNode step 3
  display:        Record<string, DisplayMap> // pre-extracted renderNode step 3
  // NOT here: fmt (useFmt hook) · t (useResolveLocale hook)
}
```

### NodeBase + config string fields → LocaleString

```ts
NodeBase.navLabel?: LocaleString
PageConfigBase.title: LocaleString
SectionNode.title/label/prependLabel: LocaleString
KpiDef.label: LocaleString
ColumnDef.label: LocaleString
LinkDef.label: LocaleString
ChartDef.xLabel?/yLabel?/title?: LocaleString
BarDef.label?: LocaleString   // BLOCKER 3
// Backward compat: plain string ∈ LocaleString → existing configs untouched ✅
```

---

## Layer ③ — src (knows concrete locales)

### URL Routing — Eurostat standard

```tsx
// src/App.tsx
function App({ manifest }) {
  return (
    <SiteProvider manifest={manifest}>
      <BrowserRouter>
        <Routes>
          <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />}>
            <Route element={<AppChrome />}>
              {Object.values(manifest.pages).map(page => (
                <Route key={page.id} path={page.path!} element={<PageLoader pageId={page.id} />} />
              ))}
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
        </Routes>
      </BrowserRouter>
    </SiteProvider>
  )
}

function LocaleGuard({ manifest }: { manifest: SiteManifest }) {
  const { locale } = useParams()
  if (!manifest.i18n.locales.includes(locale!))
    return <Navigate to={`/${manifest.i18n.defaultLocale}`} replace />
  return <SiteLocaleProvider locale={locale!}><Outlet /></SiteLocaleProvider>
}
// /ka/gdp → locale='ka'. /en/gdp → locale='en'. permalink-safe ✅
```

### fromSDMX() — multilingual extraction

```ts
// src/data/*/adapter.ts
// fromSDMX(json, { locales: manifest.i18n.locales }) — locales from manifest, not hardcoded

// SDMX DSD: <Code id="GE"><Name xml:lang="ka">საქართველო</Name><Name xml:lang="en">Georgia</Name></Code>
// Result:
classifiers: { geo: { 'GE': { ka: 'საქართველო', en: 'Georgia' } } }
// Phase 1: extract ['ka','en'] both. LocaleString compat → plain string if single lang ✅
```

---

## Layer ④ — plugins

### Plugin META i18n field

```ts
// registerSlice() loads META.i18n into i18next at registration:
// Object.entries(slice.META.i18n ?? {}).forEach(([locale, translations]) =>
//   i18next.addResourceBundle(locale, slice.META.type, translations))
// New locale: add locale key to META.i18n → setupRegistrations picks it up → OCP ✅
```

### LocaleSwitcherShell — chrome plugin (M-5)

```tsx
// plugins/chrome/LocaleSwitcher/default/LocaleSwitcherShell.tsx
export function LocaleSwitcherShell(): ReactNode {
  const locale = useLocale()
  const { i18n } = useI18n()
  const nav = useNavigate()
  return (
    <select value={locale}
      onChange={e => nav(window.location.pathname.replace(`/${locale}/`, `/${e.target.value}/`))}>
      {i18n.locales.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
    </select>
  )
}
export const META: ChromeSliceMeta = {
  sliceType: 'chrome', slot: 'AppHeader', key: 'locale-switcher', label: 'Locale Switcher',
}
// New locale in manifest.i18n.locales → auto-appears. OCP ✅
```

### Shell usage pattern

```tsx
// ❌ DEPRECATED: resolveLocaleString(def.title, ctx.locale, 'ka') — hardcoded fallback
// ✅ CANONICAL: useResolveLocale() hook in inner component

function SectionControl({ def, ctx, children }) {
  const t   = useResolveLocale()   // content strings
  const fmt = useFmt()             // number/date formatting
  return (
    <section>
      <h2>{t(def.title)}</h2>
    </section>
  )
}

function TableControl({ def, ctx }) {
  const t   = useResolveLocale()
  const fmt = useFmt()
  return (
    <table>
      <thead><tr>{def.columns.map(col => <th key={col.key}>{t(col.label)}</th>)}</tr></thead>
      <tbody>
        {ctx.rows.map((row, i) => (
          <tr key={i}>
            {def.columns.map(col => {
              const raw = row[col.key]
              if (typeof raw === 'number') return <td key={col.key}>{fmt.number(raw)}</td>
              // classifiers pre-extracted by engine in ctx (not per-shell) ✅
              return <td key={col.key}>
                {resolveLabel(String(raw), ctx.classifiers[col.key], ctx.locale, ctx.fallbackLocale)}
              </td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

---

## File Map

```
① engine/core/src/i18n/
     types.ts   — LocaleString · resolveLocaleString · resolveLabel
     format.ts  — LocaleFormatter · LocaleFormatterRegistry · formatterRegistry
   engine/core/src/data/store.ts
     Classifier → Record<string, LocaleString>
     DisplayMap → label/unit/description/unitShort: LocaleString
   engine/core/src/data/types.ts
     SectionContext.locale?: string
   engine/core/src/index.ts — export i18n primitives

② engine/react/src/engine/types.ts
     RenderContext + locale · fallbackLocale · classifiers · display
     NodeBase/PageConfigBase/SectionNode/KpiDef/ColumnDef/LinkDef/ChartDef/BarDef → LocaleString
     NodeSliceMeta + i18n?
   engine/react/src/engine/renderNode.ts
     step 3 — extract classifiers+display → inject into ctx
   engine/react/src/context/SiteContext.tsx
     locale · i18n · useLocale · useI18n · useFmt · useResolveLocale · useT

③ src/App.tsx       — /:locale/ routing · LocaleGuard · SiteLocaleProvider
   src/i18n/        — formatterRegistry.register('ka',...) + ('en',...)
   src/data/*/adapter — fromSDMX({ locales: manifest.i18n.locales })

④ plugins/chrome/LocaleSwitcher/default/ — LocaleSwitcherShell + META
   plugins/*/META.i18n — translations per plugin namespace

⑤ SiteManifest — + i18n: { locales, defaultLocale, fallbackLocale }
```

---

## OCP Checkpoint

```
New locale:       manifest.i18n.locales += 'hy' + formatterRegistry.register('hy', ...) ✅
New tenant:       new manifest.i18n config → 0 code change ✅
New node type:    Shell uses useResolveLocale() + useFmt() — i18n free ✅
New classifier:   fromSDMX() returns LocaleString → 0 schema change ✅
New content field: LocaleString type → Constructor handles automatically ✅
engine/core:  zero change for new locale/tenant/node type ✅
engine/react:   zero change for new locale/tenant ✅
plugins/:         zero change for new locale (META.i18n += locale key) ✅
```