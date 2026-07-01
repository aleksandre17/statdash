# DESIGN — Framework-Grade Universal Style System (token-constrained · part-aware · Constructor-authorable)

> Owner's vision, resolved. **Design-only** (my one write). Reference class: **Theme-UI `sx` / Chakra
> style-props / Styled-System** (the responsive style-prop object), **W3C DTCG + Style Dictionary + Tailwind
> `theme()`** (the constrained token vocabulary + theming), **CSS Shadow Parts `::part` / Radix `data-part` /
> Panda & vanilla-extract slot-recipes** (bind style to any inner element), **Tailwind** (constraint-over-
> arbitrary discipline — adopted as philosophy, **rejected** as class-strings-in-config).
>
> **This is an EXTENSION of Z's grammar, not a competitor.** Z (`DESIGN-responsive-composition.md`) delivered
> the *cascade* — `resolveStyle(node,ctx) = mergeResponsive(① registryDefault ② distributed ③ view.styles ④
> placement)` over a 3-boundary `@layer`. This doc delivers the *vocabulary and reach* that flows through tier
> ③: **what** values you may author (token-constrained), **where** they may bind (the node AND its named inner
> parts), and **how** the Constructor authors them (schema fields the Inspector renders — no code, config-is-data).
>
> **Headline:** the platform already has the winning primitive — `NodeStyles` is a responsive style-prop object
> (the Chakra/Theme-UI `sx` model, done right). It is missing three framework-grade properties: it is **not
> token-constrained at the authoring boundary**, it **cannot reach inner parts** (the header `<img>`, the chart
> title), and it is **not surfaced as Inspector fields** (style is authorable only as raw JSON today). Add
> exactly those three — a token-picker authoring surface, a declared **parts** manifest, and a `StyleField`
> schema type — and `NodeStyles` becomes framework-grade with **no new runtime CSS engine**.

## 0. Verdict on the owner's vision

| # | Owner's instinct | Verdict | Elevation |
|---|---|---|---|
| **1** | "adopt the best concepts from a known framework (maybe Tailwind)" | **AGREE — but adopt the *constraint*, not the *class strings*** | Tailwind's real invention is the **bounded token scale + arbitrary-value escape hatch**, not utility classes. We already have the scale (`tokens.css` + `TOKENS_CATALOG` + `[data-tenant]`). Adopt Tailwind's *discipline*; reject its *delivery mechanism* (§4). |
| **2** | "style can bind to ANY plugin element's HTML tags, not just a header" | **AGREE strongly — this is the missing capability** | The answer is **named parts** (CSS Shadow Parts / Radix `data-part` / slot-recipes). The plugins already have an *internal* part registry — `styleKeys` (`HEADER.logo`, `SECTION.body`). Promote it to a **declared, public, introspectable `parts` manifest**; bind `NodeStyles` per part through the *same* resolver (§3). |
| **3** | "make it authorable from the Constructor (don't know how)" | **AGREE — the seam is already half-open** | `PropFieldSource: 'tokens'` **already exists** (`prop-schema.ts:66`) — the token-picker discovery source is declared but unconsumed. A new `StyleField` schema type + the existing `enum-ref source:'tokens'` picker + responsive breakpoint tabs = the Inspector authors style with zero per-node form code (§5). |

**Net:** the owner is right on all three. The trap to avoid is building a **Tailwind clone** or a **second CSS
engine** (Golden Hammer — §7). The elevation is: *constrain the vocabulary, extend the reach to parts, surface
it as schema.* Every mechanism rides infrastructure that already exists.

## 1. Current-state truth (file:line)

- **The style-prop object is already canonical and framework-grade in shape.** `NodeStyles` (`styles/src/types.ts:111`)
  is a full responsive style-prop object — every property is `ResponsiveVal<T>` (`:38`, flat OR per-breakpoint),
  JSON-serializable, resolved by `applyNodeStyles` (`node.ts:97`) into the var+flag engine. The header comment
  names the lineage explicitly: "Builder.io/Plasmic pattern." **This is the Chakra/Theme-UI `sx` model. Keep it.**
- **The token vocabulary + theming spine already exists — and is self-describing.** `tokens.css` is a W3C-DTCG-
  shaped scale (spacing/radii/color-roles/z-index/shadow/typography), with `[data-tenant]` rebinding the Tier-2
  semantic roles (`tokens.css:175,201,234` — "a tenant theme rebinds these role VALUES; it never edits packages/").
  `TOKENS_CATALOG` (`tokens-catalog.ts`) is a **Self-Describing Module** — every token carries `{ group, cssVar,
  label, description }` (`catalog/types.ts:11`) "consumed by Panel's style token picker UI." **The picker's data
  source is already built.**
