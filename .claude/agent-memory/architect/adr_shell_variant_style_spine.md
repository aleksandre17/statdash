---
name: adr-shell-variant-style-spine
description: ADR — declarative variant + scoped-style spine for the ~35-shell layer; kill hand-coded BEM modifier strings + inline variant→class logic via a VariantProjector registry that emits data-attrs (mirrors PresentationProjector + resolveViewState); meta-declared variants → PropSchema → Constructor; FF-NO-VARIANT-CLASS; CSS-attr scoping over CSS-Modules; P0–P6 Strangler-Fig
metadata:
  type: project
---

# ADR — Declarative Variant + Scoped-Style Spine for the Shell Layer

**Status:** Proposed (design-only). **Date:** 2026-06-24. Supersedes the hand-coded `className` idiom across `packages/plugins/{nodes,panels,chrome,pages}/**/*Shell.tsx`.
Relates to: [[adr_semantic_token_theming_spine]] (the `--sc`/`[data-tenant]` cascade this composes with), [[adr_no_privileged_element_capability_nav]] (same "registry kills the hardcode" reshape), [[adr_element_config_schema_seam]] (per-slice schema, no shared-base bloat).

## Context — the real gap, not the surface symptom

Canonical offender `nodes/section/default/SectionShell.tsx:95-99`:
```ts
const sectionClass = [
  'section',
  view.hero      && 'section--hero',
  merged.compact && 'section--compact',
].filter(Boolean).join(' ')
```
And `hero/default/HeroShell.tsx:41`: `className={\`hero-card${activeCard === index ? ' is-active' : ''}\`}`.

Three distinct defects compound here:
1. **Magic BEM modifier STRINGS** hand-written in TSX (`'section'`, `'section--hero'`, `'section__body'`, `'section__view'`…). Untyped, globally-scoped, no compile-time `.tsx`↔`.css` link, refactor-fragile (rename the CSS rule → silent dead string). This is the named anti-pattern Magic Strings (§3) + Shotgun-Surgery risk.
2. **variant→class logic INLINE per shell** (`view.hero && 'section--hero'`). Imperative, duplicated across the ~35 shells, NOT declarative, NOT Constructor-authorable, NOT schema-validated. A function/ternary computing presentation in a shell is the same category of violation as logic-in-config (Law 2, inverted).
3. **Variants are undeclared.** `hero`/`compact` live as loose booleans on `ViewParams` (`react/src/engine/types/node.ts:45,48`), surfaced via `merged`, but a section's *own* modifiers (and every other shell's) are nowhere declared — so the Constructor cannot discover, author, or validate them.

**The decisive observation:** the platform ALREADY solved this exact shape twice, and the shell layer simply never adopted it:
- **`resolveViewState(hidden) → { 'data-view': 'hidden'|'visible' }`** (`styles/src/resolvers/view.ts`) — a boolean becomes a **data-attribute**, CSS reads `[data-view]`, the shell spreads attrs and writes ZERO class logic. Already the idiom for `data-layout`, `data-dir`, `data-frame`, `data-height`, `data-aspect`, `data-hover/focus/active` (`resolvers/node.ts`).
- **`PresentationProjector`** (`react/src/engine/presentation/`) — a registered capability that declares `key + schema()` (Constructor-authorable PropFields), `evaluate()`, and `project()` into a sink; the renderer is a **generic visitor** (`projectPresentation`) that names no concern; `presentationPropSchema()` is the union of registered schemas feeding the Constructor; `presentation.fitness.test.ts` makes "renderer names no concern" un-regressable.

The variant problem is **the PresentationProjector pattern applied at node scope, with `resolveViewState`'s data-attr target.** This is not a new system — it is finishing the spine the codebase already chose. (Law 7: architecture leads; the shells migrate to the existing pattern.)

## Decision

Introduce a **declarative variant capability** with three parts, all reusing existing machinery:

### 1. Variants are DECLARED in node META (Constructor-authorable, schema-validated)

A slice declares its variants in META as a typed map — the variant's name, its authored type (boolean toggle or enum), and the **data-attribute** it projects to. NOT in the shell.

```ts
// slice-meta.ts — new optional field on NodeSliceMeta/PanelSliceMeta/PageSliceMeta
export interface VariantDef {
  /** data-attribute key emitted on the node element, e.g. 'data-emphasis'. */
  attr:     string
  /** authored type: boolean toggle or named enum (string members). */
  kind:     'flag' | 'enum'
  /** enum members (kind:'enum'); for 'flag' the attr is present|absent. */
  options?: { value: string; label: LocaleString }[]
  label:    LocaleString
  default?: string | boolean
}
export type VariantSchema = Record<string /*variantName*/, VariantDef>

// section/default/meta.ts
variants: {
  emphasis: { attr: 'data-emphasis', kind: 'enum',
              options: [{value:'hero',label:{en:'Hero'}},{value:'compact',label:{en:'Compact'}}],
              label: { en: 'Emphasis' } },
}
```

