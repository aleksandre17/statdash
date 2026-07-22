---
name: css-fitness-comment-stripping-gotcha
description: block-scanning parseBlockAt() regexes in tokens.parity.test.ts/tenant-theme.fitness.test.ts MUST strip CSS comments first — a rationale comment naming a token followed by a colon is shaped like a real declaration and produces a false-positive parsed entry
metadata:
  type: project
---

Found live while adding `PINNED_NO_FLIP` to `packages/styles/src/tokens.parity.test.ts` (FF-DARK-COMPLETE) and writing `apps/geostat/src/shared/styles/tenant-theme.fitness.test.ts`.

**The bug:** every `parseBlockAt(from)` helper in these files (and the original, still-present ones) does a brace-depth walk to slice a `{...}` block, then runs `/(--[\w-]+)\s*:\s*([^;]+);/g` over the RAW block text — including comments. A rationale comment of the natural form `/* --color-foo: deliberately not overridden — because … */` is shaped exactly like a real declaration: the regex matches `--color-foo:`, then the value-group `[^;]+` (greedy) consumes everything — the rest of the comment, blank lines, the NEXT comment block — until it hits the first REAL semicolon anywhere downstream, splicing a bogus map entry with garbage content. Concretely: a comment documenting the REMOVAL of `--color-breadcrumb-separator` made the parser believe that property was still declared, producing a false "missing from dark block" failure.

**Why it went undetected for so long:** the pre-existing comments in `tokens.css` never happened to write a token name immediately followed by a colon in prose — until a comment needed to say "this role is intentionally not overridden" using the SAME shape as a declaration.

**Fix (apply everywhere this pattern exists):** strip block comments to spaces BEFORE any block/regex scan, preserving line structure so brace-depth walks + line numbers stay valid:
```js
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
```
This is the SAME technique `packages/plugins/__tests__/no-unthemed-color.fitness.test.ts` already used (its `scan()` does this) — the other two CSS-fitness files just hadn't needed it yet. Fixed in `tokens.parity.test.ts` (all 4 `readFileSync(cssPath)` call sites that do block/value parsing — the simple line-anchored `extractRootDefinitions` at the top is safe by construction since it requires `--` at the START of a line, not after `/* `) and in the new `tenant-theme.fitness.test.ts`.

**How to apply:** ANY new CSS fitness function that parses a `{...}` block for `--prop: value;` pairs (not just a line-anchored existence check) MUST strip comments first. Caught this by NOT trusting the vitest CLI's green/red (it was environmentally blocked — see [[project_windows_longpath_vitest_worktree_block]]) and instead hand-replicating the exact parsing logic in a throwaway Node script to verify the new fitness's own assertions before trusting them.

**Sibling blind spot — a `?raw` CSS scan can be vacuous under vitest.**
`platform/apps/panel/src/studio/chromeTokenDriven.fitness.test.ts` scans Studio chrome frame
sources for hardcoded brand color literals via `import.meta.glob(..., {query:'?raw'})`. Its 4
`.tsx` sources scan correctly, but `studio.css` resolves to `''` under vitest (see
[[reference_panel_dev_notes]]), so `findBrandColorLiterals(studio.css)` passes vacuously on
empty content — a real hardcoded hex planted in `studio.css` would NOT fail the gate (the
`.toHaveLength(5)` key-count still holds; only the content goes unchecked). Not urgent (also
caught by review + the `.tsx` sources are genuinely scanned) — flagged for whoever hardens the
token-driven invariant: move the CSS leg off `?raw` (a build-step disk scan, or enable vitest CSS
processing for this one test).
