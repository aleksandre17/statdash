// ── @statdash/styles — Primitive token descriptors ─────────────────────────────
// Border width · semantic size · backdrop blur · opacity.

import type { TokenDescriptor } from './types'

export const PRIMITIVE_TOKENS: Record<string, TokenDescriptor> = {

  // ── Border width ────────────────────────────────────────────────────────────
  'border-width.thin': {
    group:   'border-width',
    cssVar:  'var(--border-width-thin)',
    label:       { ka: 'წვრილი საზღვარი', en: 'Border Thin' },
    description: { ka: 'წვრილი საზღვრის სიგანე (1px).', en: 'Thin border width (1px).' },
  },
  'border-width.base': {
    group:   'border-width',
    cssVar:  'var(--border-width-base)',
    label:       { ka: 'ბაზისური საზღვარი', en: 'Border Base' },
    description: { ka: 'ბაზისური საზღვრის სიგანე (2px).', en: 'Base border width (2px).' },
  },
  'border-width.thick': {
    group:   'border-width',
    cssVar:  'var(--border-width-thick)',
    label:       { ka: 'სქელი საზღვარი', en: 'Border Thick' },
    description: { ka: 'სქელი საზღვრის სიგანე (4px).', en: 'Thick border width (4px).' },
  },

  // ── Size (icons + container max-widths) ─────────────────────────────────────
  'size.icon-sm': {
    group:   'size',
    cssVar:  'var(--size-icon-sm)',
    label:       { ka: 'ხატულა SM', en: 'Icon SM' },
    description: { ka: 'პატარა ხატულის ზომა (16px).', en: 'Small icon size (16px).' },
  },
  'size.icon-md': {
    group:   'size',
    cssVar:  'var(--size-icon-md)',
    label:       { ka: 'ხატულა MD', en: 'Icon MD' },
    description: { ka: 'საშუალო ხატულის ზომა (20px).', en: 'Medium icon size (20px).' },
  },
  'size.icon-lg': {
    group:   'size',
    cssVar:  'var(--size-icon-lg)',
    label:       { ka: 'ხატულა LG', en: 'Icon LG' },
    description: { ka: 'დიდი ხატულის ზომა (24px).', en: 'Large icon size (24px).' },
  },
  'size.container-narrow': {
    group:   'size',
    cssVar:  'var(--size-container-narrow)',
    label:       { ka: 'ვიწრო კონტეინერი', en: 'Container Narrow' },
    description: { ka: 'ვიწრო კონტეინერის მაქს. სიგანე (640px).', en: 'Narrow container max-width (640px).' },
  },
  'size.container-mid': {
    group:   'size',
    cssVar:  'var(--size-container-mid)',
    label:       { ka: 'საშუალო კონტეინერი', en: 'Container Mid' },
    description: { ka: 'საშუალო კონტეინერის მაქს. სიგანე (960px).', en: 'Medium container max-width (960px).' },
  },
  'size.container-wide': {
    group:   'size',
    cssVar:  'var(--size-container-wide)',
    label:       { ka: 'ფართო კონტეინერი', en: 'Container Wide' },
    description: { ka: 'ფართო კონტეინერის მაქს. სიგანე (1280px).', en: 'Wide container max-width (1280px).' },
  },

  // ── Blur (backdrop filter) ──────────────────────────────────────────────────
  'blur.sm': {
    group:   'blur',
    cssVar:  'var(--blur-sm)',
    label:       { ka: 'ბუნდი SM', en: 'Blur SM' },
    description: { ka: 'პატარა ბუნდი (4px).', en: 'Small backdrop blur (4px).' },
  },
  'blur.md': {
    group:   'blur',
    cssVar:  'var(--blur-md)',
    label:       { ka: 'ბუნდი MD', en: 'Blur MD' },
    description: { ka: 'საშუალო ბუნდი (8px).', en: 'Medium backdrop blur (8px).' },
  },
  'blur.lg': {
    group:   'blur',
    cssVar:  'var(--blur-lg)',
    label:       { ka: 'ბუნდი LG', en: 'Blur LG' },
    description: { ka: 'დიდი ბუნდი (16px) — გამჭვირვალე მინა.', en: 'Large backdrop blur (16px) — frosted glass.' },
  },

  // ── Opacity ─────────────────────────────────────────────────────────────────
  'opacity.disabled': {
    group:   'opacity',
    cssVar:  'var(--opacity-disabled)',
    label:       { ka: 'გათიშული', en: 'Opacity Disabled' },
    description: { ka: 'გათიშული მდგომარეობის გამჭვირვალობა (0.38).', en: 'Disabled-state opacity (0.38).' },
  },
  'opacity.muted': {
    group:   'opacity',
    cssVar:  'var(--opacity-muted)',
    label:       { ka: 'მკრთალი', en: 'Opacity Muted' },
    description: { ka: 'მკრთალი მდგომარეობის გამჭვირვალობა (0.6).', en: 'Muted-state opacity (0.6).' },
  },
  'opacity.ghost': {
    group:   'opacity',
    cssVar:  'var(--opacity-ghost)',
    label:       { ka: 'მოჩვენებითი', en: 'Opacity Ghost' },
    description: { ka: 'ძალიან გამჭვირვალე (0.08) — hover ფონები.', en: 'Near-transparent (0.08) — ghost hover backgrounds.' },
  },
}