- **BUT style is not token-constrained at the boundary.** `ColorValue = string` (`types.ts:98`), padding/gap are
  raw strings. A config may hold `"#3b82f6"` or `"13px"` — off-scale, un-themeable, un-pickable. The catalog
  exists but nothing forces authored values through it. (This is the gap Tailwind's constraint discipline closes.)
- **BUT style cannot reach inner parts.** `NodeStyles` binds to the *outer* node only (`view.styles` → `.section__body`
  / `.panel__body`). `PageHeaderShell` (`PageHeaderShell.tsx:20`) renders `<PageHeader>` whose logo/title/crumbs
  are **internal React** — config has *no handle* on them. The parts ARE named (`styleKeys.ts`: `HEADER.logo`,
  `HEADER.brand`, `SECTION.body`) but the naming is **private** (BEM-rename convenience), not a public target surface.
- **BUT style is not Inspector-authorable.** `SectionSchema` (`SectionNode.ts:28`) exposes `title/label/color/anchor/
  methodology.*` — **zero `view.styles` fields**. Authoring any style today = hand-editing the `view.styles` JSON
  blob (the AD-1/AD-3 authoring-lag findings). `PropSchemaForm` (`PropSchemaForm.tsx`) dispatches by `PropFieldType`
  but has **no style/token field type** — `color` degrades to a raw `<input type=color>` (off-token by construction).

**Keep (do not regress):** the `NodeStyles`/`ResponsiveVal` object · the `applyNodeStyles` var+flag engine ·
`TOKENS_CATALOG` self-description · the `[data-tenant]` Tier-2 rebind spine · the `enum-ref`/`source` PropField
discovery seam · `styleKeys` as the internal BEM SSOT. **The design adds three properties *around* these, changing
none of them.**

## 2. Framework-concept adoption — what, from whom, WHY

| Concept adopted | From (reference) | Why it fits OUR model | Verdict |
|---|---|---|---|
| **Responsive style-prop OBJECT** (`{prop: {default, md, sm}}`) | **Theme-UI `sx` · Chakra style-props · Styled-System · Builder.io/Plasmic overrides** | Already the `NodeStyles`/`ResponsiveVal` shape; it is *data*, serializable, introspectable — the anti-thesis of a class string. The owner's "bind style to an element" IS a style-prop object on that element. | **ALREADY HAVE — name it, keep it** |
| **Constrained token scale + semantic roles + theming rebind** | **W3C DTCG (Design Tokens Community Group) · Style Dictionary · Tailwind `theme()`** | `tokens.css` + `TOKENS_CATALOG` + `[data-tenant]` is exactly this. Elevation: make the token the *only* thing a Constructor author can pick (constraint), so theming is total and sections are uniform by construction. | **ADOPT as the authoring constraint** |
| **Named stylable PARTS** (`::part(logo)`) | **CSS Shadow Parts · Radix `data-part` · Panda / vanilla-extract *slot-recipes*** | The literal answer to "bind to any inner tag." A plugin is a black box; it must *declare* which inner elements are style-targets. `styleKeys` is already the internal registry — promote it to a public `parts` manifest + `data-part` emit. | **ADOPT — the one genuinely new capability** |
| **Constrain-by-default, arbitrary-value-by-intent** | **Tailwind** (scale + `[13px]` escape) | The token constraint is the *value* (consistency, theming, finite pickers). But a power-user hand-editing JSON keeps a raw-string escape hatch — governed, warned, never the default path. | **ADOPT the philosophy** |
| **Recipes / variants** (typed, named appearance axes) | **Stitches · Panda recipes · CVA** | Already present as the `variants` meta (`section/meta.ts:23` → `data-emphasis` enum). Parts + variants are orthogonal; no rebuild — note the alignment so we don't grow a second variant system. | **ALREADY HAVE — align, don't rebuild** |
| Build-time **atomic CSS** engine | Panda / vanilla-extract / Stitches (compile step) | **REJECT** as the delivery engine — the runtime var+flag engine (`applyNodeStyles`) is canonical and, crucially, **rebinds per-tenant at runtime** via `[data-tenant]`; build-time atomic purge fights runtime multi-tenant theming. Golden Hammer (§7). | **REJECT** |

**The one-line synthesis:** *Chakra's style-prop object · restricted to DTCG tokens · reaching Radix-style named
parts · authored by a Tailwind-disciplined Constructor picker — on the runtime engine we already ship.*

## 3. The universal style-prop + PARTS model

### 3.1 The node axis (already shipped — the reach we extend)
`view.styles: NodeStyles` binds to the node's own outer element, resolved by Z's `resolveStyle` tier ③. Unchanged.

### 3.2 The parts axis (NEW — "bind to any inner element")
Every node slice **declares its stylable parts** in `meta` — a named, introspectable registry (elevate `styleKeys`
from private BEM SSOT to a public target surface):

```ts
// meta.ts — declared parts manifest (mirrors the `variants` meta; discoverable via describeApp)
parts: {
  logo:  { label: { ka: 'ლოგო',    en: 'Logo' },    element: 'img'  },
  title: { label: { ka: 'სათაური', en: 'Title' },   element: 'h1'   },
  crumbs:{ label: { ka: 'ნავიგაცია', en: 'Breadcrumbs' }, element: 'nav' },
}
```

Config binds a `NodeStyles` object **per part**:

```jsonc
{ "type": "page-header", "title": "...",
  "view": {
    "styles": { "padding": "var(--spacing-lg)" },        // the node itself (tier ③)
    "parts":  {
      "logo":  { "maxHeight": { "default": "48px", "md": "32px" },   // the inner <img>, responsive
                 "opacity": 0.9 },
      "title": { "color": "var(--color-heading-display)", "fontSize": "var(--font-size-2xl)" }
    }
  } }
```

**Resolution — the same engine, one line per part.** The shell resolves each part through the *identical*
`applyNodeStyles` (and, under Z, `resolveStyle`) and spreads onto the part's element, which now also carries a
`data-part` attribute for CSS-Shadow-Parts-style external targeting:

```tsx
// each declared part element:
<img {...applyNodeStyles(view.parts?.logo)} data-part="logo" className={HEADER.logo} />
```

- The part element keeps its `styleKeys` BEM class (unchanged CSS) **plus** `data-part="logo"` (the public handle)
  **plus** the resolved per-part style attrs. Zero new mechanism — `applyNodeStyles` already turns `NodeStyles`
  into `{className, style, data-*, --<prop>-<bp>}`.
- **Each part is a first-class citizen of Z's cascade.** A part's style is tier ③ for that part; a plugin MAY ship
  a tier-① `registryDefault` per part (the logo's ideal default height). "Inner-over-outer" and `@layer` precedence
  apply per part exactly as for the node. Parts are, in Z's grammar, *nested styleable leaves of one node* — the
  slot-recipe insight, expressed in the cascade we already designed.

### 3.3 The token constraint (the DTCG + Tailwind layer)
Style **values** are authored as token references, serialized as the token's `cssVar` string:

- Serialized form stays `"var(--spacing-md)"` / `"var(--color-accent)"` — **zero migration**, already `[data-tenant]`-
  themeable, already what `TOKENS_CATALOG[k].cssVar` yields. The constraint lives in the **authoring surface** (the
  picker offers only catalog entries), not in a new value type. Round-trip is a trivial reverse lookup: `cssVar →
  token key` over the catalog re-selects the picker (§5.3).
- **This is deliberately NOT a new `{token: 'spacing.md'}` wrapper type** (YAGNI, §6). The catalog `cssVar` is
  already the SSOT bridge between token identity and serialized value; a wrapper adds a parallel representation for
  no gain. Deferred behind **D-TOKEN-WRAPPER** if reverse-mapping ever proves lossy.
- **Escape hatch (Tailwind `[13px]` analogue):** a raw string (`"#3b82f6"`, `"13px"`) remains *legal* in `NodeStyles`
  for a power-user hand-editing JSON — but the Inspector defaults to the picker, and a fitness function (§8, FF-4)
  *warns* when committed provisioning uses a raw value that a token already expresses. **Constrain by default,
  escape by explicit intent.**

## 4. The Constructor authoring answer (owner's open question)

### 4.1 A new `StyleField` schema type — style becomes data-driven Inspector fields
Add one `PropFieldType: 'style'`. A slice surfaces style authoring by adding style fields to its `PropSchema`:

```ts
// SectionNode.ts — style now authorable (not raw JSON), grouped, part-aware
{ field: 'view.styles',        type: 'style', label: { ka: 'სტილი', en: 'Style' } },
{ field: 'view.parts.logo',    type: 'style', label: { ka: 'ლოგოს სტილი', en: 'Logo style' }, part: 'logo' },
```

The Inspector renders a `'style'` field as a **StyleField control** (JSON-Forms/RJSF-class, generic — one control,
every node): **property groups** (Spacing · Typography · Color · Border · Effects — mirroring `TokenGroup`) ×
**responsive breakpoint tabs** (the `ResponsiveVal` axis: `default | 2xl | xl | lg | md | sm | xs`) × **token
pickers** per property.

### 4.2 The token picker is the existing `enum-ref` seam — already open
Each property inside the StyleField is an `enum-ref` with `source: 'tokens'` — **the source already declared in
`prop-schema.ts:66`, filtered by the property's `TokenGroup`** (a `padding` field draws `group:'spacing'` tokens; a
`color` field draws `group:'color'`). The panel resolves `source:'tokens'` against `TOKENS_CATALOG` → a picker
showing `label` + a `value` swatch (the catalog already carries both). **The Constructor sees only registered
tokens** — capability discovery (§12) applied to style. No raw color inputs, no free-typed pixels on the default path.

### 4.3 The part selector — parts are introspectable
The StyleField for a part is chosen from the node's declared `parts` manifest (flowed through `describeApp()` →
Cluster ① authoring SSOT). The Inspector shows a **part dropdown** (`logo · title · crumbs`) — each entry a `'style'`
field bound to `view.parts.<part>`. A node with no `parts` shows only the node-level StyleField. **Ship capabilities,
not one-offs:** a new part = one manifest entry → it appears in the dropdown with zero Inspector code.

