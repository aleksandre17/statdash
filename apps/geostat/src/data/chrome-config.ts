// ── Chrome Config — Geostat brand identity ─────────────────────────
//
//  All brand-specific content for chrome shells.
//  Phase 2: this object comes from the API alongside SiteManifest.
//  Zero chrome shell changes needed — they read from useChromeConfig().
//
import type { ChromeConfig } from '@geostat/react'

export const CHROME_CONFIG: ChromeConfig = {
  logoUrl:  'https://www.geostat.ge/img/logo.svg',
  logoAlt:  { ka: 'საქსტატი — საქართველოს სტატისტიკის ეროვნული სამსახური', en: 'GeoStat — National Statistics Office of Georgia' },

  localeLabels: { ka: 'ქარ', en: 'ENG' },

  socialLinks: [
    {
      href:  'https://www.facebook.com/Geostat.ge',
      label: 'Facebook',
      icon:  'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
      fill:  false,
    },
    {
      href:  'https://x.com/GeoStat_Ge',
      label: 'X (Twitter)',
      icon:  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
      fill:  true,
    },
    {
      href:  'https://www.linkedin.com/company/geostat',
      label: 'LinkedIn',
      icon:  'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z',
      fill:  false,
    },
  ],

  copyright: { ka: 'ყველა უფლება დაცულია', en: 'All rights reserved' },

  footerLinks: [
    {
      href:  'https://www.geostat.ge',
      label: {
        ka: 'საქართველოს სტატისტიკის ეროვნული სამსახური — საქსტატი',
        en: 'National Statistics Office of Georgia — GeoStat',
      },
    },
    {
      href:  'https://www.geostat.ge/ka/page/monacemta-gamoyenebis-pirobebi',
      label: { ka: 'მონაცემთა გამოყენების პირობები', en: 'Data Usage Terms' },
    },
  ],
}