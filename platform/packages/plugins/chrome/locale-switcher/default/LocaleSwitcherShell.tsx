import type { ReactNode }                       from 'react'
import { useLocation, useNavigate }              from 'react-router-dom'
import { useLocale, useI18n, useChromeConfig, useT } from '@statdash/react'
import './locale-switcher.css'

export function LocaleSwitcherShell(): ReactNode {
  const locale   = useLocale()
  const i18n     = useI18n()
  const config   = useChromeConfig()
  const location = useLocation()
  const navigate = useNavigate()
  const t        = useT('LocaleSwitcher')

  if (i18n.locales.length <= 1) return null

  const switchLocale = (next: string) => {
    const parts = location.pathname.split('/')
    parts[1] = next
    navigate(parts.join('/') + location.search, { replace: true })
  }

  const label = (l: string) => config.localeLabels?.[l] ?? l.toUpperCase()

  return (
    <div className="locale-switcher" role="navigation" aria-label={t('nav-label')}>
      {i18n.locales.map(l => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          aria-current={l === locale ? 'true' : undefined}
          className={`locale-switcher__btn${l === locale ? ' locale-switcher__btn--active' : ''}`}
        >
          {label(l)}
        </button>
      ))}
    </div>
  )
}