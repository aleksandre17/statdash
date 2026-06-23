import { Link }                                              from 'react-router-dom'
import { useSiteNav, useLocale, useChromeConfig, useResolveLocale } from '@statdash/react'
import { ChromeSlot }                                        from '@statdash/react/engine'
import './app-header.css'

export function AppHeaderShell() {
  const nav    = useSiteNav()
  const locale = useLocale()
  const config = useChromeConfig()
  const t      = useResolveLocale()

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to={`/${locale}`} className="app-header__brand" aria-label={t(config.logoAlt)}>
          <img src={config.logoUrl} alt={t(config.logoAlt)} className="app-header__logo" />
        </Link>

        <nav className="app-header__nav" aria-label="Main navigation">
          {nav.map(item => (
            <Link
              key={item.path}
              to={`/${locale}${item.path}`}
              className="app-header__nav-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="app-header__actions">
          {config.socialLinks && config.socialLinks.length > 0 && (
            <div className="app-header__social">
              {config.socialLinks.map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="app-header__social-link"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="app-header__social-icon"
                    fill={social.fill ? 'currentColor' : 'none'}
                    stroke={social.fill ? 'none' : 'currentColor'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={social.icon} />
                  </svg>
                </a>
              ))}
            </div>
          )}
          <ChromeSlot slot="LocaleSwitcher" />
        </div>
      </div>
    </header>
  )
}