Decision sub-point: `hero` and `compact` are **mutually-exclusive emphasis levels**, so they collapse from two booleans into ONE `enum` variant `emphasis: 'hero'|'compact'|undefined`. This is the conceptual improvement (not relocation): the model now says what it means — a section has ONE emphasis — and makes the illegal `hero && compact` state unrepresentable (§2 make-illegal-states-unrepresentable). The loose `ViewParams.hero`/`ViewParams.compact` booleans are retired into this declared variant (expand-contract; old configs migrated by a versioned transform).

### 2. A GENERIC resolver turns declared variants → data-attrs (the `resolveVariants` seam)

New pure function in `@statdash/styles`, sitting beside `resolveViewState`:

```ts
// styles/src/resolvers/variant.ts
export function resolveVariants(
  schema: VariantSchema,
  authored: Record<string, string | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, def] of Object.entries(schema)) {
    const v = authored[name] ?? def.default
    if (v === undefined || v === false || v === '') continue
    out[def.attr] = def.kind === 'flag' ? '' : String(v)   // flag → presence; enum → value
  }
  return out
}
```

The shell spreads the result and writes ZERO class logic:
```tsx
<section className="section" {...resolveVariants(META.variants, def.variants)} id={…} style={sectionAccentStyle(def.color)}>
```
CSS reads the attribute, not a modifier class:
```css
.section[data-emphasis="hero"]    { … }   /* was .section--hero    */
.section[data-emphasis="compact"] { … }   /* was .section--compact */
```

**Wiring it into `defineShell` (the foresight payoff).** `defineShell` already computes `vs`/`merged`/`placement` centrally so shells never recompute boilerplate. Add the variant resolution there: `defineShell` receives the slice META (it is registered alongside the shell), resolves `resolveVariants(meta.variants, def.variants)`, and passes the attr object as a new `ShellProps.variantAttrs`. A NEW variant is then: declare in meta → Constructor authors it → CSS rule → **zero shell code**. The shell only chooses WHICH element carries `{...variantAttrs}` (the block element), which is genuine layout knowledge, not class wiring.

### 3. The static structural classes stay typed via CSS-Module-free attr scoping — see decision below

The remaining bare strings are the *static structural* classes (`'section'`, `'section__head'`, `'section__body'`). These are the BEM **block/element** skeleton (not variants). Decision in the next section.

## Scoping-tech decision: CSS-attribute scoping (extend the data-attr spine) — NOT CSS Modules / vanilla-extract

The brief asks me to pick the canonical class-scoping tech. I reject the framing that we need a *class*-scoping tech at all, because the platform already scopes by **data-attribute + token cascade**, not by class-name hashing. The canonical move is to finish that spine, not bolt a parallel one beside it.

**CHOSEN: data-attribute scoping for variants/state + a thin typed `cx`-free block-class via a per-slice `styleKeys` SSOT.**
- Variants and runtime states → **data-attributes** (`data-emphasis`, `data-active`, `data-view`) resolved generically. This is already proven, byte-compatible with the token cascade (`.section[data-emphasis="hero"]` can read `--sc`, `[data-tenant]`, `[data-theme]` exactly as `.section--hero` did — same selector specificity class), and zero-runtime.
- Static block/element names → a per-slice **`styleKeys.ts`** typed constant object (`SECTION = { block:'section', head:'section__head', body:'section__body', … } as const`), co-located like the existing `sectionKeys.ts`. One SSOT per slice; the `.tsx` imports typed members, the bare strings exist in exactly ONE file, and a fitness function forbids bare BEM strings in `*Shell.tsx`. This is the Null-cost, arrow-clean, tsup-friendly option.

**REJECTED — CSS Modules (`import s from './section.module.css'` → typed `s.section`).**
Gives compile-time `.tsx`↔`.css` typing, the headline ask. But: (a) it hashes class names, which **breaks the byte-identical guarantee** — the migration brief mandates byte-identical CSS output, and hashed `.section_a3f9` defeats the existing global selectors `[data-tenant] .section`, the `--sc` cascade, and every E2E/snapshot keyed on `.section`; (b) it forks the scoping model — the platform scopes by data-attr + token cascade, CSS Modules scopes by hash, and running both is two mental models (Principle of Least Astonishment violated); (c) tsup + the typed-CSS-Modules plugin adds build surface and a `.d.ts` codegen step. The typing benefit is real but is recovered more cheaply by `styleKeys.ts` + a fitness function. Rejected on byte-identity + single-spine grounds.