### 4.4 Ties to Cluster ① (schema-authoring SSOT)
`StyleField` + `parts` are pure `PropSchema`/`meta` additions — they flow through the *same* `describeApp()`
manifest the Inspector already consumes (`DESIGN-authoring-schema-ssot`). `saveGuard` validates authored style
against the manifest (token in catalog? part declared?) — the 5th-check seam that design already opened. One
authoring SSOT; style is no longer an exception to it.

## 5. Rejected alternatives (with reasoning)

1. **Raw Tailwind (or any utility) class strings in config** — e.g. `"class": "px-4 md:px-6 text-accent"`.
   **REJECT.** (a) *Breaks no-code:* the author must learn Tailwind's grammar — the opposite of a visual picker.
   (b) *Breaks agnosticism (Law 1/4):* config becomes coupled to one CSS framework's class vocabulary; a second
   design system can't reinterpret it. (c) *Breaks the lossless round-trip (§12):* a class string is **opaque** —
   the Inspector cannot render a token picker or breakpoint tabs over `"px-4 md:px-6"`; visual↔JSON is no longer
   reversible. (d) *Breaks theming:* Tailwind's build-time purge fights the runtime `[data-tenant]` rebind. (e)
   *Breaks Law 2:* a class string is a stringly-typed mini-language — intent encoded as a token, not data. Utility
   classes solve *hand-authoring ergonomics*; we are building a *visual Constructor over data* — the requirements
   are opposite. **We adopt Tailwind's constraint discipline (§2), which is the actually-valuable idea.**

