import type { ReactNode } from 'react'
import { useTheme }        from './useTheme'
import './theme-switcher.css'

// ── ThemeSwitcherShell — the theme analogue of LocaleSwitcherShell ────────────
//
//  Same shape as the locale switcher: a zero-prop registered chrome slot
//  (`export { ThemeSwitcherShell as Shell }`) that maps an ORDERED option axis to
//  a BEM button group, marking the active one and switching on click. The only
//  substantive difference is the source of state — locale reads the URL
//  (useLocale), theme reads the persist hook (useTheme) — and the ARIA role:
//  choosing a theme is NOT navigation, so this is a labelled `group` of toggle
//  buttons (aria-pressed) rather than role="navigation" + aria-current.
//
//  The option list is a built-in, tenant-agnostic constant (light/dark are
//  universal theme ids, not tenant identity — Law 1/4 clean). OCP: a new option
//  (e.g. 'system') is one entry here + one icon; useTheme.applyTheme already
//  handles the 'system' → unset-attribute case. No colour is authored in this
//  shell — it rides the e74414d token layer via [data-theme].
//
//  a11y: icon-only controls carry a neutral-English sr-only label (the same
//  agnostic baseline the KPI trend labels use); aria-pressed exposes the active
//  choice to assistive tech (WCAG 2.1 AA).

interface ThemeOption {
  /** data-theme value written to the root ('light' | 'dark' | future 'system'). */
  id:    string
  /** Neutral-English accessible label (sr-only + aria) — agnostic baseline. */
  label: string
  /** Inline SVG path (24×24 viewBox), mirroring the app-header icon convention. */
  icon:  string
}

// Ordered option axis. Extend (OCP) by adding an entry — e.g.
// { id: 'system', label: 'Match system theme', icon: '<monitor path>' }.
const THEMES: readonly ThemeOption[] = [
  {
    id:    'light',
    label: 'Light theme',
    icon:  'M12 3v2m0 14v2m9-9h-2M5 12H3m14.66 6.66l-1.42-1.42M6.76 6.76L5.34 5.34m12.32 0l-1.42 1.42M6.76 17.24l-1.42 1.42M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    id:    'dark',
    label: 'Dark theme',
    icon:  'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  },
]

export function ThemeSwitcherShell(): ReactNode {
  const [theme, setTheme] = useTheme()

  if (THEMES.length <= 1) return null

  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {THEMES.map(opt => {
        const active = opt.id === theme
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            aria-pressed={active}
            className={`theme-switcher__btn${active ? ' theme-switcher__btn--active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="theme-switcher__icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={opt.icon} />
            </svg>
            <span className="sr-only">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
