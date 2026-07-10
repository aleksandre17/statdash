// ── paletteIcons — registry icon-token → glyph (AR-49 M4 Wave 1) ───────────────
//
//  A REGISTERED map (token → MUI icon), mirroring plugins/…/navIcons.tsx: the
//  palette looks a tile's glyph up by the slice's declared `icon` TOKEN
//  (NodeSliceMeta.icon, e.g. 'bar-chart', 'table', 'sliders') rather than
//  branching on node type. A new icon = one row here + one `icon:` token on the
//  slice meta → ZERO palette code (OCP). `resolvePaletteIcon` is the single read
//  seam; `renderPaletteIcon` produces the element (via createElement, not JSX, so
//  this stays a plain `.ts` helper module — no fast-refresh component-export coupling
//  and no "component created during render" lint on the caller). An absent/unknown
//  token falls back to a neutral glyph so a tile never renders empty or throws.
//
//  NOTE (flagged): several node/panel metas declare NO `icon` token today
//  (geograph, links, page-header, repeat) — those tiles get the neutral fallback.
//  Giving them a real glyph is a one-line `icon:` addition on each slice meta
//  (packages/plugins) — a data change, not palette code. Kept registry-derived on
//  purpose: mapping by TYPE here would re-introduce the hardcode this map removes.
//
import { createElement } from 'react'
import type { ComponentType, ReactElement } from 'react'
import type { SvgIconProps } from '@mui/material'
import BarChartOutlinedIcon        from '@mui/icons-material/BarChartOutlined'
import StackedBarChartOutlinedIcon from '@mui/icons-material/StackedBarChartOutlined'
import SpeedOutlinedIcon           from '@mui/icons-material/SpeedOutlined'
import ViewCarouselOutlinedIcon    from '@mui/icons-material/ViewCarouselOutlined'
import ViewStreamOutlinedIcon      from '@mui/icons-material/ViewStreamOutlined'
import TableChartOutlinedIcon      from '@mui/icons-material/TableChartOutlined'
import TabOutlinedIcon             from '@mui/icons-material/TabOutlined'
import NotesOutlinedIcon           from '@mui/icons-material/NotesOutlined'
import TrendingUpOutlinedIcon      from '@mui/icons-material/TrendingUpOutlined'
import TuneOutlinedIcon            from '@mui/icons-material/TuneOutlined'
import CreditCardOutlinedIcon      from '@mui/icons-material/CreditCardOutlined'
import ViewColumnOutlinedIcon      from '@mui/icons-material/ViewColumnOutlined'
import RemoveOutlinedIcon          from '@mui/icons-material/RemoveOutlined'
import GridViewOutlinedIcon        from '@mui/icons-material/GridViewOutlined'
import HeightOutlinedIcon          from '@mui/icons-material/HeightOutlined'
import ViewAgendaOutlinedIcon      from '@mui/icons-material/ViewAgendaOutlined'
import LayersOutlinedIcon          from '@mui/icons-material/LayersOutlined'
import WidgetsOutlinedIcon         from '@mui/icons-material/WidgetsOutlined'

type IconComponent = ComponentType<SvgIconProps>

/** icon TOKEN (NodeSliceMeta.icon) → glyph component. Extend by adding a row. */
const PALETTE_ICONS: Record<string, IconComponent> = {
  'bar-chart':      BarChartOutlinedIcon,
  'bar-chart-2':    StackedBarChartOutlinedIcon,
  'gauge':          SpeedOutlinedIcon,
  'layout-hero':    ViewCarouselOutlinedIcon,
  'layout-section': ViewStreamOutlinedIcon,
  'table':          TableChartOutlinedIcon,
  'tabs':           TabOutlinedIcon,
  'text':           NotesOutlinedIcon,
  'trending-up':    TrendingUpOutlinedIcon,
  'sliders':        TuneOutlinedIcon,
  'layout-card':    CreditCardOutlinedIcon,
  'layout-columns': ViewColumnOutlinedIcon,
  'minus':          RemoveOutlinedIcon,
  'layout-grid':    GridViewOutlinedIcon,
  'move-vertical':  HeightOutlinedIcon,
  'layout-stack':   ViewAgendaOutlinedIcon,
  'layers':         LayersOutlinedIcon,
}

/** The neutral glyph for an absent/unknown icon token. */
export const FALLBACK_PALETTE_ICON: IconComponent = WidgetsOutlinedIcon

/**
 * Resolve a registry icon token to its glyph COMPONENT. Absent/unknown tokens fall
 * back to a neutral glyph — a tile never renders an empty slot (graceful degrade).
 */
export function resolvePaletteIcon(token: string | undefined): IconComponent {
  return (token && PALETTE_ICONS[token]) || FALLBACK_PALETTE_ICON
}

/** Render a token's glyph as an element (createElement — no JSX in this helper). */
export function renderPaletteIcon(token: string | undefined, props?: SvgIconProps): ReactElement {
  return createElement(resolvePaletteIcon(token), props)
}
