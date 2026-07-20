import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { CanonicalUpload } from '../model/CanonicalUpload'
import { CubeInventory } from './CubeInventory'
import { useSetRole } from '../useRole'
import { studioDataWorkbenchPath } from '../useStudioRoute'
import { useDataSources } from '../../store/constructor.store'
import { storeKeyForDataset } from '../../discovery/cubeProfile.store'
import type { Locale } from '../../types/constructor'

// ── SourcesBody — «წყაროები», the INDEPENDENT Data Home, FIRST in the nav (0091) ─
//
//  Owner (2026-07-18): the floors are SEPARATE TOP-LEVEL DESTINATIONS (Superset Data |
//  Power BI Data hub apart from the model). «წყაროები» leads because «თუ არ გაქვს
//  მონაცემი, რას აკეთებ სხვას» — sources are the spine's origin (Law 11 C1). This is the
//  first-time steward's «რა მაქვს» answered at a glance: the raw cubes I have, their
//  vocabularies, and the ONE door to onboard more.
//
//  Screen-level SRP — one page, one responsibility — IS the decoupling the owner
//  demanded. Two self-contained sections, each from its own SSOT:
//    · the ONE upload door (CanonicalUpload — the sole mount in the whole studio; every
//      duplicate died with this re-home);
//    · the cube inventory + browsable classifiers (CubeInventory → cubeApi/cubeProfile).
//  «ჯერ შეიმეცნოს, მერე მანიპულირება»: comprehension precedes manipulation — SEE the
//  data and its vocabulary here; the Model page governs it; the workbench shapes it.
//
//  ── In-workspace cube browse (ADR-051 DU2 — the courier is dead) ───────────────
//  A cube's «დაათვალიერე workbench-ში» is an IN-WORKSPACE selection now, not a cross-
//  screen handoff: switch to the Model floor of THIS same Data workspace (`?dataFloor=
//  model`) with the picked cube RIDING THE URL (`studioDataWorkbenchPath`), and the
//  workbench seeds its `source` step from that seed on arrival (DataModelingPanel). No
//  one-shot store, no `setSurface` teleport — the destination stays `/studio/data`, only
//  the floor query changes (the exact DU1 floor-switch mechanism). The steward LENS is
//  still selected: shaping a raw cube IS a steward activity (FF-AUTHOR-NO-QUERY — the
//  author never picks a raw cube), so landing in the steward shaping view is the correct,
//  least-astonishing outcome of an explicit "browse in workbench", not a courier side-effect.
//
//  WCAG (Law 9): a labelled region; focus lands here on mount (the destination the user
//  navigated INTO); bilingual chrome throughout, no hardcoded string leak.
export function SourcesBody({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const navigate = useNavigate()
  const setRole  = useSetRole()
  const sources  = useDataSources()

  const regionRef = useRef<HTMLDivElement>(null)
  useEffect(() => { regionRef.current?.focus() }, [])

  const onBrowseInWorkbench = (datasetCode: string, measures: string[]) => {
    // 0089 · ADR-046 Addendum 3: FREEZE the picked cube's store home into the seed, resolved
    // here (at the origin gesture) from the session sources — so the seeded steward head reads
    // the PICKED cube's OWN store, not the page's. Undefined when the cube is not a session
    // source (degrades: the head declares no home, falls through to the page store).
    const dataSource = storeKeyForDataset(sources, datasetCode)
    setRole('steward')  // shaping a raw cube is a steward activity (FF-AUTHOR-NO-QUERY)
    // In-workspace floor switch (same `/studio/data` surface) seeded with the cube — the
    // workbench reads the seed off the URL. No courier store, no cross-surface teleport.
    navigate(studioDataWorkbenchPath({ datasetCode, measures, dataSource }))
  }

  return (
    <Box
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={en ? 'Sources' : 'წყაროები'}
      data-testid="sources-body"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, outline: 'none', maxWidth: 920 }}
    >
      <Typography variant="body2" color="text.secondary">
        {en
          ? 'Everything starts with data. Onboard a source, then browse your cubes and their classifiers — see what you have before you shape it.'
          : 'ყველაფერი მონაცემით იწყება. ატვირთე წყარო, შემდეგ დაათვალიერე კუბები და მათი კლასიფიკატორები — ჯერ ნახე რა გაქვს, მერე შეასწორე.'}
      </Typography>

      {/* THE ONE upload door — the sole CanonicalUpload mount in the studio. */}
      <Box
        component="section"
        aria-label={en ? 'Onboard data' : 'მონაცემების ატვირთვა'}
        data-testid="sources-upload"
        sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}
      >
        <CanonicalUpload locale={locale} />
      </Box>

      <CubeInventory locale={locale} onBrowseInWorkbench={onBrowseInWorkbench} />
    </Box>
  )
}
