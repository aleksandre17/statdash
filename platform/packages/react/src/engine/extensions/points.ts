import { createExtensionPoint } from './ExtensionPoint'
import type { ReactNode } from 'react'

/** Host context for panel title badge contributions. */
export interface PanelTitleHost {
  nodeType:     string
  nodeId?:      string
  /** True if the data is marked preliminary — badge shows when true. */
  preliminary?: boolean
}

/** Host context for section header action contributions. */
export interface SectionActionHost {
  sectionId?:    string
  hasMethodology: boolean
}

/**
 * PANEL_TITLE_BADGE — contribute badges/indicators to panel titles.
 * First use: "preliminary data" badge (Law 9: data integrity).
 * Shell usage: pass result to PanelLayout's `titleBadge` prop.
 */
export const PANEL_TITLE_BADGE = createExtensionPoint<ReactNode>('panel.title.badge')

/**
 * SECTION_HEADER_ACTIONS — contribute action buttons to section headers.
 * First use: "share permalink" button (Law 9: URL = permalink).
 * Shell usage: rendered in SectionShell's section__actions div.
 */
export const SECTION_HEADER_ACTIONS = createExtensionPoint<ReactNode>('section.header.actions')
