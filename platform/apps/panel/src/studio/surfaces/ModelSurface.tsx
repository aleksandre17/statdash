import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Divider } from '@mui/material'
import { MetricCatalogManager } from '../model/MetricCatalogManager'
import { DataFlowMap } from '../model/DataFlowMap'
import { useActiveLocales } from '../../inspector/useActiveLocales'
import type { Locale } from '../../types/constructor'

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
//
//  M2.2 (2026-07-09) fills Model mode's HEADLINE region: in-tool metric AUTHORING
//  (MetricCatalogManager). Region order is top-to-bottom by frequency (spec §3.2,
//  progressive disclosure): (1) the Data-Flow map — the orientation; (2) the governed
//  metric catalog + editor — the "define" half. Dimension authoring (spec §4.5 / M2.4)
//  is DEFERRED — dimensions still reach authors as raw cube members; the semanticCatalog
//  store preserves any existing dimensions through save (a clear seam, no capability lost).
//
//  ── DU6-IA-1 — the raw modeler has gone to its own floors ─────────────────────
//  The `DataModelingPanel` escape hatch that used to sit below the catalog is RETIRED:
//  its spec half moved to the Specs floor (`SpecsBody` — the spec list + workbench),
//  its raw-source CRUD to the Sources floor (steward-gated). The Model floor keeps
//  exactly its governed objects — the flow map + the metric catalog — no crammed raw
//  modeler underneath (the owner's «რა ზევით რა ქვევით», answered structurally).
//  IA-2 re-lays this surface as master-detail; this wave only removes the squatter.
export function ModelSurface({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const locales = useActiveLocales()

  // The Data-Flow map is the Model stage's HOME (AR-49 M4.3 · Move 3): the pipeline —
  // source → dataset/spec → metric → used-by — made VISIBLE and prominent, projected
  // live from the registries (no stored graph). Clicking a metric node is never a dead
  // end: it opens that metric's editor in the catalog manager below (the map is the
  // orientation; the existing editors are its detail). The tokened request lets a
  // repeat click on the SAME metric re-open it (a monotonic counter, not identity).
  const [openRequest, setOpenRequest] = useState<{ id: string; token: number } | null>(null)
  const openMetric = (id: string) => setOpenRequest((prev) => ({ id, token: (prev?.token ?? 0) + 1 }))

  // Focus lands in the opened surface (WCAG 2.1 AA · 2.4.3 focus order): ModelSurface
  // mounts ONLY when the user opens the Data-model workspace (the top-bar switch or
  // the ⌘K command), so moving focus to this region on mount announces the workspace
  // to AT and puts keyboard focus where the work is — the intentful-action landing
  // the split two-click flow never provided. tabIndex=-1 → programmatically focusable
  // without adding a stray Tab stop.
  const regionRef = useRef<HTMLDivElement>(null)
  useEffect(() => { regionRef.current?.focus() }, [])

  return (
    <Box
      ref={regionRef}
      tabIndex={-1}
      role="group"
      aria-label={en ? 'Data model workspace' : 'მონაცემთა მოდელის სამუშაო სივრცე'}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, outline: 'none' }}
    >
      {/* Steward context — synchronous, so the surface reads its purpose before the
          heavy modeler chunk resolves (progressive disclosure, Law 9). */}
      <Typography variant="caption" color="text.secondary">
        {en
          ? 'Define the governed data model — metrics authors compose with, plus the sources, specs and queries behind them.'
          : 'აქ განისაზღვრება მართული მონაცემთა მოდელი — მეტრიკები, რომლებითაც ავტორები აწყობენ, და მათ უკან არსებული წყაროები, სპეც-ები და მოთხოვნები.'}
      </Typography>

      {/* Region 0 — the HOME: the Data-Flow map (Move 3). The pipeline made visible —
          source → dataset/spec → metric → used-by — the orientation for everything
          below. Interactive: a metric node opens its editor (Region 1) in place. */}
      <DataFlowMap locale={locale} onOpenMetric={openMetric} />

      <Divider flexItem />

      {/* Region 1 — the headline: define/edit the governed metric catalog (M2.2). */}
      <MetricCatalogManager locale={locale} locales={locales} openRequest={openRequest} />
    </Box>
  )
}
