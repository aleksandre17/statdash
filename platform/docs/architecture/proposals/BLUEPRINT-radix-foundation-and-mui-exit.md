# BLUEPRINT — Radix component-foundation + the MUI exit (Strangler, fused with the re-lay)

> Status: decision-grade, buildable. Owner-decided direction (MUI → Radix headless primitives on the DTCG token spine, Stage-3 P-SCALE). This doc is the **HOW**: the canonical foundation pattern + the Strangler exit path. NO teardown, NO big-bang. Not a go/no-go.
> Scope: read-only design. No code changes accompany this doc. ADR-041/042 are not reopened.
> Benchmarks: Radix Primitives, React Aria, Headless UI, shadcn/ui (the canonical Radix + token + compound-component exemplar).

---

## 0. Verdict (read this first)

The migration is reachable as a **coherent Strangler on an already-settled substrate**, not a rewrite. The expensive, agnostic half — the DTCG token spine — **already exists and is already shared** (`packages/styles`: `tokens.css` `:root`, `SPACING/COLOR/RADII/…`, `buildThemeVars`/`cssVarName`). MUI is not a second styling system; it is a *projection* of that spine via one alias block (`apps/panel/src/studio/muiTheme.ts` → `MUI_TOKEN_ALIASES`). Radix binds to the **same** vars directly through CSS + its data-attributes. Because both frameworks read one source of truth, MUI and Radix **coexist with zero dual-theming clash** — a Style-editor edit moves both simultaneously, by pure CSS cascade.

What is left to build is only the thin, owned **component layer** between the primitive and the token: unstyled Radix behavior + DTCG-token CSS = our own compound component. We stand that layer up once (worked example: Select), prove it swaps invisibly behind the existing OCP seam (`FieldControlRegistry`), and then **each surface migrates as the re-lay/craft touches it** — never a dedicated migration project.

**First build motion:** the inspector's control primitives — replace the weak native `<select>` (`primitives.tsx::SelectControl`) and the 6 MUI-`Select` inspector files with one owned Radix `Select`, so Step-2 craft lands ON Radix, not on MUI. The `FieldControlRegistry` never changes — that is the proof the seam is sound.

---

## 1. The component-foundation pattern

**The law (one sentence):** an owned component is *Radix behavior + DTCG-token CSS + a compound API* — the primitive supplies the WAI-ARIA behavior we must never re-implement, our CSS supplies the paint (tokens only), and the compound API is our owned, MUI-free surface. Each owned component is a **bounded element** that hides which primitive it wraps; consumers see our API, never `@radix-ui/*`.

Four rules make it canonical:

1. **Home = `packages/react/src/components/ui/` (agnostic, reusable).** The primitives sit beside the existing generic renderers (`PropSchemaForm`, `PanelLayout`) — the same family. Living in `packages/react` (not `apps/panel`) is what **resolves the H5 agnosticism debt at the root**: a second tenant (geostat runner chrome, `packages/plugins` chrome) reuses and restyles them for free. Radix becomes a dependency of `packages/react`, which is legitimate — Radix primitives are app-agnostic behavior, and `packages/react` is exactly the app-agnostic React-adapter layer.
   - *Trade-off named:* the alternative is a dedicated `packages/ui` leaf package (arrow: `styles ← ui ← react`). Rejected for now under YAGNI — a new package is warranted only once a non-React consumer or independent release cadence appears. **Deferred decision, named:** promote `components/ui/` → `packages/ui` when the *second framework-external consumer* arrives; until then the folder boundary is enough.
   - *Also rejected:* `apps/panel/src/ui/` (app-local) — fastest bridgehead but re-freezes the agnosticism debt the whole migration exists to pay down. The tokens are already shared; the wrappers must be too.

2. **Token-binding rule (the styling contract).** A Radix part is painted **only** by DTCG token vars, in a CSS `@layer components` rule that selects on the part's own class + the primitive's data-attributes (`[data-state]`, `[data-highlighted]`, `[data-disabled]`, `[data-side]`). **No** hardcoded color/space, **no** `@emotion`, **no** `sx`, **no** inline hex. State comes from Radix as data-attributes; we never track open/hover/selected in React just to style it. This matches the existing `.insp-field__*` CSS convention and requires **no new styling runtime** (no Tailwind runtime, no `cva`) — killing `@emotion` at exit is a *goal*, so we do not add a replacement CSS-in-JS.
   - Fitness: **`FF-RADIX-TOKEN-ONLY`** — a `.ui-*` CSS rule may reference `var(--…)` / token constants only; a raw hex, rgb(), or px color in `components/ui/**` fails. (Extends the existing `no-unthemed-color.fitness.test.ts`.)

