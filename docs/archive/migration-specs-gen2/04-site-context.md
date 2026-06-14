# Migration — SiteContext + Hooks (②e)

> File: `engine/react/src/context/SiteContext.tsx`

---

## SiteContextValue

```ts
interface SiteContextValue {
  stores:  Record<string, DataStore>
  pages:   Record<string, PageConfigBase>
  nav:     NavItem[]
  chrome:  Record<string, string>   // slot → variant key
  locale:  string                   // active locale ('ka' | 'en')
  i18n:    SiteManifest['i18n']     // { locales, defaultLocale, fallbackLocale }
}
```

## SiteProvider

```ts
export function SiteProvider({ stores, pages, nav, chrome = {}, locale, i18n, children }) { /* ... */ }
```

## Store hooks

```ts
export const useStores   = () => useContext(SiteContext)!.stores
export const useSiteNav  = () => useContext(SiteContext)!.nav
export const useSiteChrome = () => useContext(SiteContext)!.chrome
export const useSitePages  = () => useContext(SiteContext)!.pages
export const usePageById   = (id: string) => useContext(SiteContext)!.pages[id] ?? null

// useStoreQuery — M-5 enhancement
// Inner components: imperative store access without prop-drilling
// storeKey absent → resolves via pageStoreKey → 'default'
export function useStoreQuery(storeKey?: string) {
  const stores = useStores()
  const store  = stores[storeKey ?? 'default'] ?? stores[Object.keys(stores)[0]]
  return (q: StoreQuery, ctx: SectionContext): EngineRow[] => store.query(q, ctx)
}
```

## I18n hooks

```ts
export const useLocale = (): string                => useContext(SiteContext)!.locale
export const useI18n   = (): SiteManifest['i18n'] => useContext(SiteContext)!.i18n

// useFmt — number/date formatter for current locale
// no memo: formatterRegistry.get() is O(1) Map lookup
export function useFmt(): LocaleFormatter {
  const { locale, i18n } = useContext(SiteContext)!
  return formatterRegistry.get(locale, i18n.fallbackLocale)
}

// useResolveLocale — content string resolver
// ❌ DEPRECATED: resolveLocaleString(def.title, ctx.locale, 'ka') — hardcoded fallback, verbose
// ✅ CANONICAL: const t = useResolveLocale(); <h2>{t(def.title)}</h2>
export function useResolveLocale(): (s: LocaleString) => string {
  const { locale, i18n } = useContext(SiteContext)!
  return useCallback(
    (s: LocaleString) => resolveLocaleString(s, locale, i18n.fallbackLocale),
    [locale, i18n.fallbackLocale],
  )
}

// useT — system UI strings (i18next namespace)
// Shell: const t = useT('section'); t('export') → 'ექსპორტი' | 'Export'
export function useT(ns: string): (key: string, vars?: Record<string, string>) => string {
  const { locale } = useContext(SiteContext)!
  return (key, vars) => i18next.t(`${ns}:${key}`, { lng: locale, ...vars })
}
```

## Exports from react/index.ts

```ts
export { SiteProvider, useStores, useSiteNav, usePageById,
         useStoreQuery, useLocale, useI18n, useFmt, useResolveLocale, useT }
  from './individual/context/SiteContext'
```