import { useChromeConfig, useResolveLocale } from '@statdash/react'
import './app-footer.css'

export function AppFooterShell() {
  const config = useChromeConfig()
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
          {config.footerLinks && config.footerLinks.length > 0 && (
            <div className="app-footer__links">
              {config.footerLinks.map((link, i) => (
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