3. **The a11y / WAI-ARIA contract.** Radix ships the APG pattern complete (roving tabindex, `aria-activedescendant`, typeahead, focus trap/return, escape/outside-dismiss). Our contract: **style only, never override semantics.** We do not spread arbitrary props over a primitive part in a way that can clobber `role`/`aria-*`; we forward `ref` and our className, nothing that fights the primitive. This *raises* the a11y floor above today's native `<select>` (which cannot be styled) and above MUI (Project Law 9 / WCAG 2.1 AA held, now with a craftable listbox).
   - Fitness: **`FF-RADIX-A11Y-INTACT`** — owned components render their primitive's role and are keyboard-operable in jsdom (test asserts `role`, arrow-key highlight, `Enter`/`Escape`).

4. **Composition = compound API + `Slot`/`asChild`.** The owned component is a namespaced compound (`Select.Root/Trigger/Content/Item`), so the caller composes parts rather than passing a prop matrix. Polymorphism uses Radix `Slot` (`asChild`) — e.g. an owned `Button` renders as an `<a>` without a variant explosion. This is the derive-from-declaration ideal at the component scale: the *renderer is generic over parts*, no `if type ===` inside the component.

### Worked example — `Select` (the live craft offender), end to end

Anatomy (owned compound over `@radix-ui/react-select`):

```
packages/react/src/components/ui/select/
  Select.tsx        // re-exports Radix Root/Value/Portal wired to our parts
  Select.css        // @layer components — .ui-select__{trigger,content,item,indicator}
```

