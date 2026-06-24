// ── @statdash/styles — Color + z-index token descriptors ───────────────────────
// Semantic color (text / surface / border / accent) · z-index scale.

import type { TokenDescriptor } from './types'

export const COLOR_TOKENS: Record<string, TokenDescriptor> = {

  // ── Color (semantic) ──────────────────────────────────────────────────────
  'color.text-primary': {
    group:   'color',
    cssVar:  'var(--color-text-primary)',
    label:       { ka: 'ძირითადი ტექსტი', en: 'Text Primary' },
    description: { ka: 'ძირითადი ტექსტის ფერი.',          en: 'Primary text color.' },
  },
  'color.text-secondary': {
    group:   'color',
    cssVar:  'var(--color-text-secondary)',
    label:       { ka: 'მეორეული ტექსტი', en: 'Text Secondary' },
    description: { ka: 'მეორეული ტექსტის ფერი.',          en: 'Secondary text color.' },
  },
  'color.text-muted': {
    group:   'color',
    cssVar:  'var(--color-text-muted)',
    label:       { ka: 'მკრთალი ტექსტი', en: 'Text Muted' },
    description: { ka: 'მკრთალი / დამხმარე ტექსტის ფერი.', en: 'Muted / helper text color.' },
  },
  'color.text-faint': {
    group:   'color',
    cssVar:  'var(--color-text-faint)',
    label:       { ka: 'ფერმკრთალი ტექსტი', en: 'Text Faint' },
    description: { ka: 'ფერმკრთალი ტექსტი (placeholder / subtitle).', en: 'Faint text (placeholder / subtitle).' },
  },
  'color.text-inverse': {
    group:   'color',
    cssVar:  'var(--color-text-inverse)',
    label:       { ka: 'ინვერსიული ტექსტი', en: 'Text Inverse' },
    description: { ka: 'ტექსტი მუქ ფონზე.',               en: 'Text color on dark surfaces.' },
  },
  'color.surface': {
    group:   'color',
    cssVar:  'var(--color-surface)',
    label:       { ka: 'ზედაპირი', en: 'Surface' },
    description: { ka: 'ძირითადი ფონის ფერი.',            en: 'Base surface / background color.' },
  },
  'color.surface-raised': {
    group:   'color',
    cssVar:  'var(--color-surface-raised)',
    label:       { ka: 'აწეული ზედაპირი', en: 'Surface Raised' },
    description: { ka: 'აწეული ბარათის ფონი.',            en: 'Raised card surface color.' },
  },
  'color.surface-sunken': {
    group:   'color',
    cssVar:  'var(--color-surface-sunken)',
    label:       { ka: 'ჩაღრმავებული ზედაპირი', en: 'Surface Sunken' },
    description: { ka: 'ჩაღრმავებული არის ფონი.',         en: 'Sunken / inset surface color.' },
  },
  'color.surface-frame': {
    group:   'color',
    cssVar:  'var(--color-surface-frame)',
    label:       { ka: 'ჩარჩოს ზედაპირი', en: 'Surface Frame' },
    description: { ka: 'ჩარჩოს / გამყოფის ფონი.',         en: 'Frame / divider surface color.' },
  },
  'color.border': {
    group:   'color',
    cssVar:  'var(--color-border)',
    label:       { ka: 'საზღვარი', en: 'Border' },
    description: { ka: 'ნაგულისხმევი საზღვრის ფერი.',     en: 'Default border color.' },
  },
  'color.border-subtle': {
    group:   'color',
    cssVar:  'var(--color-border-subtle)',
    label:       { ka: 'რბილი საზღვარი', en: 'Border Subtle' },
    description: { ka: 'რბილი hairline გამყოფი.',          en: 'Subtle hairline divider color.' },
  },
  'color.border-frame': {
    group:   'color',
    cssVar:  'var(--color-border-frame)',
    label:       { ka: 'ჩარჩოს საზღვარი', en: 'Border Frame' },
    description: { ka: 'სქემის / tooltip ჩარჩოს საზღვარი.', en: 'Chart / tooltip frame border color.' },
  },
  'color.border-strong': {
    group:   'color',
    cssVar:  'var(--color-border-strong)',
    label:       { ka: 'მკვეთრი საზღვარი', en: 'Border Strong' },
    description: { ka: 'მკვეთრი / აქცენტური საზღვარი.',   en: 'Strong / emphasized border color.' },
  },
  'color.border-interactive': {
    group:   'color',
    cssVar:  'var(--color-border-interactive)',
    label:       { ka: 'ინტერაქციული საზღვარი', en: 'Border Interactive' },
    description: { ka: 'hover / active მდგომარეობის საზღვარი.', en: 'Hover / active state border color.' },
  },
  'color.accent': {
    group:   'color',
    cssVar:  'var(--color-accent)',
    label:       { ka: 'აქცენტი', en: 'Accent' },
    description: { ka: 'ინტერაქციული აქცენტის ფერი.',     en: 'Interactive accent color.' },
  },
  'color.accent-hover': {
    group:   'color',
    cssVar:  'var(--color-accent-hover)',
    label:       { ka: 'აქცენტი (hover)', en: 'Accent Hover' },
    description: { ka: 'აქცენტის hover მდგომარეობა.',     en: 'Accent hover state color.' },
  },
  'color.accent-muted': {
    group:   'color',
    cssVar:  'var(--color-accent-muted)',
    label:       { ka: 'მკრთალი აქცენტი', en: 'Accent Muted' },
    description: { ka: 'აქცენტის მკრთალი ფონი (hover / selected).', en: 'Muted accent background (hover / selected).' },
  },
  'color.accent-bg': {
    group:   'color',
    cssVar:  'var(--color-accent-bg)',
    label:       { ka: 'აქცენტის ფონი', en: 'Accent Background' },
    description: { ka: 'აქცენტის რბილი ფონი (active icon-btn).', en: 'Soft accent background (active icon-btn).' },
  },
  'color.accent-secondary': {
    group:   'color',
    cssVar:  'var(--color-accent-secondary)',
    label:       { ka: 'მეორეული აქცენტი', en: 'Accent Secondary' },
    description: { ka: 'მეორეული აქცენტის ფერი (teal).',  en: 'Secondary accent color (teal).' },
  },
  'color.accent-ring': {
    group:   'color',
    cssVar:  'var(--color-accent-ring)',
    label:       { ka: 'აქცენტის რგოლი', en: 'Accent Ring' },
    description: { ka: 'ფოკუსის / არჩევის რგოლი აქცენტიდან.', en: 'Focus / selection ring derived from accent.' },
  },
  'color.accent-chip-border': {
    group:   'color',
    cssVar:  'var(--color-accent-chip-border)',
    label:       { ka: 'ჩიპის საზღვარი', en: 'Accent Chip Border' },
    description: { ka: 'აქცენტური ჩიპის (pill) საზღვარი.', en: 'Accent chip (pill) border color.' },
  },
  'color.heading-display': {
    group:   'color',
    cssVar:  'var(--color-heading-display)',
    label:       { ka: 'სათაური (დიდი)', en: 'Heading Display' },
    description: { ka: 'უმსხვილესი hero სათაურის ფერი.', en: 'Largest hero/display heading color.' },
  },
  'color.trend-positive': {
    group:   'color',
    cssVar:  'var(--color-trend-positive)',
    label:       { ka: 'ზრდის ტენდენცია', en: 'Trend Positive' },
    description: { ka: 'მონაცემთა ზრდის მიმართულების ფერი (გლიფთან ერთად).', en: 'Upward-trend data color (always paired with a glyph).' },
  },
  'color.trend-negative': {
    group:   'color',
    cssVar:  'var(--color-trend-negative)',
    label:       { ka: 'კლების ტენდენცია', en: 'Trend Negative' },
    description: { ka: 'მონაცემთა კლების მიმართულების ფერი (გლიფთან ერთად).', en: 'Downward-trend data color (always paired with a glyph).' },
  },
  'color.breadcrumb-separator': {
    group:   'color',
    cssVar:  'var(--color-breadcrumb-separator)',
    label:       { ka: 'breadcrumb გამყოფი', en: 'Breadcrumb Separator' },
    description: { ka: 'breadcrumb-ის "/" გამყოფის ფერი.', en: 'Breadcrumb "/" separator color.' },
  },
  'color.danger-fg': {
    group:   'color',
    cssVar:  'var(--color-danger-fg)',
    label:       { ka: 'მკვეთრი წითელი', en: 'Danger Foreground' },
    description: { ka: 'სავალდებულო ველის / დესტრუქციული მოქმედების წითელი.', en: 'Required-field / destructive-action red.' },
  },
  'color.chart-frame': {
    group:   'color',
    cssVar:  'var(--color-chart-frame)',
    label:       { ka: 'სქემის ჩარჩო', en: 'Chart Frame' },
    description: { ka: 'მონაცემთა ვიზუალიზაციის ჩარჩოს ფერი.', en: 'Data-viz frame color (chrome around charts).' },
  },
  'color.chart-grid': {
    group:   'color',
    cssVar:  'var(--color-chart-grid)',
    label:       { ka: 'სქემის ბადე', en: 'Chart Grid' },
    description: { ka: 'სქემის ბადის ხაზების ფერი.', en: 'Chart grid-line color.' },
  },

  // ── Z-index ───────────────────────────────────────────────────────────────
  'z-index.base': {
    group:   'z-index',
    cssVar:  'var(--z-base)',
    label:       { ka: 'ბაზისური', en: 'Z Base' },
    description: { ka: 'ბაზისური ფენა (0).',              en: 'Base stacking layer (0).' },
  },
  'z-index.raised': {
    group:   'z-index',
    cssVar:  'var(--z-raised)',
    label:       { ka: 'აწეული', en: 'Z Raised' },
    description: { ka: 'ოდნავ აწეული ფენა (10).',         en: 'Slightly raised layer (10).' },
  },
  'z-index.dropdown': {
    group:   'z-index',
    cssVar:  'var(--z-dropdown)',
    label:       { ka: 'ჩამოსაშლელი', en: 'Z Dropdown' },
    description: { ka: 'ჩამოსაშლელი მენიუს ფენა (50).', en: 'Dropdown menu layer (50).' },
  },
  'z-index.sticky': {
    group:   'z-index',
    cssVar:  'var(--z-sticky)',
    label:       { ka: 'მიმაგრებული', en: 'Z Sticky' },
    description: { ka: 'მიმაგრებული ელემენტების ფენა (100).', en: 'Sticky element layer (100).' },
  },
  'z-index.overlay': {
    group:   'z-index',
    cssVar:  'var(--z-overlay)',
    label:       { ka: 'ოვერლეი', en: 'Z Overlay' },
    description: { ka: 'მოდალური / ოვერლეის ფენა (200).', en: 'Modal / overlay layer (200).' },
  },
  'z-index.modal': {
    group:   'z-index',
    cssVar:  'var(--z-modal)',
    label:       { ka: 'მოდალი', en: 'Z Modal' },
    description: { ka: 'მოდალური დიალოგის ფენა (300).', en: 'Modal dialog layer (300).' },
  },
  'z-index.tooltip': {
    group:   'z-index',
    cssVar:  'var(--z-tooltip)',
    label:       { ka: 'მინიშნება', en: 'Z Tooltip' },
    description: { ka: 'მინიშნების ფენა (400).', en: 'Tooltip layer (400).' },
  },
  'z-index.notification': {
    group:   'z-index',
    cssVar:  'var(--z-notification)',
    label:       { ka: 'შეტყობინება', en: 'Z Notification' },
    description: { ka: 'შეტყობინების / toast ფენა (500).', en: 'Notification / toast layer (500).' },
  },
  'z-index.max': {
    group:   'z-index',
    cssVar:  'var(--z-max)',
    label:       { ka: 'მაქსიმუმი', en: 'Z Max' },
    description: { ka: 'უმაღლესი შესაძლო ფენა.', en: 'Highest possible stacking layer.' },
  },
}
