import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import type { StudioSurface } from '../types/constructor'

// ── Left Navigator registry (SPEC-studio-ia-canonical S5 — the canonical two panes) ─
//
//  The left Navigator is TWO panes only (Webflow's exact factoring): Add (the block
//  palette) and Layers (the outline tree) — the two "where things live" panes over
//  the always-mounted canvas. This is a data table, not a switch: the rail renders
//  from it and StudioShell dispatches the left-dock content from it (OCP).
//
//  ── S5: the six-peer rail collapsed ───────────────────────────────────────────
//  Insert+Layers ARE the navigator; the former peer surfaces are re-homed, never
//  removed (§3.1): Data (metric bind) → a contextual section of the right Inspector;
//  Theme (Style), Site (Pages & Site) and Data model → TOP-BAR-summoned project
//  workspaces (project-scope, not per-element navigation — so they leave this rail).
//  "Where things live" is now one rule: you author what you selected on the right,
//  find/add on the left, and open project settings from the top bar.

export interface RailEntry {
  id:     StudioSurface
  /** Bilingual rail label / tooltip (Law 9 — no bare hardcoded UI string leaks). */
  label:  { ka: string; en: string }
  icon:   ComponentType<SvgIconProps>
}

export const RAIL_ENTRIES: readonly RailEntry[] = [
  { id: 'insert', label: { ka: 'დამატება', en: 'Add' },    icon: AddBoxOutlinedIcon },
  { id: 'layers', label: { ka: 'შრეები',   en: 'Layers' }, icon: LayersOutlinedIcon },
] as const

// ── Left-dock headings (bilingual) — the aside title + landmark name ────────────
//  Covers EVERY surface the left dock can render: the two rail panes (Add · Layers)
//  PLUS the top-bar-summoned Theme (Style) + Site (Pages & Site) surfaces, which are
//  off the rail but still render in the dock (SPEC S5). `model` re-homes onto the
//  full-screen FocusView (its title comes from the focus-view registry), so its entry
//  is a harmless placeholder for type-completeness — the dock heading is never shown
//  for it. Kept explicit (not derived from RAIL_ENTRIES) so a non-rail dock surface
//  still has a visible heading + a named complementary landmark (WCAG 2.1 AA).
export const SURFACE_HEADINGS: Record<StudioSurface, { ka: string; en: string }> = {
  'insert':     { ka: 'დამატება',        en: 'Add' },
  'layers':     { ka: 'შრეები',          en: 'Layers' },
  'style':      { ka: 'ბრენდი და თემა',  en: 'Brand & theme' },
  'pages-site': { ka: 'გვერდები და საიტი', en: 'Pages & Site' },
  'model':      { ka: 'მონაცემთა მოდელი', en: 'Data model' },
}
