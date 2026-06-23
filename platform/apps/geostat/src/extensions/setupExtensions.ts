// ── setupExtensions — register extension point contributions ─────────
//
//  Called from setupRegistrations.ts after i18next is ready.
//  Contributions are app-tier concerns (Law 3); they live here in the runner,
//  not in engine/react or plugins. Generic data-integrity capabilities
//  (preliminary badge, share-permalink) — tenant-agnostic, no brand content.
//
import { createElement }                 from 'react'
import {
  PANEL_TITLE_BADGE, SECTION_HEADER_ACTIONS,
  type PanelTitleHost, type SectionActionHost,
} from '@statdash/react'
import { extensionRegistry }             from './registry'
import { PreliminaryBadge }              from './PreliminaryBadge'
import { SharePermalinkButton }          from './SharePermalinkButton'

export function setupExtensions(): void {
  // ── PANEL_TITLE_BADGE: preliminary data badge (Law 9 — data integrity) ──
  extensionRegistry.contribute<React.ReactNode, PanelTitleHost>(PANEL_TITLE_BADGE, {
    when:   (host: PanelTitleHost) => host.preliminary === true,
    render: (host: PanelTitleHost) => createElement(PreliminaryBadge, { key: host.nodeId }),
  })

  // ── SECTION_HEADER_ACTIONS: share permalink button (Law 9 — URL = permalink) ─
  extensionRegistry.contribute<React.ReactNode, SectionActionHost>(SECTION_HEADER_ACTIONS, {
    order:  10,
    render: (host: SectionActionHost) => createElement(SharePermalinkButton, { sectionId: host.sectionId }),
  })
}
