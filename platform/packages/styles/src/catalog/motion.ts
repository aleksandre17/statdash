// ── @statdash/styles — Motion token descriptors ────────────────────────────────
// Transition (shorthand) · duration · easing.

import type { TokenDescriptor } from './types'

export const MOTION_TOKENS: Record<string, TokenDescriptor> = {

  // ── Transition (shorthand — kept for back-compat) ───────────────────────────
  'transition.none': {
    group:   'transition',
    value:   'none',
    label:       { ka: 'ანიმაცია გარეშე', en: 'No Transition' },
    description: { ka: 'ანიმაციის გარეშე — ხელმისაწვდომობის რეჟიმი.',  en: 'No animation — for reduced-motion or instant feedback.' },
  },
  'transition.fast': {
    group:   'transition',
    cssVar:  'var(--transition-fast)',
    label:       { ka: 'სწრაფი',  en: 'Fast Transition'   },
    description: { ka: 'სწრაფი გადასვლა (ინტერაქციებისთვის).',  en: 'Fast transition (for interactive feedback).' },
  },
  'transition.smooth': {
    group:   'transition',
    cssVar:  'var(--transition-smooth)',
    label:       { ka: 'გლუვი',   en: 'Smooth Transition' },
    description: { ka: 'გლუვი ნაგულისხმევი გადასვლა.',          en: 'Smooth default transition.' },
  },
  'transition.slow': {
    group:   'transition',
    cssVar:  'var(--transition-slow)',
    label:       { ka: 'ნელი',    en: 'Slow Transition'   },
    description: { ka: 'ნელი გადასვლა (გვერდების ან მოდალების ანიმაციისთვის).', en: 'Slow transition (for page or modal animations).' },
  },

  // ── Duration (composable with easing) ───────────────────────────────────────
  'duration.instant': {
    group:   'duration',
    cssVar:  'var(--duration-instant)',
    label:       { ka: 'მყისიერი', en: 'Instant' },
    description: { ka: 'ხანგრძლივობის გარეშე (0ms).', en: 'No duration (0ms).' },
  },
  'duration.fast': {
    group:   'duration',
    cssVar:  'var(--duration-fast)',
    label:       { ka: 'სწრაფი', en: 'Fast' },
    description: { ka: 'სწრაფი ხანგრძლივობა (100ms).', en: 'Fast duration (100ms).' },
  },
  'duration.normal': {
    group:   'duration',
    cssVar:  'var(--duration-normal)',
    label:       { ka: 'ნორმალური', en: 'Normal' },
    description: { ka: 'ნაგულისხმევი ხანგრძლივობა (200ms).', en: 'Default duration (200ms).' },
  },
  'duration.slow': {
    group:   'duration',
    cssVar:  'var(--duration-slow)',
    label:       { ka: 'ნელი', en: 'Slow' },
    description: { ka: 'ნელი ხანგრძლივობა (400ms).', en: 'Slow duration (400ms).' },
  },
  'duration.slower': {
    group:   'duration',
    cssVar:  'var(--duration-slower)',
    label:       { ka: 'უფრო ნელი', en: 'Slower' },
    description: { ka: 'ძალიან ნელი ხანგრძლივობა (700ms).', en: 'Slower duration (700ms).' },
  },

  // ── Easing curves ───────────────────────────────────────────────────────────
  'easing.linear': {
    group:   'easing',
    cssVar:  'var(--easing-linear)',
    label:       { ka: 'წრფივი', en: 'Linear' },
    description: { ka: 'წრფივი დაჩქარება.', en: 'Linear easing.' },
  },
  'easing.ease-in': {
    group:   'easing',
    cssVar:  'var(--easing-ease-in)',
    label:       { ka: 'შესვლა', en: 'Ease In' },
    description: { ka: 'ნელი დასაწყისი.', en: 'Accelerating from zero (ease-in).' },
  },
  'easing.ease-out': {
    group:   'easing',
    cssVar:  'var(--easing-ease-out)',
    label:       { ka: 'გამოსვლა', en: 'Ease Out' },
    description: { ka: 'ნელი დასასრული.', en: 'Decelerating to zero (ease-out).' },
  },
  'easing.ease-in-out': {
    group:   'easing',
    cssVar:  'var(--easing-ease-in-out)',
    label:       { ka: 'შესვლა-გამოსვლა', en: 'Ease In-Out' },
    description: { ka: 'ნელი დასაწყისი და დასასრული.', en: 'Accelerate then decelerate (ease-in-out).' },
  },
  'easing.spring': {
    group:   'easing',
    cssVar:  'var(--easing-spring)',
    label:       { ka: 'ზამბარა', en: 'Spring' },
    description: { ka: 'ზამბარისებრი გადაჭარბება.', en: 'Spring overshoot curve.' },
  },
  'easing.bounce': {
    group:   'easing',
    cssVar:  'var(--easing-bounce)',
    label:       { ka: 'ახტომა', en: 'Bounce' },
    description: { ka: 'ახტომისებრი გადაჭარბება.', en: 'Bounce overshoot curve.' },
  },
}
