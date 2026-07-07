import { Link }                                              from 'react-router-dom'
import { useSiteNav, useLocale, useChromeConfig, useResolveLocale, useSlotConfig, useT } from '@statdash/react'
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
  const tc     = useT('AppHeader')   // fixed chrome strings (aria) for the active locale

  // ── Fail-soft brand guard (ADR-0028) ──────────────────────────────────────
  //  The runner boots to emptyManifest() when /api/bootstrap is unreachable; its
  //  chromeConfig is then `{}` — no logo, no logoAlt. The header MUST degrade to
  //  minimal, tenant-neutral chrome rather than dereference the absent logo
  //  LocaleString: `t(config.logoAlt)` on `undefined` threw
  //  "Cannot read properties of undefined (reading 'en')" and, with no error
  //  boundary, unmounted the whole tree to a blank page. Render the brand link
  //  ONLY when both the logo asset AND its alt text are present; absent ⇒ a
  //  brand-free header (the nav + actions still render). No brand/locale literal
  //  lives in this shared shell (Law 4) — the neutral state is the empty brand slot.
  const hasBrand = Boolean(config.logoUrl && config.logoAlt)

  // ── Primary top-nav gate ───────────────────────────────────────────────
  //  Render the nav ONLY when the tenant opts in (default) AND the shared site
  //  nav is non-empty. `showNav === false` suppresses the header's duplicate of
  //  the useSiteNav() SSOT (still surfaced by the inner sidebar + hero cards)
  //  WITHOUT emptying that SSOT. The <nav> element is omitted entirely — with
  //  `space-between`, brand → left / actions → right, leaving no empty flex gap.
  const showNav = slot.showNav !== false && nav.length > 0

  return (
    <header className={HEADER.block} {...(surface !== 'opaque' && { [HEADER.surfaceAttr]: surface })}>
      <div className={HEADER.inner}>
        {hasBrand && (
          <Link to={`/${locale}`} className={HEADER.brand} aria-label={t(config.logoAlt)}>
            <img src={t(config.logoUrl)} alt={t(config.logoAlt)} className={HEADER.logo} />
          </Link>
        )}

        {showNav && (
          <nav className={HEADER.nav} aria-label={tc('nav-label')}>
            {nav.map(item => (
              <Link
                key={item.path}
                to={`/${locale}${item.path}`}
                className={HEADER.navLink}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
        )}

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
          <ChromeSlot slot="ThemeSwitcher" />
        </div>
      </div>
    </header>
  )
}