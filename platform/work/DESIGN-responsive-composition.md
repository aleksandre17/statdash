# DESIGN — Declarative Responsive Composition (unified cascade + layout-node SSOT)

> Owner's core vision, elevated. **Design-only.** Builds on `DESIGN-css-responsive-standard.md` (a985)
> responsive axis + `DESIGN-styles-architecture.md` L0–L3 spine + `DESIGN-panel-sizing-cqi.md` height band;
> **supersedes the precedence-enforcement half of a985** (the inline-var trick → `@layer`). Reference class:
> Builder.io (override inheritance + registered blocks), Framer/Webflow (breakpoint overrides), W3C CSS
> Cascade Layers, Grafana PanelChrome/row, Vega-Lite (grammar→declarative), Every-Layout (intrinsic grids).
>
> **Headline:** A (style cascade) and B (layout-node SSOT) are ONE model — **a grammar of composition**
> where *structure* and *style* are both nodes-with-config resolved by ONE deterministic cascade. The
> recurring challenge disappears because tier precedence stops being a per-node specificity fight and
> becomes a declared, layered, merge-once law.

## 0. Verdict on the owner's vision

| # | Element | Verdict | Elevation |
|---|---|---|---|
| **A** | 3-tier cascade (plugin default→config→inner-over-outer), ONE mechanism, fitness-locked | **AGREE + IMPROVE** | The tiers are not 3 code paths — they are **3 CSS `@layer`s + one `resolveStyle` merge fn**. Today precedence rests on a fragile inline-var-beats-stylesheet trick (`node.ts:114`) split across 3 ad-hoc mechanisms. Formalize. |
| **B** | Every section/page via layout nodes; retire bespoke divs; wire `align`/`count`/`gap` responsive | **AGREE strongly** | Deeper than bespoke divs: **two competing grid primitives** (`row`/`.panel-row` vs `columns`/`.layout-columns`) + the page body (`.page-content`) is itself a hand-rolled flex div. One vocabulary; page body becomes a `stack`. |
| — | tier-3 = "inner overrides outer style" | **RE-FRAME** | Two sub-concepts hide here: **distributed style** (outer base, inner wins — `WrapStyleContext`) and **placement** (parent grid constrains child — `LayoutItemProvider`). Both real; name them inside ONE merge so "inner wins" is a precedence rule, not two contexts. |

**Net:** owner is right on A and B. Dilution risk = treating them as two features. Elevation = one grammar,
one cascade. Over-reach risk (YAGNI) = full-sheet `@layer` reorder or a new CSS engine — neither needed.

## 1. Current-state truth (file:line)

**Style cascade today**
- **Tier 2 is strong & canonical.** `applyNodeStyles` (`styles/src/resolvers/node.ts:97`) → `{className,
  style, data-*}` for ~34 props, each responsive via `setResponsive` (`:129`): flat→inline, ≥1 breakpoint→
  `--<prop>-<bp>` vars + `data-<prop>-responsive` flag read by `node-styles.css`. Builder.io override-
  inheritance done right — the model the other tiers should imitate.
- **Precedence is a trick, not a guarantee.** `node.ts:114–123`: responsive props emit nothing inline
  (inline beats media rules). Correct, but "config beats default" then rests on source-import order — **no
  `@layer`** — so equal-specificity Tier-1 vs Tier-2 rules are order-accidents. This is the "keeps becoming
  a challenge."
- **Tier 1 is CSS in a *different representation* than config.** `layout.css:27–93` ships full `@container`
  column-collapse + `align-items:stretch` equal-height; `section.css:98` a container query. Excellent
  defaults — but opaque CSS, so a Tier-2 override can only *out-specify*, never *merge*. Different system → fight.
