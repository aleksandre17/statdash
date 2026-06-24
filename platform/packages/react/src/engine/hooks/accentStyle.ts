// ── accentStyle — per-node accent override of the `--sc` cascade ──────
//
//  Generic projection of a node's authored `color` into a local `--sc`
//  custom-property override. `--sc` is normally set once at the page
//  wrapper (the presentation projector maps page color → `--sc`); any node
//  may override it locally via its own `color` so its accent bar / label /
//  active toggle pick up that node's colour.
//
//  Returns `undefined` when no override is authored, so the page cascade
//  wins. App-agnostic and node-agnostic — reusable by any shell.
//
//  Lives in @statdash/react (not @statdash/styles) because it projects to a
//  React CSSProperties style object; @statdash/styles is deliberately
//  React-free (its resolvers return plain attribute records).
//
//  NOTE: this is an intentional *local* override and does not route through
//  the page presentation projector. If a node's colour ever needs to
//  participate in the same projection pipeline as page colour, unify it
//  there — out of scope here.
//

import type { CSSProperties } from 'react'

export function accentStyle(color: string | undefined): CSSProperties | undefined {
  return color ? ({ '--sc': color } as CSSProperties) : undefined
}
