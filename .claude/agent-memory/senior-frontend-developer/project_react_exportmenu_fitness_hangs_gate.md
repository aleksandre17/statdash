---
name: react-exportmenu-fitness-hangs-gate
description: packages/react vitest full-suite HANGS on components/feedback/exportMenu.fitness.test.tsx in the main-checkout runner — run react gates targeted, not whole-suite
metadata:
  type: project
---

Running the WHOLE `packages/react` vitest suite via the main-checkout runner
(`platform/packages/react && ../../node_modules/.bin/vitest run`) hangs with ZERO
output — it never reaches the summary. Isolated to a single file:
`src/components/feedback/exportMenu.fitness.test.tsx` (times out even alone;
every other component/hook file passes in seconds).

**Why:** Present before any of my edits — it hung on the first whole-suite run.
Not load (the plugins suite = 65 files / 493 tests finishes in ~29s). It is a
pre-existing env-specific hang in that one fitness file, unrelated to collapse /
PanelLayout / useCollapsible work.

**How to apply:** For a `packages/react` gate, DON'T run the whole suite — run the
directories/files you touched (`vitest run src/components src/engine/hooks …`) or
name files explicitly. Treat a whole-suite timeout as this known file, not a
regression: confirm your own touched files pass in isolation + tsc is clean. See
[[worktree-edit-maincheckout-runner]] for the copy-to-main gate workflow.
`--reporter=basic` does NOT exist in vitest 4 (throws a custom-reporter load
error) — use the default reporter.
