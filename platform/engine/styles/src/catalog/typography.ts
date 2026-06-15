// ── @geostat/styles — Typography token descriptors ────────────────────────────
// Font size · weight · line height · letter spacing · font family.

import type { TokenDescriptor } from './types'

export const TYPOGRAPHY_TOKENS: Record<string, TokenDescriptor> = {

  // ── Font size ─────────────────────────────────────────────────────────────
  'font-size.xs': {
    group:   'font-size',
    cssVar:  'var(--font-size-xs)',
    label:       { ka: 'შრიფტი XS',  en: 'Font Size XS' },
    description: { ka: 'ყველაზე პატარა ტექსტი (12px).',  en: 'Extra-small text (12px).' },
  },
  'font-size.sm': {
    group:   'font-size',
    cssVar:  'var(--font-size-sm)',
    label:       { ka: 'შრიფტი SM',  en: 'Font Size SM' },
    description: { ka: 'პატარა ტექსტი (13px).',          en: 'Small text (13px).' },
  },
  'font-size.md': {
    group:   'font-size',
    cssVar:  'var(--font-size-md)',
    label:       { ka: 'შრიფტი MD',  en: 'Font Size MD' },
    description: { ka: 'ძირითადი ტექსტი (15px, ნაგულისხმევი).', en: 'Body text (15px, default).' },
  },
  'font-size.lg': {
    group:   'font-size',
    cssVar:  'var(--font-size-lg)',
    label:       { ka: 'შრიფტი LG',  en: 'Font Size LG' },
    description: { ka: 'დიდი ტექსტი / ქვესათაური (18px).', en: 'Large text / subheading (18px).' },
  },
  'font-size.xl': {
    group:   'font-size',
    cssVar:  'var(--font-size-xl)',
    label:       { ka: 'შრიფტი XL',  en: 'Font Size XL' },
    description: { ka: 'სათაური (24px).',                en: 'Heading (24px).' },
  },
  'font-size.2xl': {
    group:   'font-size',
    cssVar:  'var(--font-size-2xl)',
    label:       { ka: 'შრიფტი 2XL', en: 'Font Size 2XL' },
    description: { ka: 'დიდი სათაური (32px).',           en: 'Display heading (32px).' },
  },

  // ── Fluid font size (clamp — scales with viewport) ──────────────────────────
  'fluid-font-size.sm': {
    group:   'fluid-font-size',
    cssVar:  'var(--font-size-fluid-sm)',
    label:       { ka: 'მცურავი შრიფტი SM', en: 'Fluid Font SM' },
    description: { ka: 'მცურავი პატარა ტექსტი (13→15px).', en: 'Fluid small text (13→15px).' },
  },
  'fluid-font-size.md': {
    group:   'fluid-font-size',
    cssVar:  'var(--font-size-fluid-md)',
    label:       { ka: 'მცურავი შრიფტი MD', en: 'Fluid Font MD' },
    description: { ka: 'მცურავი ძირითადი ტექსტი (15→18px).', en: 'Fluid body text (15→18px).' },
  },
  'fluid-font-size.lg': {
    group:   'fluid-font-size',
    cssVar:  'var(--font-size-fluid-lg)',
    label:       { ka: 'მცურავი შრიფტი LG', en: 'Fluid Font LG' },
    description: { ka: 'მცურავი ქვესათაური (18→24px).', en: 'Fluid subheading (18→24px).' },
  },
  'fluid-font-size.xl': {
    group:   'fluid-font-size',
    cssVar:  'var(--font-size-fluid-xl)',
    label:       { ka: 'მცურავი შრიფტი XL', en: 'Fluid Font XL' },
    description: { ka: 'მცურავი სათაური (24→36px).', en: 'Fluid heading (24→36px).' },
  },
  'fluid-font-size.2xl': {
    group:   'fluid-font-size',
    cssVar:  'var(--font-size-fluid-2xl)',
    label:       { ka: 'მცურავი შრიფტი 2XL', en: 'Fluid Font 2XL' },
    description: { ka: 'მცურავი დიდი სათაური (32→48px).', en: 'Fluid display heading (32→48px).' },
  },
  'fluid-font-size.display': {
    group:   'fluid-font-size',
    cssVar:  'var(--font-size-fluid-display)',
    label:       { ka: 'მცურავი დიდი სათაური', en: 'Fluid Display' },
    description: { ka: 'უდიდესი მცურავი სათაური (40→72px).', en: 'Largest fluid display heading (40→72px).' },
  },

  // ── Font weight ───────────────────────────────────────────────────────────
  'font-weight.regular': {
    group:   'font-weight',
    cssVar:  'var(--font-weight-regular)',
    label:       { ka: 'ჩვეულებრივი', en: 'Regular' },
    description: { ka: 'ნორმალური სიმძიმე (400).',        en: 'Normal weight (400).' },
  },
  'font-weight.medium': {
    group:   'font-weight',
    cssVar:  'var(--font-weight-medium)',
    label:       { ka: 'საშუალო',     en: 'Medium' },
    description: { ka: 'საშუალო სიმძიმე (500).',          en: 'Medium weight (500).' },
  },
  'font-weight.semibold': {
    group:   'font-weight',
    cssVar:  'var(--font-weight-semibold)',
    label:       { ka: 'ნახევრად მსხვილი', en: 'Semibold' },
    description: { ka: 'ნახევრად მსხვილი (600).',          en: 'Semibold weight (600).' },
  },
  'font-weight.bold': {
    group:   'font-weight',
    cssVar:  'var(--font-weight-bold)',
    label:       { ka: 'მსხვილი',     en: 'Bold' },
    description: { ka: 'მსხვილი სიმძიმე (700).',          en: 'Bold weight (700).' },
  },

  // ── Line height ───────────────────────────────────────────────────────────
  'line-height.tight': {
    group:   'line-height',
    cssVar:  'var(--line-height-tight)',
    label:       { ka: 'მჭიდრო',  en: 'Tight' },
    description: { ka: 'მჭიდრო ხაზის სიმაღლე (1.2) — სათაურებისთვის.', en: 'Tight line height (1.2) — for headings.' },
  },
  'line-height.normal': {
    group:   'line-height',
    cssVar:  'var(--line-height-normal)',
    label:       { ka: 'ნორმალური', en: 'Normal' },
    description: { ka: 'ნორმალური ხაზის სიმაღლე (1.5) — ძირითადი ტექსტი.', en: 'Normal line height (1.5) — body text.' },
  },
  'line-height.relaxed': {
    group:   'line-height',
    cssVar:  'var(--line-height-relaxed)',
    label:       { ka: 'თავისუფალი', en: 'Relaxed' },
    description: { ka: 'თავისუფალი ხაზის სიმაღლე (1.75).', en: 'Relaxed line height (1.75).' },
  },

  // ── Letter spacing ────────────────────────────────────────────────────────
  'letter-spacing.tight': {
    group:   'letter-spacing',
    cssVar:  'var(--letter-spacing-tight)',
    label:       { ka: 'მჭიდრო',  en: 'Tight' },
    description: { ka: 'მჭიდრო ასოთშორისი (-0.01em).',   en: 'Tight letter spacing (-0.01em).' },
  },
  'letter-spacing.normal': {
    group:   'letter-spacing',
    cssVar:  'var(--letter-spacing-normal)',
    label:       { ka: 'ნორმალური', en: 'Normal' },
    description: { ka: 'ნორმალური ასოთშორისი (0).',       en: 'Normal letter spacing (0).' },
  },
  'letter-spacing.wide': {
    group:   'letter-spacing',
    cssVar:  'var(--letter-spacing-wide)',
    label:       { ka: 'ფართო',   en: 'Wide' },
    description: { ka: 'ფართო ასოთშორისი (0.04em) — დიდი ასოებისთვის.', en: 'Wide letter spacing (0.04em) — for uppercase labels.' },
  },

  // ── Font family ───────────────────────────────────────────────────────────
  'font-family.base': {
    group:   'font-family',
    cssVar:  'var(--font-family-base)',
    label:       { ka: 'ძირითადი შრიფტი', en: 'Base Font' },
    description: { ka: 'ინტერფეისის ძირითადი შრიფტი.',    en: 'Primary UI font family.' },
  },
  'font-family.mono': {
    group:   'font-family',
    cssVar:  'var(--font-family-mono)',
    label:       { ka: 'მონოსიგანის შრიფტი', en: 'Mono Font' },
    description: { ka: 'მონოსიგანის შრიფტი (კოდი / რიცხვები).', en: 'Monospace font (code / tabular numbers).' },
  },
}