- **Tier 3 is split across two ad-hoc mechanisms.** Placement: `LayoutItemProvider` (`layoutItemContext.tsx:18`)
  reads a child's own `view.styles` placement (`resolveLayoutItem`, `layout.ts:70` — `colSpan/rowSpan/align/
  justify/order`); `mergePlacement` (`:43`) folds with placement winning. Distributed style: `WrapStyleContext`
  (`WrapShell.tsx:11`) pushes `def.styles` down, child overrides. Two directions of one idea, **no shared law**.

**Composition primitives today**
- **Two grid primitives (divergent change).** `columns`/`.layout-columns` (`layout.css:27`): container-query
  collapse, responsive `count` (`resolveColumns`, `layout.ts:52`), stretch equal-height, `min-width:0`. Canonical.
  Used 6× (`geostat.provisioning.json:4258`, `count:{default:2,md:1,sm:1}`). `row`/`.panel-row`
  (`panel-layout.css:11`): **viewport** media collapse at hardcoded `1280px` (`:137`), `--panel-cols` inline var.
  Viewport-based (violates container-first for nested content) — the **legacy bespoke** primitive `columns` replaced.
- **The page body is a bespoke div.** `InnerPageShell.tsx:20` → `<main className="page-content">`; `.page-content`
  (`page-layout.css:57`) is a hand-rolled flex column; sections dumped as direct children. The "individual divs
  holding sections" at the page root.
- **`align` is dead.** `layout.css:33–36,105–107` define `[data-align]`, but `ColumnsNode`/`GridNode` expose no
  `align` field and the shells emit no `data-align` (AUDIT-BRIEF §2: left unwired to avoid schema drift). A
  CSS-only capability is invisible to the Constructor (§12: "ship capabilities, not one-offs").
- **Sizing lives outside the node model, with counter-rules.** `panel-layout.css` owns the flex chain + band
  basis (`:62–70,106–114`) + (AUDIT-BRIEF §4) a double-emission counter-rule. Equal-height asserted **twice** —
  `.panel-row` (`:16`) AND `.layout-columns` (`layout.css:31`). Two sources for one invariant.

**Keep (do not regress):** the responsive engine · `layout.css` container-first defaults + equal-height ·
`resolveColumns` ladder · `LayoutItemProvider` Fragment-vs-Provider zero-DOM discipline · the height band
(a985 §3a). The design unifies the seams *around* these.

## 2. (A) The canonical style-resolution cascade

**2.1 Three `@layer`s + one merge, per node.** Every node's final style is `resolveStyle(node, ctx)` — ONE
pure fn, ONE precedence, every node. Lowest→highest (later wins):

```
resolveStyle(node, ctx) = mergeResponsive(
  ① registryDefault(node.type),   // TIER 1 — plugin ideal default (responsive)
  ② ctx.distributed,              // outer base distributed down (Wrap/theme)   ┐ inner-over-outer:
  ③ node.view.styles,             // TIER 2 — this node's author config          ┘ ③ beats ②
  ④ ctx.placement(node),          // TIER 3 — immediate parent's slot placement
) → StyleAttrs { className, style, data-*-responsive, --<prop>-<bp> }
```

`mergeResponsive` = deep, **per-breakpoint**, later-wins merge of `NodeStyles` — the merge already implied
by `WrapShell` (`{...wrap,...child}`) and `mergePlacement`, promoted to ONE operator (SSOT). Output flows
through the **existing** `applyNodeStyles` machinery — no new runtime CSS system.

**2.2 The precedence GUARANTEE — `@layer`.** Root cause of the challenge: Tier-1 opaque `@container` CSS and
Tier-2 config vars are ordered only by specificity + import order. Fix at the cascade:

```css
@layer engine.reset, engine.tier1-default, engine.tier2-config, engine.tier3-override;
```

- **`tier1-default`** — co-located plugin CSS (`layout.css`, `section.css`, panel sizing). Container queries
  stay CSS (cannot be inline) but now **lose to config regardless of specificity** — no `!important`, no hack.
- **`tier2-config`** — the `node-styles.css` `[data-*-responsive]` cascade.
- **`tier3-override`** — small, explicit; rules that must beat a node's own config (parent-imposed grid track).
- Inline `style` (flat Tier-2) still wins over all layers — **preserve that contract** (`setResponsive`'s
  flat-vs-responsive split).

Scoped `@layer` (3 tier boundaries) = exactly a985 §5's "adopt only when an override war justifies it" — the
owner's challenge *is* that war. **Not** a full-sheet reorder (YAGNI, §6).

**2.3 One mechanism, superseding the split.**

| Concern | Today | Canonical |
|---|---|---|
| config → own element | `applyViewStyles` | `resolveStyle` ③ (same engine) |
| outer base → inner | `WrapStyleContext` (ad-hoc) | `resolveStyle` ② `ctx.distributed` |
| parent slot → child | `LayoutItemProvider`+`mergePlacement` | `resolveStyle` ④ `ctx.placement` |
| default vs config order | inline-beats-stylesheet trick | `@layer` boundary (guaranteed) |
| plugin ideal default | opaque, out-specified | `@layer tier1-default`, *merged under* config |

`WrapStyleContext`/`LayoutItemProvider` are **retained as transport** (they carry ②/④); their merge semantics
unify into `mergeResponsive`. Shells migrate `applyViewStyles`→`resolveStyle` (a superset; byte-identical
when no ancestor ctx) — a safe Strangler swap.

**2.4 Responsive at every tier.** ②③④ are `NodeStyles` (responsive via `ResponsiveVal`). Tier ① is responsive
via co-located `@container`/`@media` in `@layer tier1-default` **and** may declare `registryDefault` styles
(merged, so config overrides a *default breakpoint value*, not just the flat one). This makes
**FF-EVERY-NODE-RESPONSIVE-DEFAULT** enforceable — "perfect with zero config" is checked, not hoped.

## 3. (B) The layout node as SSOT compositional primitive

**3.1 A Grammar of Composition (Composite + Interpreter).** Structure = a tree of layout nodes (`stack`,
`columns`, `grid`, `card`, `divider`, `spacer`, `wrap`) with all-responsive, all-authorable params. **No
shell and no config composes ≥2 children with a hand-rolled `<div>`** — composition is always a node.

| Node | Authorable (responsive) | Renders |
|---|---|---|
| `stack` | `direction`, `gap`, `wrap`, **`align`**, **`justify`** | flex 1-D (page body, section body, KPI row) |
| `columns` | `count`, `gap`, **`align`** | container-query grid, equal-height, count collapses by bp |
| `grid` | `columns`, `gap`, **`align`** | 12-col grid + per-child `colSpan`/`rowSpan` |
| child of any | `colSpan`/`rowSpan`/`align`/`justify`/`order` (via `view.styles`) | placement in parent slot |

**`align` is the concrete dead-capability wire:** add `align?: ResponsiveVal<'start'|'center'|'end'|'stretch'>`
to `Columns`/`Grid`/`Stack` schema (i18n labels, default `stretch`), emit `data-align` (CSS exists at
`layout.css:34,105`), responsive via the same engine. **FF-NO-DEAD-CAPABILITY** then forbids any `[data-x]`
in `layout.css` without a schema field + emitting shell.

**3.2 Retire the second grid primitive (Strangler).** `row` = `columns` with a worse (viewport, off-scale)
model. **B1** `RowShell` delegates to `Columns` semantics (`cols→count`), `.panel-row`→deprecated alias
(zero visual change, resting point). **B2** migrate provisioning `row`→`columns`; delete the `1280px` media
collapse (`panel-layout.css:137`). **B3** delete `row` + `.panel-row` → one grid family.

**3.3 Retire the bespoke page body.** `.page-content` (`page-layout.css:57`) is the "bespoke div holding
sections" at the root. **B4** `InnerPageShell` renders children inside a `stack` node (`direction:column`,
`gap`, `--page-measure`→the stack's `maxWidth`); `.page-content` keeps only genuinely viewport-level chrome
(measure cap, sidebar row). Section arrangement becomes fully authorable — "2 sections then 1" is one
`columns`/`grid` (responsive), not two divs with different handwriting.

**3.4 Fold sizing into the model.** Equal-height is intrinsic to `columns`/`grid` (`align-items:stretch`);
once `row` is retired, the duplicate `.panel-row{align-items:stretch}` (`panel-layout.css:16`) is deleted —
**one source**. The band (`--size-panel-height`) stays the ONE constraint (a985 §3a); moving the flex chain
into `@layer tier1-default` lets AUDIT-BRIEF §3 map-collapse be solved *in the node model* (the map's
definite height = a Tier-1 default of the panel node, not a wrapper counter-rule). Enables the cleanup;
does not re-litigate the band.

## 4. The unification — A and B are one grammar

```
Node = { type, structure(children + layout params), style(NodeStyles) }
render(Node, ctx) = Composite.place( children.map(c => render(c, deriveCtx(Node,c))),  // B structure
                                     resolveStyle(Node, ctx) )                          // A style
