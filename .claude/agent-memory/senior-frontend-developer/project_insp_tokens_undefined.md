---
name: project-insp-tokens-undefined
description: The inspector's native controls are OFF the DTCG token spine — --insp-* vars are undefined, so they render on hardcoded hex fallbacks (dark-mode-broken)
metadata:
  type: project
---

The inspector's control CSS (`apps/panel/src/inspector/Inspector.css`) paints via
`var(--insp-border, #cbd5e1)`, `var(--insp-control-bg, #fff)`, `var(--insp-fg, #1e293b)`,
`var(--insp-focus, #2563eb)`, `var(--insp-font-sm, 0.8125rem)` etc. — but **NONE of the
`--insp-*` tokens are defined anywhere** (grep is empty). So every native control renders on
its HARDCODED hex fallback, off the DTCG spine: it cannot flip in dark mode or per tenant.

**Why:** This is the exact "control that only works in the mode it was verified in" defect class
that `FF-NO-UNTHEMED-COLOR` (`packages/plugins/__tests__/no-unthemed-color.fitness.test.ts`)
exists to catch — but that gate scans `packages/plugins/**` + `packages/react/src/**` ONLY, not
`apps/panel/**`, so the inspector's erosion is unguarded.

**How to apply:** When touching inspector control paint, do NOT extend the `--insp-*` fallback
pattern — bind directly to the global DTCG tokens (`--color-border`, `--color-surface`,
`--color-text-primary`, `--font-size-sm`=0.8125rem which matches the current fallback, `--radius-sm`,
`--spacing-*`). The owned Radix `Select` (see [[project-mui-radix-migration]]) already does this and
is therefore dark-mode-correct while the surrounding native controls are not. A proper fix is either
(a) define `--insp-*` as aliases onto the global tokens in one `:root` block, or (b) extend
FF-NO-UNTHEMED-COLOR to scan `apps/panel/**`. Flag to the architect before a broad inspector re-paint.
