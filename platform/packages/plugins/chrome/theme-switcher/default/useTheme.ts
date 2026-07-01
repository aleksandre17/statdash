import { useCallback, useEffect, useState } from 'react'

// ── useTheme — the theme-persist hook (colour-scheme state, self-contained) ──
//
//  The theme analogue of useLocale(): it owns the current theme + a setter, and
//  drives the ONE side effect that matters — the `data-theme` attribute on the
//  document root, which the token layer (tokens.css cascade, commit e74414d)
//  reads to flip the whole semantic palette. This shell carries NO colour of its
//  own; it only chooses which token layer is live.
//
//  Unlike locale (whose source of truth is the URL), theme has no manifest/route
//  home, so its state lives here: localStorage for persistence + the OS
//  `prefers-color-scheme` as the unset default. Both are read defensively so a
//  denied-storage / SSR context degrades to the system preference rather than
//  throwing.
//
//  data-theme cascade (tokens.css, lowest → highest precedence):
//    (unset)             → @media (prefers-color-scheme) wins  ← the 'system' state
//    [data-theme="dark"] → explicit dark
//    [data-theme="light"]→ explicit light (opt out of a dark-preference OS)
//
//  OCP: `theme` is an open string. A future 'system' option needs zero shell
//  change — applyTheme already maps it to REMOVING the attribute, restoring the
//  @media system-preference behaviour. Two-state (light/dark) is just the two
//  explicit values of that same open axis.

/** localStorage key — tenant-agnostic (platform scope, no tenant literal). */
const STORAGE_KEY = 'statdash-theme'
const ATTR        = 'data-theme'

/** The OS colour-scheme preference, as an explicit theme id. */
function systemPreference(): string {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Persisted choice, or null when unset / storage is unavailable. */
function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Project a theme id onto the document root. 'system' ⇒ unset ⇒ @media wins. */
function applyTheme(theme: string): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute(ATTR)
  else root.setAttribute(ATTR, theme)
}

/**
 * Current theme + a persisting setter.
 * Initial value: the stored choice if present, else the OS preference — so a
 * first visit honours `prefers-color-scheme` (charge F1) without a stored value.
 */
export function useTheme(): readonly [string, (next: string) => void] {
  const [theme, setThemeState] = useState<string>(() => readStored() ?? systemPreference())

  // Single source of truth for the DOM side effect: whenever `theme` changes
  // (incl. the initial mount) the root attribute is re-projected. Zero colour
  // logic here — the token layer owns every colour value.
  useEffect(() => { applyTheme(theme) }, [theme])

  const setTheme = useCallback((next: string) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage denied (private mode / SSR) — state still updates in-memory */
    }
    setThemeState(next)
  }, [])

  return [theme, setTheme] as const
}
