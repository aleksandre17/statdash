import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import type { StudioSurface } from '../types/constructor'

// ── The four-moment mode rail (BLUEPRINT-panel-canonical-relay Step 1) ──────────
//
//  ONE ordered mode list the non-programmer reads as the four moments they follow:
//  DATA → COMPOSE (Add · Layers) → REFINE (the Inspector) → PUBLISH (the top-right
//  terminal). Every capability has exactly ONE home (LAW C / FF-ONE-HOME-PER-
//  CAPABILITY): the rail is the sole switcher for Data · Add · Layers · Site · Style,
//  and the scattered top-bar doors (the Compose⇄Data-model switch, the "Site & chrome"
//  button, the "Brand & theme" icon) are RETIRED — unified here. This is a data table,
//  not a switch: the rail renders from it and StudioShell dispatches from it (OCP).
//
//  DATA is FIRST — the front door (Looker/Studio "data source first", Webflow left-rail
//  CMS-mode). It re-homes the entry to the rail; the destination itself stays the
//  settled full-screen Focus-View (owner §3.4 / FF-MODEL-IS-FOCUSVIEW) — clicking Data
//  routes to `/studio/model`, no top-bar screen-swap. Add · Layers · Site · Style render
//  their existing bodies in the left dock.

export interface RailEntry {
  id:     StudioSurface
  /** Bilingual rail label / tooltip (Law 9 — no bare hardcoded UI string leaks). */
  label:  { ka: string; en: string }
  icon:   ComponentType<SvgIconProps>
}

//  DATA HOME split (0091 · owner 2026-07-18): the floors are SEPARATE top-level
//  destinations. «წყაროები» (Sources — raw cubes + classifiers + the ONE upload door)
//  leads FIRST («ჯერ მონაცემი»); «მოდელი» (the governed semantic model) follows. Both
//  are full-screen Focus-Views; the ladder survives as this NAV ORDER + cross-gestures.
export const RAIL_ENTRIES: readonly RailEntry[] = [
  { id: 'sources',    label: { ka: 'წყაროები',   en: 'Sources' }, icon: StorageOutlinedIcon },
  { id: 'model',      label: { ka: 'მოდელი',     en: 'Model' },  icon: SchemaOutlinedIcon },
  { id: 'insert',     label: { ka: 'დამატება',   en: 'Add' },    icon: AddBoxOutlinedIcon },
  { id: 'layers',     label: { ka: 'შრეები',     en: 'Layers' }, icon: LayersOutlinedIcon },
  { id: 'pages-site', label: { ka: 'საიტი',      en: 'Site' },   icon: WebOutlinedIcon },
  { id: 'style',      label: { ka: 'სტილი',      en: 'Style' },  icon: PaletteOutlinedIcon },
] as const

// ── Left-dock headings (bilingual) — the aside title + landmark name ────────────
//  Covers every surface the left dock can render (Add · Layers · Site · Style). `model`
//  (Data) re-homes onto the full-screen FocusView — its title comes from the focus-view
//  registry, so the dock heading below is never shown for it (a type-completeness
//  placeholder). Kept explicit (not derived from RAIL_ENTRIES) so each dock surface has
//  a visible heading + a named complementary landmark (WCAG 2.1 AA).
export const SURFACE_HEADINGS: Record<StudioSurface, { ka: string; en: string }> = {
  'sources':    { ka: 'წყაროები',         en: 'Sources' },
  'insert':     { ka: 'დამატება',        en: 'Add' },
  'layers':     { ka: 'შრეები',          en: 'Layers' },
  'style':      { ka: 'სტილი',            en: 'Style' },
  'pages-site': { ka: 'საიტი',            en: 'Site' },
  'model':      { ka: 'მონაცემთა მოდელი', en: 'Data model' },
}