2. **Unbounded arbitrary CSS everywhere** (raw `style` strings / an open escape hatch on every value).
   **REJECT as the default.** The **constraint is the product value**: a bounded vocabulary makes the Constructor's
   pickers *finite*, makes `[data-tenant]` theming *total* (rebind the role, every consumer moves), and makes
   sections *uniform by construction* (the Tailwind insight — you can't drift off a scale you can't type). Arbitrary
   values survive only as the governed, warned escape hatch (§3.3), never the authoring default.

3. **A build-time atomic CSS engine (Panda / vanilla-extract / Stitches) replacing `applyNodeStyles`.**
   **REJECT.** Golden Hammer. The runtime var+flag engine is canonical, tested, and **rebinds per-tenant at
   runtime** — build-time atomic CSS purges to a fixed sheet that fights runtime multi-tenant theming and adds a
   compile step for a capability we already have. We adopt their *slot-recipe concept* (named parts), not their engine.

4. **A new `{token: 'spacing.md'}` value wrapper type.** **DEFER (D-TOKEN-WRAPPER).** The catalog `cssVar` is
   already the identity↔value bridge; a wrapper is a parallel representation with a migration cost and no gain. The
   picker + reverse-lookup deliver token-authoring without it.

5. **Per-node bespoke style forms (hand-written Inspector panels per plugin).** **REJECT.** Shotgun surgery — 55
   shells, 55 forms, drift guaranteed. The `StyleField` schema type is generic (one control, every node), exactly
   as `PropSchemaForm` is generic today.

