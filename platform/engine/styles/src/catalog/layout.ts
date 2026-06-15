// ── @geostat/styles — Layout token descriptors ────────────────────────────────
// Spacing · radii · shadow · aspect · breakpoints. (Motion → motion.ts,
// border-width / size / blur / opacity → primitives.ts.)

import type { TokenDescriptor } from './types'

export const LAYOUT_TOKENS: Record<string, TokenDescriptor> = {

  // ── Spacing ───────────────────────────────────────────────────────────────
  'spacing.0': {
    group:   'spacing',
    cssVar:  'var(--spacing-0)',
    label:       { ka: 'ინტერვალი 0', en: 'Spacing 0' },
    description: { ka: 'ნულოვანი ინტერვალი.', en: 'Zero spacing.' },
  },
  'spacing.xs': {
    group:   'spacing',
    cssVar:  'var(--spacing-xs)',
    label:       { ka: 'ინტერვალი XS',  en: 'Spacing XS'  },
    description: { ka: 'ყველაზე პატარა ინტერვალი.',   en: 'Extra-small spacing unit.' },
  },
  'spacing.sm': {
    group:   'spacing',
    cssVar:  'var(--spacing-sm)',
    label:       { ka: 'ინტერვალი SM',  en: 'Spacing SM'  },
    description: { ka: 'პატარა ინტერვალი.',             en: 'Small spacing unit.' },
  },
  'spacing.md': {
    group:   'spacing',
    cssVar:  'var(--spacing-md)',
    label:       { ka: 'ინტერვალი MD',  en: 'Spacing MD'  },
    description: { ka: 'საშუალო ინტერვალი (ნაგულისხმევი).', en: 'Medium spacing unit (default).' },
  },
  'spacing.lg': {
    group:   'spacing',
    cssVar:  'var(--spacing-lg)',
    label:       { ka: 'ინტერვალი LG',  en: 'Spacing LG'  },
    description: { ka: 'დიდი ინტერვალი.',               en: 'Large spacing unit.' },
  },
  'spacing.xl': {
    group:   'spacing',
    cssVar:  'var(--spacing-xl)',
    label:       { ka: 'ინტერვალი XL',  en: 'Spacing XL'  },
    description: { ka: 'ძალიან დიდი ინტერვალი.',       en: 'Extra-large spacing unit.' },
  },
  'spacing.2xl': {
    group:   'spacing',
    cssVar:  'var(--spacing-2xl)',
    label:       { ka: 'ინტერვალი 2XL', en: 'Spacing 2XL' },
    description: { ka: 'ორმაგად დიდი ინტერვალი.',     en: 'Double extra-large spacing unit.' },
  },
  'spacing.3xl': {
    group:   'spacing',
    cssVar:  'var(--spacing-3xl)',
    label:       { ka: 'ინტერვალი 3XL', en: 'Spacing 3XL' },
    description: { ka: 'სამმაგად დიდი ინტერვალი (64px).', en: 'Triple extra-large spacing unit (64px).' },
  },
  'spacing.4xl': {
    group:   'spacing',
    cssVar:  'var(--spacing-4xl)',
    label:       { ka: 'ინტერვალი 4XL', en: 'Spacing 4XL' },
    description: { ka: 'უდიდესი ინტერვალი (96px).', en: 'Largest spacing unit (96px).' },
  },

  // ── Radii ─────────────────────────────────────────────────────────────────
  'radii.none': {
    group:   'radii',
    cssVar:  'var(--radius-none)',
    label:       { ka: 'მომრგვება გარეშე', en: 'Radius None' },
    description: { ka: 'მომრგვების გარეშე (0).', en: 'No border radius (0).' },
  },
  'radii.xs': {
    group:   'radii',
    cssVar:  'var(--radius-xs)',
    label:       { ka: 'მომრგვება XS', en: 'Radius XS' },
    description: { ka: 'ყველაზე პატარა მომრგვება (2px).', en: 'Extra-small border radius (2px).' },
  },
  'radii.sm': {
    group:   'radii',
    cssVar:  'var(--radius-sm)',
    label:       { ka: 'მომრგვება SM',   en: 'Radius SM'   },
    description: { ka: 'პატარა მომრგვება.',             en: 'Small border radius.' },
  },
  'radii.md': {
    group:   'radii',
    cssVar:  'var(--radius-md)',
    label:       { ka: 'მომრგვება MD',   en: 'Radius MD'   },
    description: { ka: 'საშუალო მომრგვება.',            en: 'Medium border radius.' },
  },
  'radii.lg': {
    group:   'radii',
    cssVar:  'var(--radius-lg)',
    label:       { ka: 'მომრგვება LG',   en: 'Radius LG'   },
    description: { ka: 'დიდი მომრგვება.',               en: 'Large border radius.' },
  },
  'radii.xl': {
    group:   'radii',
    cssVar:  'var(--radius-xl)',
    label:       { ka: 'მომრგვება XL', en: 'Radius XL' },
    description: { ka: 'ძალიან დიდი მომრგვება (16px).', en: 'Extra-large border radius (16px).' },
  },
  'radii.2xl': {
    group:   'radii',
    cssVar:  'var(--radius-2xl)',
    label:       { ka: 'მომრგვება 2XL', en: 'Radius 2XL' },
    description: { ka: 'ორმაგად დიდი მომრგვება (24px).', en: 'Double extra-large border radius (24px).' },
  },
  'radii.card': {
    group:   'radii',
    cssVar:  'var(--radius-card)',
    label:       { ka: 'ბარათის მომრგვება', en: 'Card Radius' },
    description: { ka: 'ბარათის კომპონენტის მომრგვება.',   en: 'Border radius for card components.' },
  },
  'radii.pill': {
    group:   'radii',
    cssVar:  'var(--radius-pill)',
    label:       { ka: 'ტაბლეტი',        en: 'Pill Radius' },
    description: { ka: 'სრული მომრგვება (ტაბლეტის ფორმა).', en: 'Full border radius (pill / capsule shape).' },
  },

  // ── Shadow ────────────────────────────────────────────────────────────────
  'shadow.sm': {
    group:   'shadow',
    cssVar:  'var(--shadow-sm)',
    label:       { ka: 'ჩრდილი SM',      en: 'Shadow SM'      },
    description: { ka: 'პატარა ჩრდილი.',                en: 'Small elevation shadow.' },
  },
  'shadow.md': {
    group:   'shadow',
    cssVar:  'var(--shadow-md)',
    label:       { ka: 'ჩრდილი MD',      en: 'Shadow MD'      },
    description: { ka: 'საშუალო ჩრდილი.',               en: 'Medium elevation shadow.' },
  },
  'shadow.card': {
    group:   'shadow',
    cssVar:  'var(--shadow-card)',
    label:       { ka: 'ბარათის ჩრდილი', en: 'Card Shadow'     },
    description: { ka: 'ბარათის კომპონენტის ჩრდილი.',    en: 'Shadow for card components.' },
  },
  'shadow.overlay': {
    group:   'shadow',
    cssVar:  'var(--shadow-overlay)',
    label:       { ka: 'ოვერლეის ჩრდილი', en: 'Overlay Shadow' },
    description: { ka: 'მოდალური / ჩასმული ელემენტის ჩრდილი.', en: 'Shadow for modal / overlay elements.' },
  },
  'shadow.xl': {
    group:   'shadow',
    cssVar:  'var(--shadow-xl)',
    label:       { ka: 'ჩრდილი XL', en: 'Shadow XL' },
    description: { ka: 'ღრმა ჩრდილი — მოდალები / პოპოვერები.', en: 'Deep shadow — modals / popovers.' },
  },
  'shadow.inset': {
    group:   'shadow',
    cssVar:  'var(--shadow-inset)',
    label:       { ka: 'შიდა ჩრდილი', en: 'Inset Shadow' },
    description: { ka: 'შიდა ჩრდილი — ჩაღრმავებული ველები.', en: 'Inset shadow — sunken inputs / wells.' },
  },
  'shadow.focus': {
    group:   'shadow',
    cssVar:  'var(--shadow-focus)',
    label:       { ka: 'ფოკუსის რგოლი', en: 'Focus Ring' },
    description: { ka: 'ხელმისაწვდომი ფოკუსის რგოლი (WCAG 2.1 AA).', en: 'Accessible focus ring (WCAG 2.1 AA).' },
  },

  // ── Aspect Ratios ─────────────────────────────────────────────────────────
  'aspect.16:9': {
    group:   'aspect',
    value:   '16 / 9',
    label:       { ka: 'პროპორცია 16:9', en: 'Aspect 16:9' },
    description: { ka: 'ჰორიზონტალური ეკრანი (ვიდეო სტანდარტი).',  en: 'Landscape screen (video standard).' },
  },
  'aspect.4:3': {
    group:   'aspect',
    value:   '4 / 3',
    label:       { ka: 'პროპორცია 4:3',  en: 'Aspect 4:3'  },
    description: { ka: 'კლასიკური ჰორიზონტალური პროპორცია.',       en: 'Classic landscape ratio.' },
  },
  'aspect.1:1': {
    group:   'aspect',
    value:   '1 / 1',
    label:       { ka: 'კვადრატი 1:1',   en: 'Aspect 1:1'  },
    description: { ka: 'კვადრატული პროპორცია.',                      en: 'Square aspect ratio.' },
  },
  'aspect.21:9': {
    group:   'aspect',
    value:   '21 / 9',
    label:       { ka: 'პანორამა 21:9',  en: 'Aspect 21:9' },
    description: { ka: 'ულტრა-ფართო პანორამა.',                     en: 'Ultra-wide panoramic ratio.' },
  },
  'aspect.3:2': {
    group:   'aspect',
    value:   '3 / 2',
    label:       { ka: 'პროპორცია 3:2',  en: 'Aspect 3:2'  },
    description: { ka: 'ფოტოგრაფიის სტანდარტი.',                   en: 'Photography standard ratio.' },
  },

  // ── Breakpoints (6-point scale — keep in sync with BREAKPOINTS) ─────────────
  'breakpoints.xs': {
    group:   'breakpoints',
    value:   480,
    label:       { ka: 'გარდატეხი XS', en: 'Breakpoint XS' },
    description: { ka: 'პატარა მობილური (480px).',   en: 'Small mobile threshold (480px).' },
  },
  'breakpoints.sm': {
    group:   'breakpoints',
    value:   640,
    label:       { ka: 'გარდატეხი SM', en: 'Breakpoint SM' },
    description: { ka: 'დიდი მობილური (640px).',  en: 'Large mobile threshold (640px).' },
  },
  'breakpoints.md': {
    group:   'breakpoints',
    value:   768,
    label:       { ka: 'გარდატეხი MD', en: 'Breakpoint MD' },
    description: { ka: 'ტაბლეტი (768px).',  en: 'Tablet threshold (768px).' },
  },
  'breakpoints.lg': {
    group:   'breakpoints',
    value:   1024,
    label:       { ka: 'გარდატეხი LG', en: 'Breakpoint LG' },
    description: { ka: 'ლეპტოპი — სტატისტიკის ძირითადი სამიზნე (1024px).', en: 'Laptop — primary stats target (1024px).' },
  },
  'breakpoints.xl': {
    group:   'breakpoints',
    value:   1280,
    label:       { ka: 'გარდატეხი XL', en: 'Breakpoint XL' },
    description: { ka: 'ფართო ეკრანი (1280px).', en: 'Wide desktop threshold (1280px).' },
  },
  'breakpoints.2xl': {
    group:   'breakpoints',
    value:   1536,
    label:       { ka: 'გარდატეხი 2XL', en: 'Breakpoint 2XL' },
    description: { ka: 'დიდი მონიტორი (1536px).', en: 'Large monitor threshold (1536px).' },
  },
}
