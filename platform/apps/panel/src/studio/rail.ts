import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined'
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import type { StudioSurface } from '../types/constructor'
import type { Role } from './useRole'

// ── Activity-rail registry (AR-49 M1.2 · M2.0 role lens) ──────────────────────
//
//  The five author surfaces + the role-gated Model slot (Steward lens). This is a
//  data table, not a switch: the rail renders from it and StudioShell dispatches
//  the left-dock content from it, so adding a surface is one row + one case (OCP).
//  A `stewardOnly` entry is projected out of the rail in the `author` lens and in
//  only when `useRole() === 'steward'` — the role-as-lens visibility rule lives as
//  one predicate over the table (`visibleRailEntries`), never a branch per consumer.

export interface RailEntry {
  id:     StudioSurface
  /** Bilingual rail label / tooltip (Law 9 — no bare hardcoded UI string leaks). */
  label:  { ka: string; en: string }
  icon:   ComponentType<SvgIconProps>
  /** Role-gated — visible ONLY in the Steward lens (AR-49 M2.0). */
  stewardOnly?: boolean
}

export const RAIL_ENTRIES: readonly RailEntry[] = [
  { id: 'insert',     label: { ka: 'ჩასმა',        en: 'Insert' },       icon: AddBoxOutlinedIcon },
  { id: 'data',       label: { ka: 'მონაცემები',   en: 'Data' },         icon: DatasetOutlinedIcon },
  { id: 'layers',     label: { ka: 'შრეები',       en: 'Layers' },       icon: LayersOutlinedIcon },
  { id: 'pages-site', label: { ka: 'გვერდები/საიტი', en: 'Pages & Site' }, icon: WebOutlinedIcon },
  { id: 'style',      label: { ka: 'სტილი',        en: 'Style' },        icon: PaletteOutlinedIcon },
  { id: 'model',      label: { ka: 'მოდელი',       en: 'Model' },        icon: HubOutlinedIcon, stewardOnly: true },
] as const

/**
 * The rail entries visible under the current role LENS. `author` sees the five
 * compose surfaces; `steward` additionally sees Model. A predicate over the data
 * table (OCP) — a future role-gated surface is one more `stewardOnly` row, no
 * switch and no consumer change (the rail gates on the lens value, never on an
 * auth/tenant/user primitive — FF-ROLE-IS-LENS).
 */
export function visibleRailEntries(role: Role): readonly RailEntry[] {
  return RAIL_ENTRIES.filter((e) => !e.stewardOnly || role === 'steward')
}

/** The heading shown atop each left-dock surface (bilingual). */
export const SURFACE_HEADINGS: Record<StudioSurface, { ka: string; en: string }> =
  Object.fromEntries(RAIL_ENTRIES.map((e) => [e.id, e.label])) as Record<StudioSurface, { ka: string; en: string }>
