// ── App-footer slice META + per-element config schema ──────────────────
//
//  STRICT SOLID — the footer owns its element-specific config here, NOT on
//  the shared ChromeConfig base (ISP/OCP). footerLinks is read by THIS shell
//  alone, so it lives on THIS element's PropSchema — the same per-slice seam
//  every other slice kind already uses. New element = new schema; the base is
//  never widened (Open/Closed).
//
import type { ChromeSliceMeta } from '@statdash/react/engine'
import type { LocaleString }                from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

// ── FooterLinkDef — one link rendered in the footer link row ────────────
//
//  Owned by the footer (its sole consumer), not the shared chrome base.
export interface FooterLinkDef {
  href:  string
  label: LocaleString
}

// ── AppFooterConfig — the per-instance config shape this shell reads ─────
//
//  Injected by ChromeRegion for slot="AppFooter" from the manifest's
//  chrome["AppFooter"].config. Absent ⇒ the shell omits the link row.
export interface AppFooterConfig {
  footerLinks?: FooterLinkDef[]
}

// ── FooterLinkItemSchema — the per-LINK nested schema (D7.2 / ADR-022) ───────
export const FooterLinkItemSchema = defineSchema([
  { field: 'href',  type: 'string',       label: { ka: 'ბმული',   en: 'URL' }, required: true },
  { field: 'label', type: 'LocaleString', label: { ka: 'წარწერა', en: 'Label' }, coverage: 'localized', required: true },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with FooterLinkDef's editable keys.
export type _FooterLinkCovers = Expect<AssertSchemaCovers<FooterLinkDef, typeof FooterLinkItemSchema>>

// ── AppFooterSchema — Constructor/Inspector property descriptors ────────
export const AppFooterSchema = defineSchema([
  {
    field: 'footerLinks',
    type:  'array',
    label: { ka: 'ქვედა ზოლის ბმულები', en: 'Footer Links' },
    itemSchema: FooterLinkItemSchema,
    itemLabel: 'label',
  },
])

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppFooter',
  key:           'default',
  label:         { ka: 'სტანდარტული ქვედა ზოლი', en: 'Standard Footer' },
  icon:          'layout-bottom',
  schema:        AppFooterSchema,
  version:       1,
  defaultRegion: 'bottom',
  defaultOrder:  0,
}
