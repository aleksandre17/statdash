import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined'
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import type { StudioSurface } from '../types/constructor'

// ── Activity-rail registry (AR-49 M1.2 · AR-50 M5b data-model first-class) ─────
//
//  The five compose surfaces + the Data-model destination. This is a data table, not
//  a switch: the rail renders from it and StudioShell dispatches the left-dock content
//  from it, so adding a surface is one row + one case (OCP).
//
//  ── No visibility gate — the data model is reachable by EVERYONE (AR-50 M5b) ───
//  The Data-model entry is ALWAYS visible (the G6 "built ≠ buried" fix): the whole
//  data-model capability used to be gated behind the Steward lens and was unreachable
//  from a default author session. Role now splits the destination's CONTENT (author →
//  read-only Data Dictionary, steward → the full modeler — DataModelBody), NOT its
//  visibility. So the rail is a flat, always-visible list; the role lens never hides a
//  destination (FF-ROLE-IS-LENS / FF-DATA-REACHABLE).

export interface RailEntry {
  id:     StudioSurface
  /** Bilingual rail label / tooltip (Law 9 — no bare hardcoded UI string leaks). */
  label:  { ka: string; en: string }
  icon:   ComponentType<SvgIconProps>
}

export const RAIL_ENTRIES: readonly RailEntry[] = [
  { id: 'insert',     label: { ka: 'ჩასმა',        en: 'Insert' },       icon: AddBoxOutlinedIcon },
  { id: 'data',       label: { ka: 'მონაცემები',   en: 'Data' },         icon: DatasetOutlinedIcon },
  { id: 'layers',     label: { ka: 'შრეები',       en: 'Layers' },       icon: LayersOutlinedIcon },
  { id: 'pages-site', label: { ka: 'გვერდები/საიტი', en: 'Pages & Site' }, icon: WebOutlinedIcon },
  { id: 'style',      label: { ka: 'სტილი',        en: 'Style' },        icon: PaletteOutlinedIcon },
  { id: 'model',      label: { ka: 'მონაცემთა მოდელი', en: 'Data model' }, icon: HubOutlinedIcon },
] as const

/** The heading shown atop each left-dock surface (bilingual). */
export const SURFACE_HEADINGS: Record<StudioSurface, { ka: string; en: string }> =
  Object.fromEntries(RAIL_ENTRIES.map((e) => [e.id, e.label])) as Record<StudioSurface, { ka: string; en: string }>
