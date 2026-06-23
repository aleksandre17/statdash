// ── SiteProvider — AppSmith/Retool resource injection pattern ─────────
//
//  App-level registry: stores · pages · nav · chrome · locale · i18n
//
//  Usage:
//    <SiteProvider stores={{ gdp: gdpStore }} nav={nav} locale={manifest.i18n.defaultLocale} i18n={manifest.i18n}>
//      <App />
//    </SiteProvider>
//
//  Reads:
//    usePageStore('gdp')   — resolves store in Page.tsx
//    useSiteNav()          — reads nav registry in Sidebar.tsx
//    useLocale()           — active locale from URL routing
//    useFmt()              — number/date formatter for active locale
//    useResolveLocale()    — LocaleString → concrete string
//    useT(ns)              — system UI string translation
//
import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import i18next                                                    from 'i18next'
import type { DataStore, StoreQuery, SectionContext, EngineRow }  from '@statdash/engine'
import {
  formatterRegistry,
  resolveLocaleString,
  type LocaleFormatter,
  type LocaleString,
}                                                                 from '@statdash/engine'
import type { NavItemDef }                                        from '../page'
import type { NodePageConfig }                                    from '../engine/types'
import type { ChromeConfig }                                      from './ChromeConfig'
import type { ChromeEntry }                                        from '../engine/types'

export type { ChromeConfig } from './ChromeConfig'

// ── I18nConfig — locale configuration from SiteManifest ───────────────

export interface I18nConfig {
  locales:        string[]
  defaultLocale:  string
  fallbackLocale: string
}

// ── NavEntry — runtime nav item (config fields + route metadata) ───────

export interface NavEntry extends NavItemDef {
  id:    string
  path:  string
  color: string
}

// ── Context ────────────────────────────────────────────────────────────

interface SiteContextValue {
  stores:        Record<string, DataStore>
  pages:         Record<string, NodePageConfig>
  nav:           NavEntry[]
  chrome:        Record<string, ChromeEntry>
  chromeConfig?: ChromeConfig
  locale:        string
  i18n:          I18nConfig
}

const SiteContext = createContext<SiteContextValue | null>(null)

// ── LocaleContext — URL-driven locale override ────────────────────────
// SiteLocaleProvider wraps /:locale/* routes; useLocale() reads this first.

const LocaleContext = createContext<string | null>(null)

export function SiteLocaleProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

// ── SiteProvider ───────────────────────────────────────────────────────

export interface SiteProviderProps {
  stores:        Record<string, DataStore>
  nav:           NavEntry[]
  pages?:        Record<string, NodePageConfig>
  chrome?:       Record<string, ChromeEntry>
  chromeConfig?: ChromeConfig
  locale?:       string
  i18n:          I18nConfig
  children:      ReactNode
}

export function SiteProvider({
  stores,
  nav,
  pages        = {},
  chrome       = {},
  chromeConfig,
  i18n,
  locale,
  children,
}: SiteProviderProps) {
  const resolvedLocale = locale ?? i18n.defaultLocale
  const value = useMemo(
    () => ({ stores, pages, nav, chrome, chromeConfig, locale: resolvedLocale, i18n }),
    [stores, pages, nav, chrome, chromeConfig, resolvedLocale, i18n],
  )
  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
}

// ── Store hooks ────────────────────────────────────────────────────────

export function usePageStore(key: string): DataStore {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[usePageStore] Must be called inside <SiteProvider>.')
  const store = ctx.stores[key]
  if (!store) {
    const registered = Object.keys(ctx.stores).join(', ') || '(none)'
    throw new Error(`[SiteProvider] Store not found: "${key}". Registered: ${registered}`)
  }
  return store
}

export function useStores(): Record<string, DataStore> {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[useStores] Must be called inside <SiteProvider>.')
  return ctx.stores
}