## 6. YAGNI ledger — build-now vs open-seam-now vs defer

| Candidate | Verdict | Why |
|---|---|---|
| **Token-picker StyleField** (activate `source:'tokens'` + responsive tabs) | **BUILD NOW** | Real consumer today: style is authorable only as raw JSON (AD-1/AD-3 authoring-lag). The picker's data source (`TOKENS_CATALOG`) and discovery seam (`source:'tokens'`) already exist — this is *activation*, not new infra. |
| **`parts` manifest + `data-part` emit + per-part resolve** (the mechanism) | **OPEN SEAM NOW** | The one new capability. Build the *declaration + resolution mechanism*; it rides `applyNodeStyles` unchanged. |
| **Populating parts across all 55 shells** | **DEFER — per real consumer** | Populate a node's `parts` only when a real styling need exists (start with the owner's header logo IF a live ask; else the first section/chart-title consumer). No empty cathedrals — mirror `getByCapability`'s "data unpopulated, not wiring missing" lesson. |
| **`{token}` wrapper value type** | **DEFER (D-TOKEN-WRAPPER)** | `cssVar` + reverse-lookup suffices; wrapper only if round-trip proves lossy. |
| **Arbitrary-value *blocking* (hard reject raw hex)** | **DEFER** | Start with a *warn* fitness function (FF-4). Hard-block only if drift persists — Postel at the boundary. |
| **Per-part responsive pseudo-states / per-part variants** | **DEFER** | `PseudoStyles` is already deliberately non-responsive (`types.ts:83`); nesting parts × pseudo × breakpoints is combinatorial CSS with no live consumer. |
| **Slot-recipe *variant* system (typed appearance recipes per part)** | **DEFER** | The `variants` meta already covers node-level appearance axes; a part-level variant system needs a real second consumer. |

## 7. Strangler adoption plan (each phase: shippable · green gate · real-browser verified · reversible)

Built on Z's cascade — these phases assume/compose with Z's P0–P1 (`@layer` + `resolveStyle`). Style-vocabulary
phases can proceed in parallel where noted.

| Phase | Change | Guard |
|---|---|---|
| **S0** | Add `PropFieldType: 'style'` + a StyleField control in the Constructor Inspector; wire `enum-ref source:'tokens'` picker filtered by `TokenGroup`; reverse-map `cssVar → token key`. No node schema changes yet. | **FF-TOKEN-PICKER-RESOLVES**: every `TOKENS_CATALOG` entry is pickable; a picked value serializes to its `cssVar`; reverse-lookup re-selects it. |
| **S1** | Surface `view.styles` as StyleField groups in node schemas (start section/panel/chart). Rides Z tier ③. | **FF-STYLE-AUTHORABLE**: nodes exposing style have a `'style'` field; authoring→serialize→re-parse is lossless (round-trip). |
| **S2** | **Parts:** declare `parts` in `meta` (promote `styleKeys`), emit `data-part`, resolve `view.parts.<p>` via `applyNodeStyles` per part. Populate the FIRST real part consumer only. Part selector in Inspector. | **FF-PARTS-DECLARED**: every emitted `data-part` has a `parts` manifest entry + is style-resolvable + appears in the palette (the FF-NO-DEAD-CAPABILITY analogue for parts). |
| **S3** | Token-constraint fitness: warn where committed provisioning uses a raw value a token already expresses. | **FF-TOKEN-CONSTRAINED** (warn-level). |

## 8. Fitness functions (encode each invariant, not a comment)

1. **FF-NO-RAW-CLASS-IN-CONFIG** — no node config field named `class`/`className` or carrying a utility-class
   string; the anti-Tailwind guard. *Config is token-object data, never a class DSL.*
2. **FF-PARTS-DECLARED (no dead part)** — every `data-part` emitted by a shell has a `parts` manifest entry, every
   manifest part is `applyNodeStyles`-resolvable and palette-introspectable. *Mirror of Z's FF-NO-DEAD-CAPABILITY.*
