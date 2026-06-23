// ── Micro markdown → HTML renderer ────────────────────────────────────
//
//  No external library is available (no `marked` / `remark` in workspace).
//  Covers common cases needed for dashboard annotations and methodology notes.
//  Extracted so tests can exercise the renderer without React rendering.
//
export function renderMarkdown(raw: string): string {
  const lines   = raw.split('\n')
  const output: string[] = []
  let   inList  = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headings — # / ## / ###
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      if (inList) { output.push('</ul>'); inList = false }
      const level = heading[1].length
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    // Unordered list items
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { output.push('<ul>'); inList = true }
      output.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    // Close list before non-list content
    if (inList) { output.push('</ul>'); inList = false }

    // Blank line → paragraph break
    if (line.trim() === '') {
      output.push('')
      continue
    }

    // Paragraph
    output.push(`<p>${inlineMarkdown(line)}</p>`)
  }

  if (inList) output.push('</ul>')
  return output.join('\n')
}

/**
 * Inline markdown: **bold**, *italic*, `code`, [text](url).
 * Applied per-line after block-level parsing.
 */
export function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
}

// ── HTML sanitiser ─────────────────────────────────────────────────────

const SAFE_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'code', 'pre',
  'a', 'blockquote', 'hr',
])

export function sanitise(html: string): string {
  let safe = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')

  safe = safe.replace(/<\/?([a-z][a-z0-9]*)[^>]*>/gi, (match, tag: string) => {
    const lower = tag.toLowerCase()
    if (!SAFE_TAGS.has(lower)) return ''
    if (lower === 'a') {
      return match.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '')
    }
    return match
  })

  return safe
}
