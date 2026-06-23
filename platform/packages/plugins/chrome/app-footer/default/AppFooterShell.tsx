import { useChromeConfig, useResolveLocale, useSlotConfig } from '@statdash/react'
import type { AppFooterConfig }              from './meta'
import './app-footer.css'

export function AppFooterShell() {
  const config = useChromeConfig()
  const slot   = useSlotConfig<AppFooterConfig>()
  const t      = useResolveLocale()

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__content">
          {config.copyright && (
            <p className="app-footer__copyright">
              © {new Date().getFullYear()} {t(config.copyright)}
            </p>
          )}
          {slot.footerLinks && slot.footerLinks.length > 0 && (
            <div className="app-footer__links">
              {slot.footerLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-footer__link"
                >
                  {t(link.label)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}