# ADR-021 — Bind MUI to the DTCG token spine (CSS-variables theming)

- **Status:** Proposed (owner-in-the-loop — the "kitchen" keystone, VISION-forward-northstar §1)
- **Date:** 2026-07-10
- **Scope:** `platform/apps/panel` ONLY — apps-layer, additive, reversible. Touches **zero** packages; the dependency arrow (`contracts ← expr ← core ← charts ← react ← plugins ← apps`) is untouched.
- **Context branch:** `feat/ar49-m0-metric-first-authoring` (AR-49 Studio / Strata skin, live-verified on staging, not merged to main).
- **Relates to:** ADR-006 (semantic-token theming spine), ADR-013 (shell-variant style spine), ADR-020 (runner chrome). Companion fitness: FF-STRATA-CONTRAST, FF-CHROME-TOKEN-DRIVEN, FF-THEME-EDIT-DATA.

---

## Context (ground truth, verified in code 2026-07-10)

The panel is the AR-49 "Studio" — a metric-first authoring shell skinned as **Strata** (deep institutional azure/navy). Strata is expressed as **pure token DATA** (`src/studio/strata-preset.ts`, a `tokenKey → CSS value` map), layered over the brand-neutral `@statdash/styles` DTCG tokens (`tokens.css :root`), with `SiteDef.themeOverrides` on top. `src/studio/themeVars.ts::buildThemeVars()` composes those layers into inline CSS custom properties, currently applied **inline on the `.studio-shell` `<Box>` root** (`StudioShell.tsx:79,91`). Every chrome element and the live canvas descend from that root, so a Style-editor edit repaints by pure CSS cascade — no theme code path (Law 2).

**Confirmed defect (the claim holds).** The panel mounts **no** MUI theme: `App.tsx` renders `<CssBaseline/>` and nothing else — a repo-wide grep for `ThemeProvider|createTheme|extendTheme|CssVarsProvider` returns **zero** matches, across 67 files that import `@mui/material`. Consequently every MUI control — the ⌘K command palette, the Model/role toggle, the locale selector, page chips, every `Select`/`Chip`/`Button`/`TextField` — renders on MUI's factory default primary `#1976d2` (bright blue), which clashes hard with Strata's `#14508C` azure and is the bulk of the owner's "terrible font colors." The DTCG token DATA cannot reach MUI: MUI derives its palette (`-light`/`-dark`/`-mainChannel`, `getContrastText`) through `decomposeColor()`, and **`decomposeColor()` throws on a `var(--x)` string** — so the naive fix (`palette.primary.main = 'var(--color-accent)'`) is a hard runtime error, not merely wrong.

**MUI version:** `@mui/material ^6.0.0` (pnpm-workspace catalog) — CSS-variables theming is the **stable** `extendTheme` + `CssVarsProvider` from `@mui/material/styles` (not the v5 `experimental_` prefix).

**The scope trap (portals).** The Strata vars currently live inline on `.studio-shell`. MUI overlays — `Menu`, `Select` dropdown, `Dialog`, `Popover`, the cmdk palette overlay — render through a **portal at `document.body`, OUTSIDE `.studio-shell`**. Any token binding scoped to `.studio-shell` therefore would **not** reach portaled content, which is exactly where the palette/selects live.

---

## Decision

Introduce an **apps-only MUI theme bound to the DTCG token layer via CSS-variables theming**, in two cooperating parts, and relocate the effective-token application to the document root so portals inherit it.

### 1. A single light-scheme MUI theme, seeded from resolved HEX (never `var()`)

Build one static theme with MUI v6 `extendTheme({ colorSchemes: { light: { palette } } })` and mount `<CssVarsProvider theme={studioTheme}>` at the **App root** (wrapping login, loading, and the Studio). The palette is **seeded with resolved hex literals**, sourced from `STRATA_PRESET` for the brand keys and a small pinned set of platform-neutral defaults (surface/text/border/status) — mirrored from `tokens.css :root`, documented as **"seed only; runtime truth = the CSS-var alias (Part 2)."** Because the seed is real hex, `decomposeColor()` is happy: MUI generates a complete, valid theme (all `--mui-*` variables **and** the `-mainChannel` channels needed for alpha). This alone kills the `#1976d2` blue.