export function useStoreQuery(storeKey?: string): (q: StoreQuery, ctx: SectionContext) => EngineRow[] {
  const stores = useStores()
  const store  = stores[storeKey ?? 'default'] ?? stores[Object.keys(stores)[0]]
  return useCallback((q, ctx) => store.querySync(q, ctx), [store])
}

// ── Nav + Chrome + Pages hooks ─────────────────────────────────────────

export function useSiteNav(): NavEntry[] {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[useSiteNav] Must be called inside <SiteProvider>.')
  return ctx.nav
}

export function useSiteChrome(): Record<string, ChromeEntry> {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[useSiteChrome] Must be called inside <SiteProvider>.')
  return ctx.chrome
}

export function useChromeConfig(): ChromeConfig {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[useChromeConfig] Must be called inside <SiteProvider>.')
  if (!ctx.chromeConfig) throw new Error('[useChromeConfig] chromeConfig not provided to <SiteProvider>.')
  return ctx.chromeConfig
}

export function useSitePages(): Record<string, NodePageConfig> {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[useSitePages] Must be called inside <SiteProvider>.')
  return ctx.pages
}

export function usePageById(id: string): NodePageConfig | null {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[usePageById] Must be called inside <SiteProvider>.')
  return ctx.pages[id] ?? null
}

// ── I18n hooks ─────────────────────────────────────────────────────────

export function useLocale(): string {
  const localeOverride = useContext(LocaleContext)
  const ctx            = useContext(SiteContext)
  if (!ctx) throw new Error('[useLocale] Must be called inside <SiteProvider>.')
  return localeOverride ?? ctx.locale
}

export function useI18n(): I18nConfig {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('[useI18n] Must be called inside <SiteProvider>.')
  return ctx.i18n
}

// useFmt — number/date formatter for current locale (O(1) Map lookup, no memo needed)
export function useFmt(): LocaleFormatter {
  const locale = useLocale()
  const i18n   = useI18n()
  return formatterRegistry.get(locale, i18n.fallbackLocale)
}

// useResolveLocale — content string resolver (memoized on locale + fallback)
// ❌ resolveLocaleString(def.title, ctx.locale, i18n.fallbackLocale) — verbose, must thread fallback manually
// ✅ const t = useResolveLocale(); t(def.title) — auto fallback from manifest
export function useResolveLocale(): (s: LocaleString) => string {
  const locale = useLocale()
  const i18n   = useI18n()
  return useCallback(
    (s: LocaleString) => resolveLocaleString(s, locale, i18n.fallbackLocale),
    [locale, i18n.fallbackLocale],
  )
}

// useResolveLocaleSafe — non-throwing LocaleString resolver.
//  Degrades gracefully outside a <SiteProvider> (Postel's Law): app-agnostic,
//  context-optional components (e.g. StatusBadge, used in shells AND in isolated
//  stories/tests) resolve content without hard-requiring the site context. When
//  a provider IS present, it uses the active locale + manifest fallback.
const DEFAULT_LOCALE_FALLBACK = 'en'
export function useResolveLocaleSafe(): (s: LocaleString) => string {
  const localeOverride = useContext(LocaleContext)
  const ctx            = useContext(SiteContext)
  const locale   = localeOverride ?? ctx?.locale ?? DEFAULT_LOCALE_FALLBACK
  const fallback = ctx?.i18n.fallbackLocale ?? DEFAULT_LOCALE_FALLBACK
  return useCallback(
    (s: LocaleString) => resolveLocaleString(s, locale, fallback),
    [locale, fallback],
  )
}

// useT — system UI strings (i18next namespace)
// Shell: const t = useT('section'); t('export') → translated string for active locale
export function useT(ns: string): (key: string, vars?: Record<string, string>) => string {
  const locale = useLocale()
  return useCallback(
    (key: string, vars?: Record<string, string>) => i18next.t(`${ns}:${key}`, { lng: locale, ...vars }),
    [ns, locale],
  )
}