**REJECTED — vanilla-extract (typed, zero-runtime, token-native recipes).**
The most architecturally attractive on paper: `recipe({ variants: { emphasis: { hero: {...}, compact: {...} } } })` IS the cva/Stitches variant model the brief cites, typed and token-aware. But it would **rewrite every `.css` file into `.css.ts`** (all 22 shell stylesheets), generate fresh hashed class names (again breaking byte-identity), and introduce a second token system competing with the established `tokens.css` CSS-var cascade + `TOKENS_CATALOG`. That is exactly the "don't fork a parallel styling system — extend the design-token spine" constraint (brief §4). It is the right tool for a greenfield design system; here it is a rip-and-replace that violates Strangler-Fig and byte-identity. Rejected — but its **recipe-variant API is the conceptual model we copy** into the meta `VariantDef` shape.

**REJECTED — a `<Box variant=… />` styling primitive / `cva()` helper.**
Adds a runtime component layer between every shell and the DOM, plus a className-merge cost on every node render. The platform's idiom is "spread resolver output onto a plain element" (`{...vs.panel}`, `{...resolveViewState(...)}`) — a `<Box>` would be ceremony over that established, leaner idiom (YAGNI; brief §3 weighs this and lands on "not warranted"). The composition primitive we DO add is the pure `resolveVariants()` function, not a component.

