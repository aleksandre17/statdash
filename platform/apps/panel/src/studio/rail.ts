import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined'
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import type { StudioSurface } from '../types/constructor'

// ── Activity-rail registry (AR-49 M1.2) ───────────────────────────────────────
//
//  The five author surfaces + the LOCKED Model slot (M2 Steward role). This is a
//  data table, not a switch: the rail renders from it and StudioShell dispatches
//  the left-dock content from it, so adding a surface is one row + one case (OCP).
//  `locked` surfaces render a disabled affordance and can never become active —
//  the anti-cliff seam the vision reserves for the Steward role.

export interface RailEntry {
  id:     StudioSurface
  /** Bilingual rail label / tooltip (Law 9 — no bare hardcoded UI string leaks). */
  label:  { ka: string; en: string }
  icon:   ComponentType<SvgIconProps>
  /** M2-gated (Model) — rendered but not selectable in M1. */
  locked?: boolean
}

export const RAIL_ENTRIES: readonly RailEntry[] = [
  { id: 'insert',     label: { ka: 'ჩასმა',        en: 'Insert' },       icon: AddBoxOutlinedIcon },
  { id: 'data',       label: { ka: 'მონაცემები',   en: 'Data' },         icon: DatasetOutlinedIcon },
  { id: 'layers',     label: { ka: 'შრეები',       en: 'Layers' },       icon: LayersOutlinedIcon },
  { id: 'pages-site', label: { ka: 'გვერდები/საიტი', en: 'Pages & Site' }, icon: WebOutlinedIcon },
  { id: 'style',      label: { ka: 'სტილი',        en: 'Style' },        icon: PaletteOutlinedIcon },
  { id: 'model',      label: { ka: 'მოდელი',       en: 'Model' },        icon: HubOutlinedIcon, locked: true },
] as const

/** The heading shown atop each left-dock surface (bilingual). */
export const SURFACE_HEADINGS: Record<StudioSurface, { ka: string; en: string }> =
  Object.fromEntries(RAIL_ENTRIES.map((e) => [e.id, e.label])) as Record<StudioSurface, { ka: string; en: string }>