- **Single scheme (`light`) now.** The Studio is a light authoring surface; Strata pins light surfaces and FF-STRATA-CONTRAST only measures light. `tokens.css` already carries a `prefers-color-scheme: dark` block, so a `dark` scheme is a **later additive registration** aliasing the same DTCG vars — **not built now** (YAGNI, Law 8 open-for-extension).

### 2. A CSS alias layer re-points the brand `--mui-palette-*` vars at the DTCG `--color-*` vars

So the theme is not a *frozen copy* of the tokens but a *live projection* of them, add a small CSS block (apps-only, e.g. `studio.css` or a `<GlobalStyles>` co-located with the theme) that re-points the brand subset of MUI's generated variables at the DTCG variables, each with a **Strata fallback**:

```css
:root {
  --mui-palette-primary-main:         var(--color-accent, #14508C);
  --mui-palette-primary-dark:         var(--color-accent-hover, #0E3C6B);
  --mui-palette-primary-light:        var(--color-accent-bg, #E7EFF8);
  --mui-palette-primary-contrastText: var(--color-text-inverse, #FFFFFF);
  --mui-palette-secondary-main:       var(--color-accent-secondary, #2A9D8F);
  --mui-palette-text-primary:         var(--color-text-primary, #16223A);
  --mui-palette-text-secondary:       var(--color-text-secondary, #3C4A63);
  --mui-palette-text-disabled:        var(--color-text-faint, #5C6A7E);
  --mui-palette-background-default:   var(--color-surface, #FFFFFF);
  --mui-palette-background-paper:     var(--color-surface-raised, #FAFBFB);
  --mui-palette-divider:              var(--color-border, #E8EEED);
  --mui-palette-error-main:           var(--color-danger-fg, #dc2626);
  --mui-palette-success-main:         var(--status-positive-fg, #1b7a43);
  --mui-palette-warning-main:         var(--status-warning-fg, #8a5a00);
  --mui-palette-info-main:            var(--status-info-fg, #0b4a82);
}
```

The DTCG `--color-*` variables are the **live source of truth** (Strata preset + `themeOverrides`), so once bound, MUI's **solid fills** (buttons, chips, selected states, links) track a live Style-editor edit through pure CSS cascade — exactly like the existing chrome. `decomposeColor()` is never invoked on a `var()` because it ran only at seed time (Part 1) on hex; the alias is a plain CSS assignment the browser resolves. The fallback keeps the theme Strata-correct **before** the lazy `@statdash/styles` CSS chunk loads (during the boot spinner) and in jsdom/SSR.

### 3. Relocate the effective-token application from `.studio-shell` to the document root

For the `:root` aliases to resolve to **Strata** (not the brand-neutral `#3d5470` default) **and** to reach **portaled** MUI overlays, apply `buildThemeVars(STRATA_PRESET, site.themeOverrides)` to `document.documentElement` (via a `<GlobalStyles styles={{ ':root': vars }}/>` or a one-line effect writing the properties), instead of inline on the `.studio-shell` `<Box>`. This is a **strict superset**: the shell is a descendant of `:root`, so all existing `.studio-shell` chrome CSS still inherits identically; the canvas still inherits; and now `document.body` portals inherit too. FF-STRATA-CONTRAST is unaffected (it computes from the data map, not from where vars mount).

---

## The `alpha()` / `var()` pitfall — and why CSS-vars theming avoids it

MUI's palette augmentation (`createTheme`/`extendTheme` → `augmentColor`) computes `light`/`dark`/`mainChannel`/`contrastText` from each `main` value via `lighten()`/`darken()`/`getContrastText()`, all of which call **`decomposeColor()`** — a parser that only understands real color syntaxes (`#hex`, `rgb()`, `hsl()`). Handed the string `'var(--color-accent)'`, it throws `Unsupported 'var(--color-accent)' color`. This kills the naive "just put the CSS variable in the palette" approach at module-eval time, before a single control renders.

