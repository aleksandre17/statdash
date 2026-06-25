// ── SuspenseFallback — accessible loading state for lazy boundaries ───────────
//
//  Code-split surfaces (the wizard steps, the live canvas, the command palette)
//  load on demand. While their chunk is in flight, React renders the nearest
//  <Suspense fallback>. A blank fallback is a WCAG failure (no programmatic
//  announcement, no perceivable status), so every lazy boundary in the panel
//  uses this labelled, ARIA-live status region instead.
//
//  role="status" + aria-live="polite" announces the loading state to assistive
//  tech without stealing focus; the aria-label gives the spinner an accessible
//  name (WCAG 2.1 AA — 4.1.2 Name/Role/Value, 1.3.1 Info & Relationships).
//
import { Box, CircularProgress } from '@mui/material'

export interface SuspenseFallbackProps {
  /** Accessible label announced while the chunk loads (i18n catalog string). */
  label: string
  /** Fill the parent (canvas/step area) vs. a compact inline spinner. */
  fill?: boolean
}

export function SuspenseFallback({ label, fill = true }: SuspenseFallbackProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: fill ? 240 : 0,
        height: fill ? '100%' : 'auto',
        p: 2,
      }}
    >
      <CircularProgress aria-label={label} />
    </Box>
  )
}