```

A (style) and B (structure) are the two **orthogonal** axes of one node (the orthogonality law — independent
axes authored once, resolved by the renderer, [[feedback-maximal-orthogonality]]). The challenge disappears
**by construction**: (1) one style representation (`NodeStyles`) at all tiers → overriding is a *merge*, not
a specificity fight; (2) tier order is a *declared `@layer`*, not an import accident; (3) one composition
primitive family → "how do I place these" has one answer at page, section, panel. Every capability is a
schema field → introspectable in the palette; nothing lives only in CSS. §12 "ship capabilities" made structural.

## 5. Phased roadmap + fitness functions

Each phase: shippable, green gate, **real-browser verified** (AUDIT-BRIEF §6 — green ≠ correct), reversible.

| Phase | Change | Guard |
|---|---|---|
| **P0** | Declare `@layer …tier1-default, tier2-config, tier3-override;`; move `layout.css`/`section.css`/panel-sizing→`tier1-default`, `node-styles.css`→`tier2-config`. No selector changes. | **FF-ONE-STYLE-CASCADE**: layer stmt exists once; `!important` count non-increasing; computed-style snapshot unchanged. |
| **P1** | `resolveStyle`+`mergeResponsive`; refactor `applyViewStyles` callers (identity when no ctx); unify Wrap+placement merge into `mergeResponsive`. | FF-ONE-STYLE-CASCADE (ext): every shell via `resolveStyle`; no hand-merge / raw `applyNodeStyles`. |
| **P2** | Wire `align` (+`justify` on `stack`): schema, i18n, `data-align` emit, responsive. | **FF-NO-DEAD-CAPABILITY**: every `[data-*]` in `layout.css` has a schema field + emitting shell. |
| **P3** | Every registered node ships a Tier-1 responsive default. | **FF-EVERY-NODE-RESPONSIVE-DEFAULT**: registry iteration asserts ≥1 responsive default source per type. |
| **P4** | `row`→`columns` alias (B1), migrate config (B2), delete `row`+`.panel-row` (B3). | **FF-NO-DUP-COLUMN-PRIMITIVE**: one grid class family; `.panel-row` absent. |
| **P5** | `InnerPageShell` composes via `stack` (B4); strip compositional concerns from `.page-content`; delete duplicate equal-height + (AUDIT-BRIEF §3 solved) sizing counter-rules. | **FF-NO-BESPOKE-SECTION-DIV**: (a) config — ≥2 sibling sections resolve under a layout-node parent; (b) code — no shell emits a multi-child grid/flex `<div>` outside a layout node. |

**Inherited (keep):** a985 I1–I7 (no-overflow, touch targets, off-scale-breakpoint scan, magic-value scan).
`@layer` + one primitive make them *easier* to hold, never weaker.

## 6. YAGNI ledger

| Candidate | Verdict | Why |
|---|---|---|
| Full-sheet `@layer` reorder | **DEFER** | a985 §5 RISKY; 3-tier boundary solves the actual war. |
| General CSS-in-JS / atomic engine | **REJECT** | `applyNodeStyles` var+flag engine exists & is canonical. Golden Hammer. |
| `align`/`justify` beyond `stretch/start/center/end` | **DEFER** | No consumer; open union, cheap later. |
| `grid` named template-areas UI | **DEFER (D-GRID-AREAS)** | `colSpan`/`rowSpan` resolve; areas have no live consumer. |
| Tier-1 defaults as fully declarative `NodeStyles` | **REJECT** | Container queries can't be inline; co-located CSS in `tier1-default` is correct. Merge at config tiers. |
| Deep theme cascade beyond `wrap` | **DEFER** | `ctx.distributed` covers `wrap` (real consumer); wait for a 2nd. |

Every built item has a real consumer today (6 `columns` uses, dead `align`, two grid primitives, bespoke
page body). No empty cathedrals.

## 7. Supersedes / reframes

- **Supersedes** a985's inline-var precedence *trick* → declared `@layer` boundary (its responsive axis kept).
- **Reframes** `DESIGN-styles-architecture.md` L3 as the *output* of the tier-2/3 merge, L2 as `@layer
  tier1-default` — ownership spine unchanged, cascade order added.
- **Enables** `DESIGN-panel-sizing-cqi.md`/AUDIT-BRIEF: sizing gets ONE home in the node model → map-collapse
  (§3) + double-emission (§4) retire without a specificity fight.
- **Retires** two standing duplications: two grid primitives, two equal-height declarations.

## 8. ADR summary

**Decision:** one `resolveStyle` merge (①②③④) + a 3-boundary `@layer` cascade; one layout-node primitive
family as SSOT; `row` + bespoke page body retired by Strangler; dead `align` wired; five fitness functions.

**Rejected:** (1) *keep the inline-var trick, wire `align` locally, leave `row`* — symptom patch; root cause
(specificity fight, divergent change) recurs (Law 6). (2) *Full `@layer` sheet reorder now* — over-reach
(a985 §5), high-risk for gain the 3-tier boundary already delivers (YAGNI). (3) *New layout DSL replacing
NodeStyles+shells* — discards the strong engine + `LayoutItemProvider`; Golden Hammer.

**Trade-off (ISO 25010):** a one-time cascade-ordering migration (P0/P1 risk, mitigated by computed-style
snapshots + real-browser gate) for **maintainability + evolvability** (one representation, one precedence,
one primitive) and **Constructor usability** (every capability introspectable). Performance neutral (same
engine); reliability up (fewer counter-rules, fitness-locked).
