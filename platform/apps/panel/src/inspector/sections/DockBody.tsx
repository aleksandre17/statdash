// ── DockBody — render the applicable dock sections through the ONE grammar ──────
//
//  Given a dock context, resolves the applicable sections from `dockSectionRegistry`
//  (filtered + ordered), renders each, and joins them with ONE uniform divider
//  grammar — the single composition rule that replaces RightDock's ad-hoc
//  `Divider`-stitched stacks. A section that renders null contributes nothing (and
//  no stray divider): the divider is placed only BETWEEN rendered sections.
//
import { Fragment } from 'react'
import { Box, Divider } from '@mui/material'
import { dockSectionRegistry, type DockRenderCtx } from './dockSection'

export function DockBody({ ctx }: { ctx: DockRenderCtx }) {
  const rendered = dockSectionRegistry
    .list(ctx)
    .map((s) => ({ id: s.id, node: s.render(ctx) }))
    .filter((r): r is { id: string; node: NonNullable<typeof r.node> } => r.node != null)

  return (
    <Box className="studio-dock__sections" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rendered.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && <Divider />}
          <div data-dock-section={r.id}>{r.node}</div>
        </Fragment>
      ))}
    </Box>
  )
}
