import { useState } from 'react'
import { useT } from '@statdash/react'
import './SharePermalinkButton.css'

/**
 * Copy `text` to the clipboard across BOTH context types.
 *
 * Root cause this addresses: `navigator.clipboard` is only defined in a SECURE
 * context (HTTPS or localhost). The LAN prod host is served over plain HTTP
 * (http://192.168.1.199:3002), a NON-secure context, where `navigator.clipboard`
 * is `undefined` — so the old `navigator.clipboard?.writeText()` optional-chain
 * silently no-oped and nothing was copied.
 *
 *   1. Secure context  → the async Clipboard API (preferred, permissioned).
 *   2. Non-secure/HTTP → the legacy `execCommand('copy')` over an off-screen
 *      <textarea> (works without a secure context; still supported for copy).
 *
 * Returns whether the copy succeeded, so the caller can surface feedback.
 * Exported for the fitness test (copy-fallback-on-no-clipboard).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied / transient failure — fall through to the legacy path.
    }
  }
  return legacyCopy(text)
}

/** Legacy off-screen-textarea + execCommand('copy') — the HTTP fallback. */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  // Off-screen but still selectable — never scrolls the page or shows a flash.
  ta.style.position = 'fixed'
  ta.style.top      = '-9999px'
  ta.style.opacity  = '0'
  document.body.appendChild(ta)
  try {
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(ta)
  }
}

const COPIED_FEEDBACK_MS = 2000

/**
 * SharePermalinkButton — copies a section-anchored permalink to the clipboard.
 * Rendered via the SECTION_HEADER_ACTIONS extension point.
 * Law 9: URL = permalink (ONS/Eurostat standard).
 *
 * On success it surfaces transient feedback: an `aria-live` "Copied" announcement
 * (screen readers) + a short visual state on the button (checkmark + positive
 * tone). Both labels come from the localized `feedback` catalog (ka + en) — no
 * raw/latin leak.
 */
export function SharePermalinkButton({ sectionId }: { sectionId?: string }) {
  const t = useT('feedback')
  const [copied, setCopied] = useState(false)

  // Absolute permalink — the clipboard needs a full URL, not a relative path.
  const relative = sectionId
    ? `${window.location.pathname}${window.location.search}#${sectionId}`
    : window.location.href
  const permalink = new URL(relative, window.location.origin).href

  const handleClick = async () => {
    const ok = await copyToClipboard(permalink)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  return (
    <button
      type="button"
      className={`section__icon-btn${copied ? ' is-copied' : ''}`}
      title={t('share.permalink')}
      aria-label={t('share.permalink')}
      onClick={handleClick}
    >
      {copied ? (
        // Success — checkmark (visual confirmation).
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        // Link/chain inline SVG — no external dependency needed.
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      )}
      {/* Polite live region — announces success to assistive tech without
          stealing focus. Always present so the announcement is registered. */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t('share.copied') : ''}
      </span>
    </button>
  )
}
