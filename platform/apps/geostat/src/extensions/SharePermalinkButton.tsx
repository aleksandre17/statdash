import { useT } from '@statdash/react'

/**
 * SharePermalinkButton — copies a section-anchored URL to the clipboard.
 * Rendered via the SECTION_HEADER_ACTIONS extension point.
 * Law 9: URL = permalink (ONS/Eurostat standard).
 */
export function SharePermalinkButton({ sectionId }: { sectionId?: string }) {
  const t = useT('feedback')
  const href = sectionId
    ? `${window.location.pathname}${window.location.search}#${sectionId}`
    : window.location.href

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    navigator.clipboard?.writeText(href)
  }

  return (
    <a
      href={href}
      className="section__icon-btn"
      title={t('share.permalink')}
      aria-label={t('share.permalink')}
      onClick={handleClick}
    >
      {/* Link/chain inline SVG — no external dependency needed */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    </a>
  )
}
