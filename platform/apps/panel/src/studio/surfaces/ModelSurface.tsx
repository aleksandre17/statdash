import { lazy, Suspense } from 'react'
import { Box, Typography } from '@mui/material'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import type { Locale } from '../../types/constructor'

// The raw source/spec/query modeling body — the SAME shared component (extracted,
// not forked, in M1.3). Lazy so the editor suite (DataSpec editors + dnd-kit +
// source authoring) loads only when a Steward opens Model mode; it never weighs
// down the eager StudioShell chunk or any author-lens surface.
const DataModelingPanel = lazy(() =>
  import('../../features/data-layer').then((m) => ({ default: m.DataModelingPanel })),
)

// ── ModelSurface — the Steward's "define" workspace (AR-49 M2.1) ────────────────
//
//  The relocation the M1 Data surface reserved (spec §3.2, §7). In M2.0 this slot
//  was a placeholder; M2.1 makes Model mode REAL by re-homing the raw
//  source/spec/query/pivot modeler here — the Steward's escape hatch, over the SAME
//  always-mounted live canvas (never a route). Strangler relocation, not a rewrite:
//  the SAME DataModelingPanel the author's Data surface used to mount under its
//  "Advanced" disclosure now lives ONLY behind the Steward lens (FF-AUTHOR-NO-QUERY).
//  Nothing is lost — the machinery MOVED audience; an author who needs to model
//  flips the Model-mode lens (M2.0) and lands here. The in-tool Metric Editor
//  (define the governed catalog itself) is M2.2 — this milestone relocates the
//  raw modeler only (SPEC-authoring-reconception-M2 §9, sub-milestone M2.1).
export function ModelSurface({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Steward context — synchronous, so the surface reads its purpose before the
          heavy modeler chunk resolves (progressive disclosure, Law 9). */}
      <Typography variant="caption" color="text.secondary">
        {en
          ? 'Define the governed data model — sources, specs and queries behind the metrics authors compose with.'
          : 'აქ განისაზღვრება მართული მონაცემთა მოდელი — წყაროები, სპეც-ები და მოთხოვნები იმ მეტრიკების უკან, რომლებითაც ავტორები აწყობენ.'}
      </Typography>

      {/* The relocated raw modeler — the Steward's escape hatch (spec §3.2). */}
      <Suspense fallback={<SuspenseFallback label="Loading data editors" fill={false} />}>
        <DataModelingPanel />
      </Suspense>
    </Box>
  )
}