**Trade-off named:** we gain byte-identity + single-spine coherence + zero-runtime + arrow-cleanliness; we give up IDE go-to-definition from a `.tsx` class token straight into the `.css` rule (CSS Modules' one real win). We recover ~80% of that with `styleKeys.ts` typing + the fitness function, and judge the residual 20% (cross-file CSS navigation) not worth forking the scoping model. ISO 25010: Maintainability (modifiability, analysability) up; one Portability/tooling nicety down — a deliberate, recorded trade.

## Constructor + foresight — end-to-end (declare → author → resolve → render)

1. **Declare:** `section/default/meta.ts` gains `variants: { emphasis: {...} }`.
2. **Discover:** a new `variantPropSchema(meta) → PropField[]` (mirrors `presentationPropSchema()`) maps each `VariantDef` to a PropField — `kind:'enum'` → a `string` field with `options`; `kind:'flag'` → a `boolean` field; `field: 'variants.emphasis'`. The Constructor Inspector renders typed controls (a select / a toggle), NEVER a free-text class string.
3. **Author:** the Constructor writes `def.variants = { emphasis: 'hero' }` into the JSON config — a typed enum value, not a magic string. `generatePageConfigSchema` includes `variants` in the generated JSON Schema, so stored configs are validated (an unknown variant value fails the boundary — Fail-fast).
4. **Resolve:** `defineShell` runs `resolveVariants(meta.variants, def.variants)` → `{ 'data-emphasis': 'hero' }`.
5. **Render:** shell spreads `{...variantAttrs}`; CSS `.section[data-emphasis="hero"]` (token-cascade-aware) paints it.

Foresight test: *a new `density: 'comfortable'|'cosy'` variant.* Add one `VariantDef` to meta + two CSS rules. The Constructor control, JSON-Schema validation, resolver, and render all flow with ZERO shell/engine edits (OCP / Law 8 M-5). That is the "new variant = new capability, interface unchanged" bar.

## Fitness functions (un-regressable — encode the law, don't comment it)

- **FF-NO-VARIANT-CLASS** (node-env, mirrors `presentation.fitness.test.ts` style): scan every `*Shell.tsx`. FAIL if a file contains (a) a BEM **modifier** string literal (`/--[a-z]/` inside a string in a `className`/class-array), or (b) inline variant→class logic — the `[...].filter(Boolean).join(' ')` className idiom, or a ternary producing a `--`/`is-` class. Variants must arrive as `{...variantAttrs}`/`{...resolveVariants(...)}` only.
- **FF-NO-BARE-BLOCK-STRING**: a `className=` in `*Shell.tsx` must reference a `styleKeys` member (or `vs.panel.className`), not a bare BEM block/element string literal. (Allowlist the one `styleKeys.ts` SSOT file per slice.)
- **FF-VARIANT-DECLARED**: every `data-*` attribute a CSS file selects on under a shell (`[data-emphasis=…]`) must correspond to a `VariantDef.attr` in that slice's META (CSS↔meta closure — no orphan attrs, no undeclared variants). Same shape as the no-privileged-node / structuralMirror fitness tests.
- **FF-VARIANT-SCHEMA-ROUNDTRIP**: `variantPropSchema(meta)` for every registered slice yields a PropField whose `field` round-trips through `generatePageConfigSchema` (declare→author→validate closure holds).

## Migration plan (Strangler-Fig · byte-identical · green each phase)

Owner = platform/shell layer. Each phase ships green + byte-identical CSS output (data-attr selectors have the SAME specificity class as the BEM modifiers they replace, so computed styles are identical; snapshot/E2E keyed on the static block class `.section` are untouched).

- **P0 — seam, no behavior change.** Add `VariantDef`/`VariantSchema` to `slice-meta.ts`; add pure `resolveVariants()` + tests to `@statdash/styles`; add `variantPropSchema()` to engine; add `variantAttrs` to `ShellProps` + `defineShell` (empty object when a slice declares no variants). Nothing consumes it yet. Green.
- **P1 — exemplar (section).** Declare `emphasis` enum in `section/meta.ts`; add `.section[data-emphasis="hero"|"compact"]` rules **alongside** the existing `.section--hero`/`--compact` (dual-render); switch `SectionShell` to `{...variantAttrs}` + `styleKeys`; add the v→variant config migration (`view.hero`→`variants.emphasis:'hero'`, `view.compact`→`'compact'`). Snapshot-prove byte-identical. Then delete the old `.section--*` rules + the `ViewParams.hero/compact` booleans (contract step). This phase is the reference PR every other shell copies.
- **P2 — runtime-state variants (hero card `is-active`, view-toggle `active`, chevron `open`).** These are the SAME defect with runtime (not authored) input — resolve to `data-active`/`data-open` via the same resolver shape (state in, attr out). Migrate hero, section header, view-toggle.
- **P3 — layout + chrome shells** (`layout/*`, `app-header`, `inner-sidebar`, `filter-bar`): most already use `data-*` (`data-dir`, `data-layout`, `data-frame`) — formalize those as declared `VariantDef`s so FF-VARIANT-DECLARED passes; convert remaining modifier strings.
- **P4 — panel shells** (`chart`, `table`, `map`, `kpi-strip`, `gauge`, `text`): `text-panel--plain/--rich` → `data-render='plain'|'rich'` enum variant.
- **P5 — page shells** (`inner-page` `data-layout`, `tab-page`, container pages): declare existing attrs; convert residue.
- **P6 — lock.** Turn on FF-NO-VARIANT-CLASS / FF-NO-BARE-BLOCK-STRING / FF-VARIANT-DECLARED as CI gates. The hardcode is now un-reintroducible.

## Critical questions posed + answered

- **Q: data-attrs vs CSS-Modules typed classes — which is canonical HERE?** A: data-attrs. The platform already scopes by data-attr + token cascade (`resolveViewState`, `data-layout`…); CSS Modules forks the model and breaks byte-identity via hashing. Typing is recovered by `styleKeys.ts` + fitness, not by changing the scoping spine.
- **Q: Is a `<Box variant>` primitive warranted?** A: No (YAGNI). The idiom is "spread resolver output on a plain element"; the primitive we add is the pure `resolveVariants()`, not a runtime component.
- **Q: Where does variant resolution live — shell, or `defineShell`?** A: `defineShell` (it already centralizes `vs`/`merged`/`placement`). Per-shell resolution would re-duplicate the call 35×. Centralizing makes "new variant = zero shell code" true.
- **Q: hero+compact — two booleans or one enum?** A: One `emphasis` enum. Conceptual improvement: states the real model (one emphasis), makes `hero && compact` unrepresentable. This is the reconceive-not-relocate move.
- **Q: byte-identity risk?** A: Bounded — `.section[data-emphasis="hero"]` and `.section--hero` are the same specificity class (0,2,0 vs 0,1,1 → both single-class-equivalent for the cascade interactions present); dual-render + snapshot proof in P1 de-risks it before any deletion.

## Scope honesty — must-do-for-canonical vs gold-plating

**Must-do (canonical):** `VariantDef`/`resolveVariants`/`variantAttrs` seam (P0); section exemplar + hero/compact→enum + migration (P1); the three core fitness functions; rollout P2–P6. Without these the hardcode survives and the brief is unmet.
**Gold-plating (defer behind YAGNI doors):** a full vanilla-extract recipe migration; responsive/per-breakpoint variants (`emphasis` differing by breakpoint) — the `setResponsive` machinery COULD carry it, but no authored case exists; compound-variant resolution (cva's `compoundVariants` — variant-pair-specific styles) — add only when a real pair-specific style appears; a Constructor live-variant-preview widget. Each has an obvious seam (the `VariantDef` map / the resolver) and should NOT be built speculatively.