CSS-variables theming sidesteps it by **splitting the two concerns MUI conflates**:

1. **Derivation happens once, on hex** (Part 1 seed) — `decomposeColor()` only ever sees literals, so it never throws and the derived channels are valid.
2. **Runtime color resolution happens in the browser's CSS engine, not in JS** (Part 2 alias) — `--mui-palette-primary-main: var(--color-accent)` is resolved by the cascade, which handles `var()` natively and re-resolves it live when the referenced variable changes. No JS parser is in that path.

That separation is the whole reason CSS-vars theming is the correct fix and the classic `ThemeProvider`+`createTheme` approach is not: `createTheme` bakes final hex into the JS theme object (a frozen copy — a live token edit can't reach it without recreating the theme), whereas `CssVarsProvider` emits **indirection** (`--mui-*` variables) that we can alias to *our* variables.

---

## Token → palette mapping table

| MUI palette slot | DTCG token (live source) | Strata seed (Part 1, hex) | Notes |
|---|---|---|---|
| `primary.main` | `color.accent` | `#14508C` | the azure identity — replaces `#1976d2` |
| `primary.dark` | `color.accent-hover` | `#0E3C6B` | hover/active |
| `primary.light` | `color.accent-bg` | `#E7EFF8` | soft tint (selected surfaces) |
| `primary.contrastText` | `color.text-inverse` | `#FFFFFF` | white on azure — AA ✓ |
| `secondary.main` | `color.accent-secondary` | `#2A9D8F` | teal — **fill, not small text** (see risk) |
| `text.primary` | `color.text-primary` | `#16223A` | navy-slate body |
| `text.secondary` | `color.text-secondary` | `#3C4A63` | |
| `text.disabled` | `color.text-faint` | `#5C6A7E` | kept ≥4.5 (real text) |
| `background.default` | `color.surface` | `#FFFFFF` | |
| `background.paper` | `color.surface-raised` | `#FAFBFB` | menus, cards, dialogs |
| `divider` | `color.border` | `#E8EEED` | |
| `error.main` | `color.danger-fg` | `#dc2626` | |
| `success.main` | `status.positive-fg` | `#1b7a43` | |
| `warning.main` | `status.warning-fg` | `#8a5a00` | |
| `info.main` | `status.info-fg` | `#0b4a82` | |
| `shape.borderRadius` | `radii.card` | `10` (px number) | crisper Strata radius |

The mapping table is the **single authored artifact**; the tokenKey ⇄ `--css-var` translation reuses `themeVars.ts::cssVarName()` (self-describing `TOKENS_CATALOG.cssVar`), so a renamed token surfaces in one place.

---

## Mount point

`<CssVarsProvider theme={studioTheme}>` wraps the **entire `App` return** (above `<CssBaseline/>`), so login + loading spinner + Studio are all themed and there is exactly one provider. `studioTheme` is a **module-level constant** (no store dependency) — Part 2's CSS alias, not a React recompute, is what carries live edits, so the provider never needs to re-render on a theme change. The effective-token block (Part 3) mounts at `document.documentElement`.

---

## Fitness guard — FF-MUI-THEME-BOUND (proposal)

A future edit that unbinds MUI from the tokens (deletes the provider, reverts to default blue, or drops an alias) must fail CI. Proposed assertions (apps/panel test, mirrors FF-STRATA-CONTRAST's data-first style):

1. **Not-the-default-blue:** `studioTheme.colorSchemes.light.palette.primary.main !== '#1976d2'` **and** `=== STRATA_PRESET['color.accent']`. Guards the seed silently reverting.
2. **Alias coverage:** export the alias map as data; assert it covers a required brand set (`primary.main/dark/light/contrastText`, `secondary.main`, `text.primary/secondary`, `background.default/paper`, `divider`, `error.main`) and that **every** referenced `var(--…)` resolves to a real `TOKENS_CATALOG` key (or a known `--status-*`/`--color-*` from `tokens.css`). Guards an alias drifting off the token spine.
3. **Provider mounted:** a smoke render of `<App/>` asserts a `CssVarsProvider` is in the tree (MUI color-scheme attribute / `--mui-*` presence). Guards someone deleting the provider.

(FF-CHROME-TOKEN-DRIVEN's known toothlessness — vitest strips CSS `?raw` — means guard #2 must read the alias map from a **TS module export**, not by scanning `.css`.)

---

## Consequences

**Gained** (ISO 25010): *usability* (one coherent Strata identity across chrome + MUI + canvas; the blue clash and the discoverability regression it caused both resolve), *maintainability* (tokens stay the SSOT; MUI is a derived projection, not a parallel config), *compatibility* (insulates the future MUI→Radix/React-Aria Strangler — the token layer is the seam, so a control-library swap changes *renderers*, not the token contract).

**Cost / trade-offs (named):**
- **Alpha-tint staleness on live edit.** MUI's alpha overlays (hover ripples, focus tints) read `--mui-palette-primary-mainChannel` (space-separated RGB), which stays at the **seeded** value; a live accent edit updates solid fills immediately but the derived hover-tint channel is stale until reload. Bounded and cosmetic — the initial and steady-state render is Strata-correct because seeded from Strata. Making channels live would require adding a `--color-accent-channel` DTCG token, which is a **packages** edit and out of this apps-only scope — deferred until/unless the staleness is felt.
- **One existing-behavior change:** theme vars move from `.studio-shell` inline to `:root`. Necessary for portal correctness; strict superset; guarded by FF-STRATA-CONTRAST.
- **Seed duplication:** a handful of neutral hex literals are pinned in the theme module as the seed. Mitigated by the "seed only; runtime truth = alias" doctrine and by pulling brand seeds from `STRATA_PRESET` (not re-typed).

**Rejected alternatives:**
- **A. `createTheme` + `ThemeProvider` with baked hex** — bakes a frozen copy; a live Style-editor edit cannot reach it without recreating the theme object on every keystroke; and it does not join the existing CSS cascade. Rejected: breaks Law 2 (theme becomes a code path, not data).
- **B. `palette.primary.main = 'var(--color-accent)'`** — the naive fix; `decomposeColor()` throws at eval. Rejected: does not run.
- **C. Keep vars on `.studio-shell`, pass `container` to every MUI portal** — fragile (every `Menu`/`Select`/`Dialog`/`Popover`/palette must opt in; one miss = a blue leak in an overlay). Rejected: not data-driven, high regression surface.
- **D. Reactive `useMemo(extendTheme(seedFromEffectiveTokens))`** — recompute the whole theme on every token change by reading effective values via `getComputedStyle`. Correct channels, but imperative DOM reads, requires the shell mounted + CSS loaded, and re-emits all `--mui-*` on every keystroke. Rejected as heavier than the CSS-alias cascade for a marginal (alpha-channel) gain; retained as the escalation path **if** alpha staleness ever matters.

---

## One-way doors / owner sign-off

None of this is a hard one-way door — `CssVarsProvider` is a provider + a theme object; removing it reverts. Three items for the owner to bless:

1. **Single light scheme, no dark mode in the Studio yet** (YAGNI). Dark is a later additive scheme aliasing the same tokens. *Confirm we are not shipping Studio dark mode now.*
2. **The MUI→Radix/React-Aria Strangler is NOT foreclosed** — this ADR is a *stepping stone*: binding MUI to the token spine is exactly the insulation that later lets a headless control library drop in behind the same tokens (VISION-forward-northstar §7). *Confirm intent to keep that future open.*
3. **Minor legibility check:** `secondary.main` (teal `#2A9D8F`) is a *fill*, not a small-text role (3.3:1 on white — clears the 1.4.11 non-text floor, fails body-text AA). MUI's `getContrastText` will pick a contrast label for any teal-filled button; the QC/Playwright pass should verify no teal-on-teal small text ships. *Low risk, verify in the browser.*