- `Select.Root` — controlled: `value` in, `onValueChange` out (identical contract to today's `SelectControl`).
- `Select.Trigger` (`.ui-select__trigger`) — paints from `--color-surface-raised`, `--color-border`, `--color-text-primary`, `--radii-*`, `--spacing-*`; focus ring from `--color-accent`.
- `Select.Content` — **portalled** to body (like MUI menus today); `z-index: var(--z-index-…)`; the DTCG alias means the portalled surface tracks live theme edits, exactly as the MUI portal note in `muiTheme.ts` already relies on.
- `Select.Item` (`.ui-select__item[data-highlighted]`) — highlight from `--color-accent-bg`, selected check from `--color-accent`.

**Where it plugs in (the OCP proof):** `primitives.tsx::SelectControl` is re-implemented on the owned `Select` — same `value/onChange/options/field` props. `FieldControlRegistry.ts` is **not touched**: it still resolves `field.options → SelectControl` (precedence step 3). One control-body swap, registry-invisible. That is the whole migration in miniature — *architecture leads, the control body follows.*

**Coexistence during the swap:** the owned `Select` reads `--color-*` directly; MUI still reads the same vars via `muiAliasVars`. No selector collision (our classes are `.ui-select__*`, MUI's are `.Mui*` on different elements), no theme fork. Both live in the same `ThemeProvider` scope until the last MUI file leaves.

---

## 2. MUI → Radix parity map (`apps/panel`, ranked by real usage)

Grepped counts from `apps/panel/src` (import sites). The sharp architectural cut: **Radix owns *behavior*; it does not own *layout/typography*.** Layout primitives migrate to token-bound owned elements, not to Radix.

### A. Behavioral / interactive → **Radix Primitives** (the real migration)

| MUI (uses) | Radix replacement | Size | Note |
|---|---|---|---|
| `Select` (6) + native `<select>` in `primitives.tsx` | `@radix-ui/react-select` | **M** | Most-used interactive; the live offender. First move. |
| `ToggleButtonGroup`/`ToggleButton` (5/5) | `@radix-ui/react-toggle-group` | S | Concentrated in the model surface (`MetricEditor`, `CalcBuilder`, `StudioTopBar`) — in-flight craft. |
| `Menu`/`MenuItem` (—/6) | `@radix-ui/react-dropdown-menu` | S | APG menu semantics. |
| `Tooltip` (6) | `@radix-ui/react-tooltip` | S | |
| `Popover` (1) | `@radix-ui/react-popover` | S | `EditPopover.tsx`. |
| `Dialog` (implied by modals) | `@radix-ui/react-dialog` | M | Focus trap + dismiss for free. |
| `Switch` (2) | `@radix-ui/react-switch` | S | |
| `Accordion`/`Summary`/`Details` (1/1/1) | `@radix-ui/react-accordion` | S | |
| `Autocomplete` (1) | **cmdk** (already a dep) or React Aria `useComboBox` | M | Radix has **no** combobox. Only 1 use → defer; reuse `cmdk` (Radix-based, already installed) rather than add React Aria now. |

### B. Form field → owned compound (thin Radix, mostly native + `react-label`)

| MUI (uses) | Owned replacement | Size | Note |
|---|---|---|---|
| `TextField` (18) | `ui/Field` = `@radix-ui/react-label` + native `input` + helper/error slot | **M** | High count; the wrapper composes Label+input+validation into one token-bound part. `primitives.tsx::TextControl/NumberControl` already native — Field standardises them. |
| `Button` (17) | `ui/Button` (owned; `@radix-ui/react-slot` for `asChild`) | S | No Radix behavior needed; token CSS + Slot polymorphism. High count → high craft visibility. |
| `IconButton` (8) | `ui/IconButton` (Button variant) | S | |
| `FormControl`/`InputLabel`/`FormControlLabel` (1/1/2) | folded into `ui/Field` | S | |
| `InputAdornment` (2) | `ui/Field` slot | S | |

### C. Layout / typography / presentational → owned token primitives (NOT Radix)

| MUI (uses) | Owned replacement | Size | Note |
|---|---|---|---|
| `Box` (50) | `ui/Box` or plain `div` + token CSS | L (count) | Mechanical sweep, low risk. Do opportunistically per surface, not up front. |
| `Typography` (37) | `ui/Text` (token font-size/weight/line-height) | L (count) | Mechanical. |
| `Stack` (9), `Divider` (12), `Paper` (4) | `ui/Stack`/`ui/Divider`/`ui/Surface` | M | |
| `Chip` (11), `Alert`/`AlertTitle` (5/1), `CircularProgress` (3), `Snackbar` (2), `Link` (2), `Breadcrumbs` (1) | owned token components | M | `Snackbar` → existing `ToastHost`; `CircularProgress` → owned spinner. |
| `CssBaseline`/`GlobalStyles` (1/2) | `packages/styles` reset + our `@layer` | S | Retired with the `ThemeProvider` at the terminal step. |

**Icons:** `@mui/icons-material` → `lucide-react` (breadth, shadcn default) or `@radix-ui/react-icons`. Presentational, low risk — swap opportunistically per surface, **off the critical path**.

---

## 3. The Strangler exit sequence — fused with the re-lay (WIP=1, waves 0071→0075)

Not a separate project. Each wave re-lays/crafts a surface; **the craft lands on Radix and retires that surface's MUI in the same wave.** Ordering = craft-visibility × usage. Coexistence holds throughout because every component (MUI or Radix) reads the one DTCG spine.

| Wave | Surface (re-lay) | Foundation built | MUI retired here | Size |
|---|---|---|---|---|
| **0071 (now)** | Inspector controls (Step-2 craft) | Stand up `components/ui/` seam + `Select` + `@layer` CSS + `FF-RADIX-*`. | `SelectControl` native `<select>`; MUI `Select` in `DataFacetField`, `EventsField`, `useRowRename`, `ValueMappingField`, `sections/builtins`, `DockBody` | M |
| **0072** | Model surface (in-flight craft) | `ToggleGroup`, `Field`, `Button`/`IconButton` | `ToggleButtonGroup`/`TextField`/`Button` in `MetricEditor`, `CalcBuilder`, `DataModelBody`, `StudioTopBar` | M |
| **0073** | Overlays (docks/popovers/dialogs) | `Popover`, `Dialog`, `DropdownMenu`, `Tooltip` | `EditPopover`, `Menu`, modal dialogs, tooltips | M |
| **0074** | Remaining feature editors + switches/accordions | `Switch`, `Accordion`; `Autocomplete`→cmdk | `Switch`, `Accordion`, `Autocomplete`, residual `TextField` | M |
| **0075 (terminal)** | Layout sweep + provider removal | `Box`/`Text`/`Stack`/`Divider`/`Surface`/`Chip`/`Alert` token primitives | last MUI files; then **remove** `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` from the catalog; delete `muiTheme.ts` + `App` `ThemeProvider` | L (count) |

**Coexistence safety (no dual-theming clash) — the invariant:**
- One source of truth: `packages/styles` `:root` tokens. MUI projects via `muiAliasVars`; Radix reads directly. Neither owns color.
- No selector collision: owned parts are `.ui-*`; MUI is `.Mui*` — different classes on different elements.
- Portal layering: both portal to `body`; z-index comes from the shared `Z_INDEX` tokens, so stacking is coordinated, not raced.
- Ordering: Radix CSS lives in `@layer components`; `@emotion` injects at document level — no cascade fight because they never target the same element.
- Fitness: **`FF-NO-NEW-MUI`** — `eslint no-restricted-imports` forbids a *new* `@mui/*` import in any file created after wave 0071 (Strangler ratchet: the count only goes down). At wave 0075 the rule flips to forbid `@mui/*` entirely.

---

## 4. The first surface to migrate now

**The inspector's controls — the live raw/weak dropdowns.** Highest craft × usage first move, and it lands Step-2's craft ON Radix rather than on MUI.

Concrete first build motion (the lead drives immediately):
1. Add the dependency (§5) to `packages/react`.
2. Create `packages/react/src/components/ui/select/{Select.tsx,Select.css}` — the worked example (§1), `@layer components`, tokens only.
3. Re-implement `apps/panel/src/inspector/controls/primitives.tsx::SelectControl` on the owned `Select`. **Do not touch `FieldControlRegistry.ts`** — same props, registry-invisible swap (the OCP proof).
4. Convert the 6 MUI-`Select` inspector files (`DataFacetField`, `EventsField`, `useRowRename`, `value-mapping/ValueMappingField`, `sections/builtins`, `sections/DockBody`).
5. Land `FF-RADIX-TOKEN-ONLY`, `FF-RADIX-A11Y-INTACT`, `FF-NO-NEW-MUI`.

Why this surface: (a) it is the exact craft offender the owner reads on screen (unstylable native popup + MUI clash); (b) it exercises the *entire* pattern (portal, data-attribute styling, compound API, token binding, OCP seam) on the most-used interactive control, so the foundation is validated before any wider commitment; (c) it is fully reversible and bounded to the inspector — a safe bridgehead.

---

## 5. Exact packages to add

Add to the **pnpm catalog** (`pnpm-workspace.yaml`), referenced as `catalog:` from `packages/react/package.json` (never pin in a leaf file — project convention).

**Primary (add now — one package):**
```
radix-ui                # unified Radix Primitives package (1.x). One version, all
                        # primitives tree-shakeable via ESM: import { Select, Dialog,
                        # Tooltip, Popover, ToggleGroup, Switch, Accordion,
                        # DropdownMenu, Label, Slot } from 'radix-ui'
```
Rationale: the unified `radix-ui` package keeps every primitive version-locked in sync (no per-primitive version drift across waves) and minimises catalog churn — current best practice, and what shadcn/ui aligns to. *Alternative (named, rejected for now):* the individual `@radix-ui/react-*` packages give finer install granularity but multiply catalog entries and risk cross-primitive version skew; adopt only if a single primitive needs an out-of-band version.

**Deferred / opportunistic (do NOT add on the critical path):**
```
lucide-react            # icon set to replace @mui/icons-material (wave 0072+, presentational)
                        #   — or @radix-ui/react-icons for a smaller set
# Autocomplete/Combobox gap: reuse the already-installed `cmdk` (Radix-based).
#   Add `react-aria-components` ONLY if a richer combobox is later required (1 use today).
```

**Explicitly NOT added:** no `@emotion/*` replacement, no Tailwind runtime, no `class-variance-authority` — styling is CSS `@layer` + DTCG tokens + Radix data-attributes. Adding a CSS-in-JS runtime would re-create the very coupling this migration removes.

**Removed at wave 0075 (terminal):** `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` from the catalog and `apps/panel/package.json`.

---

## Packet summary

- **Foundation pattern:** owned compound component = unstyled Radix behavior + DTCG-token CSS (`@layer components`, styled via the primitive's `[data-state]`/`[data-highlighted]` attributes) + a compound API using `Slot`/`asChild`; lives agnostic in `packages/react/src/components/ui/`; tokens only (no hex, no emotion, no sx); Radix supplies WAI-ARIA, we supply paint. Guards: `FF-RADIX-TOKEN-ONLY`, `FF-RADIX-A11Y-INTACT`, `FF-NO-NEW-MUI`.
- **Parity map (top):** Select→`react-select`, ToggleButtonGroup→`react-toggle-group`, Menu→`react-dropdown-menu`, Tooltip→`react-tooltip`, Popover→`react-popover`, Dialog→`react-dialog`, Switch→`react-switch`, Accordion→`react-accordion`, Autocomplete→cmdk; TextField→owned `Field` (`react-label`+native), Button/IconButton→owned `Button` (Slot); Box/Typography/Stack/Divider/Paper/Chip/Alert→owned token primitives (NOT Radix).
- **Fused exit (waves):** 0071 inspector controls (M) · 0072 model surface (M) · 0073 overlays (M) · 0074 switches/accordions/combobox (M) · 0075 layout sweep + drop MUI/emotion (L). Coexistence safe because MUI and Radix both project the one DTCG spine; ratchet = `FF-NO-NEW-MUI`.
- **First move now:** owned `Select` on `@radix-ui/react-select`, swap `primitives.tsx::SelectControl` + the 6 MUI-Select inspector files, `FieldControlRegistry` untouched (OCP proof).
- **Packages:** add `radix-ui` (unified) to the catalog, referenced from `packages/react`. Defer `lucide-react`/`cmdk`/React-Aria. Remove `@mui/*` + `@emotion/*` at wave 0075.
