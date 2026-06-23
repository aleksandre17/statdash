// ── App-footer slice META + per-element config schema ──────────────────
//
//  STRICT SOLID — the footer owns its element-specific config here, NOT on
//  the shared ChromeConfig base (ISP/OCP). footerLinks is read by THIS shell
//  alone, so it lives on THIS element's PropSchema — the same per-slice seam
//  every other slice kind already uses. New element = new schema; the base is
//  never widened (Open/Closed).
//
import type { ChromeSliceMeta, PropSchema } from '@statdash/react/engine'
import type { LocaleString }                from '@statdash/engine'

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

// ── AppFooterSchema — Constructor/Inspector property descriptors ────────
export const AppFooterSchema: PropSchema = [
  {
    field: 'footerLinks',
    type:  'array',
    label: { ka: 'ქვედა ზოლის ბმულები', en: 'Footer Links' },
  },
]

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
