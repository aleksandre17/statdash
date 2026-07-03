// ── setupExtensions — register extension point contributions ─────────
//
//  Called from setupRegistrations.ts after i18next is ready.
//  Contributions are app-tier concerns (Law 3); they live here in the runner,
//  not in engine/react or plugins. Generic data-integrity capabilities
//  (preliminary badge, share-permalink) — tenant-agnostic, no brand content.
//
import { createElement }                 from 'react'
import {
  SECTION_HEADER_ACTIONS,
  type SectionActionHost,
} from '@statdash/react'
import { extensionRegistry }             from './registry'
import { SharePermalinkButton }          from './SharePermalinkButton'

export function setupExtensions(): void {
  // Data-integrity (preliminary) is consolidated to ONE page-level indicator
  // (AR-40, page header) — panels PUBLISH their status up the NodeStatusContext
  // scope rather than each rendering a PANEL_TITLE_BADGE pill. The former
  // PreliminaryBadge contributor (an unstyled per-panel "Prelim." badge) is
  // therefore removed. The PANEL_TITLE_BADGE point itself stays open for future
  // contributors.

  // ── SECTION_HEADER_ACTIONS: share permalink button (Law 9 — URL = permalink) ─
  extensionRegistry.contribute<React.ReactNode, SectionActionHost>(SECTION_HEADER_ACTIONS, {
    order:  10,
    render: (host: SectionActionHost) => createElement(SharePermalinkButton, { sectionId: host.sectionId }),
  })
}