3. **FF-STYLE-ROUNDTRIP** — a `NodeStyles`/parts object authored via the Inspector serializes and re-parses to the
   identical picker state. *The lossless visual↔JSON law (§12).*
4. **FF-TOKEN-CONSTRAINED (warn)** — committed provisioning style values that equal a token's raw value are flagged
   (prefer the token). *Constrain-by-default, warn the escape.*
5. **FF-THEME-REBINDABLE** — every semantic style value resolves through a `var(--*)` that `[data-tenant]` can
   rebind; no raw hex on the semantic path. *Theming is total.*
6. **FF-TOKEN-PICKER-COVERS-CATALOG** — the Inspector's token source resolves every `TOKENS_CATALOG` entry (no
   token exists that the Constructor can't pick). *Capability discovery completeness.*

## 9. Composition with Z's grammar + the section-uniformity goal

- **Z owns the cascade; this owns the vocabulary and reach.** `resolveStyle`'s tier ③ (`node.view.styles`) is now
  *token-constrained and Inspector-authored*; the parts model extends the *same* four-tier `@layer` cascade to each
  named inner element (a part is a nested styleable leaf — the slot-recipe concept inside Z's grammar). No conflict;
  strict extension.
- **Structure ⊥ style ⊥ token-vocabulary ⊥ part-target** — four orthogonal axes of one node, each authored once,
  resolved by the renderer ([[feedback-maximal-orthogonality]]). Parts add reach *along the style axis*, not a new
  axis of duplication.
- **Section-uniformity is achieved by the constraint, not by convention.** Because every section's style is authored
  from the *same bounded token vocabulary* through the *same* StyleField, sections are uniform **by construction** —
  you cannot drift off a scale you cannot type (the Tailwind insight, applied to a no-code Constructor). This is the
  structural answer to the recurring "sections should look uniform" goal: uniformity is a property of the constrained
  vocabulary, enforced by FF-TOKEN-CONSTRAINED + FF-THEME-REBINDABLE, not a style-guide humans must remember.

## 10. Headline model + MVP

**Headline:** *A Chakra-style responsive style-prop object (`NodeStyles`) — restricted to DTCG design tokens at the
authoring boundary — reaching Radix-style named `parts` on any inner element — authored by a Tailwind-disciplined
Constructor token-picker — all on the runtime engine we already ship.* Four framework concepts, zero new CSS engine.

**MVP (S0 + S1):** the `'style'` PropFieldType + token-picker StyleField (activating the already-declared
`source:'tokens'` seam) + surfacing `view.styles` on section/panel/chart. This alone closes the largest real gap
(style un-authorable except as raw JSON) and delivers token-constrained, theme-safe, responsive style authoring in
the Constructor — *before* any parts work. Parts (S2) is the owner's headline "bind to any element" capability,
built as a mechanism next and populated per real consumer.

## 11. ADR summary

**Decision:** Keep `NodeStyles` as the universal responsive style-prop object. Add (1) a token-constrained
*authoring* surface — a `'style'` PropFieldType + StyleField control driven by the existing `source:'tokens'` picker
over `TOKENS_CATALOG`, breakpoint-tabbed; (2) a declared, introspectable **`parts` manifest** (promoting `styleKeys`)
with `data-part` emit and per-part `applyNodeStyles` resolution, riding Z's cascade; (3) the constraint as the
default with a governed raw-value escape hatch. No new runtime CSS engine; no new value-wrapper type.

**Rejected:** (1) *Tailwind/utility class strings in config* — breaks no-code, agnosticism, round-trip, theming, and
Law 2 (§5.1). (2) *Unbounded arbitrary CSS as default* — the constraint is the value (§5.2). (3) *Build-time atomic
engine* — Golden Hammer; fights runtime tenant theming (§5.3). (4) *`{token}` wrapper type* — deferred; `cssVar`
suffices (§5.4). (5) *Per-node bespoke style forms* — shotgun surgery vs the generic StyleField (§5.5).

**Trade-off (ISO 25010):** a bounded token vocabulary trades a small amount of *flexibility* (arbitrary values
demoted to a warned escape hatch) for **usability** (finite, pickable Constructor surface), **maintainability +
compatibility** (total `[data-tenant]` theming, uniform-by-construction sections), and **evolvability** (a new
token/part = one catalog/manifest entry, every consumer unchanged — OCP). Reach extends to inner parts without a new
engine (performance-neutral); reliability rises (fitness-locked constraint + no-dead-part guard).
