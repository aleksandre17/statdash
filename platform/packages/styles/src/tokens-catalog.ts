// ── @statdash/styles — Token capability catalog ────────────────────────────────
// Consumed by Panel's style token picker UI. NOT META.
// Pattern: Self-Describing Module (same as ops-catalog in @statdash/expr).
//
// Composed from per-concern slices (one-body hygiene):
//   layout · primitives · motion · typography · color · data-color.
// Add a new token group = add a slice + spread it here — open for extension.

import type { TokenDescriptor } from './catalog/types'
import { LAYOUT_TOKENS }        from './catalog/layout'
import { PRIMITIVE_TOKENS }     from './catalog/primitives'
import { MOTION_TOKENS }        from './catalog/motion'
import { TYPOGRAPHY_TOKENS }    from './catalog/typography'
import { COLOR_TOKENS }         from './catalog/color'
import { DATA_COLOR_TOKENS }    from './catalog/data-color'

export type { TokenGroup, TokenDescriptor } from './catalog/types'

export const TOKENS_CATALOG: Record<string, TokenDescriptor> = {
  ...LAYOUT_TOKENS,
  ...PRIMITIVE_TOKENS,
  ...MOTION_TOKENS,
  ...TYPOGRAPHY_TOKENS,
  ...COLOR_TOKENS,
  ...DATA_COLOR_TOKENS,
}
