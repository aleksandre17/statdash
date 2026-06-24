import { Link }                                              from 'react-router-dom'
import { useSiteNav, useLocale, useChromeConfig, useResolveLocale, useSlotConfig } from '@statdash/react'
import { ChromeSlot }                                        from '@statdash/react/engine'
import type { AppHeaderConfig }                              from './meta'
import { HEADER, type HeaderSurface }                        from './styleKeys'
import './app-header.css'

// ── AppHeaderShell — full site header ─────────────────────────────────
//
//  `surface` is the header's appearance VARIANT, projected to a `data-surface`
//  attribute the CSS reads (`.app-header[data-surface="transparent"]`) — NOT a
//  modifier class or a wrapper-div scope. It defaults to 'opaque' so the
//  zero-prop registered shell (`export { AppHeaderShell as Shell }`) keeps the
//  chrome ISP contract; the transparent variant shell composes
//  `<AppHeaderShell surface="transparent" />`. A new appearance = one HeaderSurface
//  value + one CSS rule → zero shell code.
export function AppHeaderShell({ surface = 'opaque' }: { surface?: HeaderSurface } = {}) {
  const nav    = useSiteNav()
  const locale = useLocale()
  const config = useChromeConfig()
  const slot   = useSlotConfig<AppHeaderConfig>()
  const t      = useResolveLocale()

  return (
    <header className={HEADER.block} {...(surface !== 'opaque' && { [HEADER.surfaceAttr]: surface })}>
      <div className={HEADER.inner}>
        <Link to={`/${locale}`} className={HEADER.brand} aria-label={t(config.logoAlt)}>
          <img src={config.logoUrl} alt={t(config.logoAlt)} className={HEADER.logo} />
        </Link>

        <nav className={HEADER.nav} aria-label="Main navigation">
          {nav.map(item => (
            <Link
              key={item.path}
              to={`/${locale}${item.path}`}
              className={HEADER.navLink}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={HEADER.actions}>
          {slot.socialLinks && slot.socialLinks.length > 0 && (
            <div className={HEADER.social}>
              {slot.socialLinks.map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className={HEADER.socialLink}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={HEADER.socialIcon}
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