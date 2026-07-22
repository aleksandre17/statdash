# DESIGN-0113 — The Canonical Encoding Grammar (ENC-1)

**Status:** Proposed (apex study, card 0113 — Class M, design-only)
**Author:** architect · 2026-07-22
**Governing laws:** Law 1 (no privileged dims) · Law 2 (declarative) · Law 3 (arrow: core owns, charts consume) · Law 4 (standards whole, in their best form) · Law 8 (M-5/YAGNI) · Law 10 (one grammar per axis, ADR-041) · AR-36 (encoding binds to state) · AR-42 (interaction grammar) · ADR-049 (assembly-by-declaration) · E5 (color = tokens, never hex)

---

## 1. Thesis

The owner's observation is correct in substance and wrong in one detail. The platform's
`EncodingSpec` is not a toy **shape** — the channel *names* it holds (`label`/`value`/
`series`/`color`) are already role-canonical and, unlike Vega-Lite's literal `x`/`y`,
**rotation-stable** (a `_mark` donut⇄bar pivot rewrites no channel — ggplot's
coord-flip property, the *best form* of the Grammar of Graphics that Vega-Lite itself
lacks). What IS a toy is the **per-channel record and the channel *set***: no
`aggregate`, no `sort`, no `scale`, no `axis`/`legend`, no `size`/`opacity`/`text`/
`detail`, no facet doors, no condition-on-param — and, because those are missing,
four other structures have grown to carry what the grammar refused to hold:
`ChartDef` (axis/legend/palette), `FieldConfig` (scale-domain/format/thresholds),
the directional six-var record (`_xDim…_sortDir`), and per-spec-kind implicit
encodings. That is the projection-missing disease ADR-050 named, on the encoding
axis. The design: **keep the role channels, adopt Vega-Lite's per-channel field-def
grammar whole** (field · type · aggregate · bin · sort · scale · axis · legend ·
format · condition), widen the channel set with the VL mark-property channels as
declared extension points, and make every other encoding-shaped structure a
**projection of the one declaration** — additively, with today's 4-field shape a
byte-identical degenerate subset.

---

## 2. Ground truth — every encoding-shaped structure today

| # | Structure | Where | What it encodes |
|---|-----------|-------|-----------------|
| 1 | **`EncodingSpec`** | `platform/packages/core/src/data/encoding.ts:152` | The named grammar. Field-bearing channels `label` (required), `value`, `color`, `series` — each `EncodingChannel = string \| ChannelDef \| CtxScopeRef` (`:83`). Computed: `pct` (`:184`), `negate`. Pivot: `seriesFormat` (`:196`), `seriesOrder` (`:203`). `tooltip: string[]` (`:213`). Structural: `id`/`isSeparator`/`isTotal`/`level`/`parentId` (`:220–229`). |
| 2 | **`ChannelDef`** (R2) | `encoding.ts:62` | `{ field, type?: Q\|O\|N\|T, key? }` — measurement type + data-join key already landed additively (`deriveMeasurementType :125`). The canonical record EXISTS in embryo; it just carries 2 of VL's ~9 field-def facets. |
| 3 | **`DataRow`** | `encoding.ts:239` | The fixed channel-slot row (`id/label/series/value/pct/color/isTotal/…/provenance`). The real bottleneck: a new channel today = a new hand-added slot + interpreter edits. |
| 4 | **`applyEncoding` / `resolveEncodingRefs`** | `encoding.ts:322` / `:294` | The one apply seam + the AR-36 state-binding pre-pass (`CTX_BINDABLE_CHANNELS :292` — only the 4 field-bearing channels rotate). |
| 5 | **`ChartDef`** | `platform/packages/charts/src/types.ts:29` | Mark (`type`) + what VL holds *per channel*: `axes.x/y/y2` (`:39`), `legend` (`:45`), `tooltip`, `palette` (`:74`), `stacked`/`distributed`/`dataLabels`/`rangeSlider`/`compact`. A per-CHART overlay carrying channel-level law. |
| 6 | **`FieldConfig`** | `platform/packages/core/src/field/config.ts:59` | Grafana-style third overlay: `unit`/`decimals`/`min`/`max` (= scale domain + axis format), `colorMode`/`thresholds` (= a conditional color scale), `overrides` (per-series). |
| 7 | **Directional six-var record** | `platform/packages/core/src/data/directional.ts:69` (`DirectionalAxis`), consumed via `{$ctx:_xDim}`/`{$ctx:_byDims}` in provisioning (`apps/api/provisioning/geostat.provisioning.json:3749` binds `chartType:{$ctx:_mark}`), lowered at `resolveEncodingRefs`, `resolvePipeRefs` (`react/src/engine/resolveNodeRows.ts:235,272`) and `resolveChartType` (`plugins/panels/chart/default/useChartOutput.ts:43`) | `_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir` — a state→(mark + channel-assignment + sort + roll-up grain) function whose OUTPUT vocabulary is an encoding, typed as six loose strings. |
| 8 | **Fixed-shape DataSpec kinds** | `core/src/config/data-spec.ts:158` — `row-list` (`RowSpec :48`: per-row `label/color/negate/isTotal/pctOf`), `timeseries`, `growth`, `ratio-list`, `pivot` (`valueFields`+`colors` `:207`) | Each hardwires an *implicit* encoding the grammar never sees. |
| 9 | **`ColumnDef`** | `data-spec.ts:23` | The table projection: `key/format/bar/valueMappings` — per-column format + gauge + value-map (encoding-adjacent, table-view-owned). |
| 10 | **`ChartOutput.emphasis`** | `charts/src/types.ts:209`, resolved ad hoc at `useChartOutput.ts:25` | An OPACITY-condition channel (VL `opacity: {condition: param}`) attached to the *output*, never declared in the encoding. |
| 11 | **Authoring projections** | `apps/panel/src/features/data-layer/fieldwells/binding.ts:28` (`ENCODING_WELLS` = 4 wells, hand-listed), `editors/query/EncodingEditor.tsx:30` (5 text rows, hand-built), `inspector/controls/DataFacetField.tsx`, `workbench/workbenchModel.ts:32` | Every authoring surface re-enumerates the channels by hand — no channel registry to project from. |
| 12 | **`KpiSpec`** | `core/src/data/kpi-spec.ts` | A degenerate single-channel (point-read `value`) encoding. Out of ENC-1 scope; noted for the map. |

**Where render capability actually is** (the M-5 depth bound): interpreters
(`charts/src/interpreters/{cartesian,radial,special}.ts`) consume exactly
`label→category`, `series→series-split`, `value`, `color`/threshold-color, `pct`;
axes realize `unit/decimals/min/max/hidden`; legend `show/position`; palettes are
token-ramp *names* (`categorical`/`sequential`); `emphasis` dims categories;
`scatter`/`heatmap` are registered marks with no size channel yet. `ChartType` is an
open string (`core/src/core/context.ts:24`).

### 2.1 Shadow-encoding verdict (the 0102 question)

The perspective/vars `_mark/_xDim/_byDims` system **is a shadow encoding system in
its output vocabulary, but not a second grammar in its mechanism**. Mechanically it
is exemplary: ONE declared relation (`DirectionalSpec`, dimension-blind, Law 1),
resolved in core, spread as vars, consumed through the ONE ref dispatcher into the
ONE encoding/pipe/mark seams. What forks is the *type*: the six outputs are an
encoding-assignment (mark + label-channel + series-channel + roll-up grain + sort)
flattened into untyped strings, so the compiler cannot see that `_seriesDim` IS the
`series` channel. The unification (§7.1) is therefore a *typing* move, not a
plumbing move: `resolveDirectional` returns a typed **`EncodingPatch`**; the six
vars become a derived projection of it. No consumer changes.

---

## 3. The disease, named

One law — "which field drives which perceptual channel, on what scale, in what
order, with what guide" — is answered in **five places** (#1, #5, #6, #7, #8 above),
none of them complete, plus a sixth ad-hoc output channel (#10) and hand-enumerated
authoring surfaces (#11). Every new visual capability (a size channel, a log scale,
a threshold color) must today pick one of the five homes arbitrarily — the exact
"four containment grammars" shape ADR-041 killed on the containment axis, and the
worst possible substrate for E2's `encoding.edit` editor, which would freeze the
fork into the authoring surface and the saved-config corpus.

---

## 4. The designed grammar

### 4.1 Channel names: role-canonical, NOT positional (a named decision)

The channels stay **role-based** — `label` (category position), `value` (measure
position), `series` (scale-mapped grouping hue), `color` (identity per-datum fill)
— and do NOT rename to VL's `x`/`y`. Three reasons, in force order:

1. **Rotation stability (AR-36 is load-bearing).** `chartType:{$ctx:_mark}` rotates
   donut⇄bar⇄hbar with *zero* channel rewrites because roles, not positions, are
   declared. VL bakes orientation into `x`/`y` (horizontal bar = swap the two
   encodings); ggplot — the original Grammar of Graphics implementation — keeps
   `aes()` fixed and flips `coord_*`. Ours is the ggplot model: **orientation/
   coordinate belongs to the mark realization, never the encoding**. Law 4's "best
   form" clause decides for ggplot here.
2. **Byte-identical degeneracy for free.** Today's corpus needs NO alias pass —
   today's spec *is* the canonical spec, shallow. Migration risk collapses.
3. **The `color` collision.** A stored bare-string `color:'colorField'` means
   identity fill; VL's `color` means scale-mapped hue. Renaming `series`→`color`
   would make old and new configs shape-indistinguishable. Role names keep both
   channels honest: `series` = hue scale over a field; `color` = identity scale
   (VL's `scale: null` case, first-class here).

The VL↔ours channel correspondence is documented ON the type (it already is,
`encoding.ts:7–12`) and in the ChannelSchema registry (§6), so the mapping is
teachable and machine-readable.

### 4.2 The channel set

Field-bearing channels, every one `string | ChannelDef | CtxScopeRef`
(bare string = today's byte-identical degenerate form):

```
label     — category/position role      (VL x|y|theta by mark; REQUIRED, unchanged)
value     — measure role                (VL y|x|arc; default field 'value')
series    — scale-mapped grouping       (VL color/xOffset; drives multi-series + pivot)
color     — identity per-datum fill     (VL color with identity scale)
size      — mark size                   (VL size; realized: scatter/bubble)      [NEW]
opacity   — mark opacity                (VL opacity; home of emphasis/condition) [NEW]
shape     — point symbol                (VL shape; declared extension)           [NEW]
text      — data-label field            (VL text; declared extension)            [NEW]
detail    — extra series split, no hue  (VL detail; declared extension)          [NEW]
tooltip   — string[] (today) | ChannelDef[]  (widened, additive)
order     — draw/stack/legend order     (VL order; absorbs seriesOrder)          [NEW]
facet     — { row?, column? }           (VL row/column; declared extension door) [NEW]
```

`pct`, `negate`, and the structural channels (`id/isSeparator/isTotal/level/
parentId`) stay verbatim — `pct` is a platform-domain *computed* channel (Tableau
"% of total"), the structural ones are the hierarchy grammar's row metadata; both
are already declaration-shaped. `seriesFormat`/`seriesOrder` remain accepted
forever as degenerate forms of `series.format`/`order` (Postel).

### 4.3 The per-channel record — `ChannelDef` widened (all additive, all optional)

```ts
interface ChannelDef {
  field:      string                    // (existing) which obs field
  type?:      MeasurementType           // (existing R2) Q | O | N | T; derived when absent
  key?:       string                    // (existing R2) data-join identity
  aggregate?: ReducerAlias              // NEW  per-channel roll-up — LOWERED onto the ONE
                                        //      `aggregate` pipe op at normalize time (no 2nd engine)
  bin?:       boolean | { step?: number } // NEW  declared extension — lowers onto a derive op when built
  sort?:      'asc' | 'desc' | DimVal[] | CtxScopeRef // NEW  VL sort; array = explicit order ('using')
  scale?:     ScaleDef                  // NEW  see below
  axis?:      AxisDef                   // NEW  { title?: LocaleString, unit?, decimals?, min?, max?,
                                        //        hidden?, slot?: 'y'|'y2' }
  legend?:    { show?: boolean; position?: 'top'|'bottom'|'left'|'right' } // NEW
  format?:    string                    // NEW  FORMATTERS registry key (SSOT: core/data/transform)
  condition?: { param: string; value?: DimVal; else?: DimVal } // NEW  VL condition-on-param —
                                        //      the AR-36/AR-42 gesture→encoding declaration
}

interface ScaleDef {
  domain?: [number | null, number | null]      // absorbs FieldConfig.min/max long-term
  scheme?: string                              // TOKEN-RAMP NAME ('categorical'|'sequential'|registered) — E5: never hex
  type?:   'linear' | 'identity' | string      // open registered string (log/sqrt = registration, OCP)
}
```

**Depth bound (M-5/YAGNI, per the card's Notes):** `scale`/`axis`/`legend` carry
exactly what the renderers realize today (`unit/decimals/min/max/hidden`,
`show/position`, token-ramp scheme names, identity) — plus *open-string registry
doors* (`scale.type`, `scheme`) so log scales, diverging ramps, etc. are
registrations, never core-type edits. Nothing speculative is implemented; every
door is declared.

**State binding (AR-36) as declaration:** unchanged mechanism, widened reach —
`CTX_BINDABLE_CHANNELS` grows with the field-bearing set, and `sort` accepts a
`CtxScopeRef` (it already does inside pipe steps). A gesture that must *rotate* the
encoding binds `{$ctx: var}` on the channel; a gesture that must *restyle* marks
binds `condition: { param }` on the channel. Both are declarations on the ONE type;
neither is a config rewrite.

**Serialization:** 100% JSON, no functions (Law 2), same file, same public name
`EncodingSpec` exported from `@statdash/engine`. The widening is additive —
`contractVersion` minor bump in the `describeApp` read model.

### 4.4 Where it lives

`packages/core/src/data/encoding/` (module split: `channels.ts` · `scale.ts` ·
`normalize.ts` · `apply.ts`), public surface re-exported unchanged. **Not
`contracts`**: `apps/api` never authors encodings; contracts is the zero-dep wire
boundary, and relocating would churn six alias maps for zero consumers (rejected,
§10.4). Core owns the grammar; charts consumes the *normalized* form through
`interpretChart`; react lowers refs — the arrow holds exactly as today.

### 4.5 `DataRow` / apply

`applyEncoding` stays the ONE apply seam. Realized new channels add **optional**
`DataRow` slots (`size?`, `opacity?`, `text?`) additively; `detail` folds into the
join id; unrealized channels are carried but inert (the canvas never lies: an
undreamt channel renders nothing rather than something fake). Existing slots and
their semantics are untouched — byte-identity is structural, not incidental.

---

## 5. Cascade law — how the overlays become projections

Grafana's proven cascade is kept, but its *direction* is declared:
**def-level settings are channel DEFAULTS; channel-level settings WIN.**

- `ChartDef.axes.x/y/y2` → defaults for `label.axis`/`value.axis`/`axis.slot:'y2'`;
  `ChartDef.legend`/`tooltip` → defaults for `series.legend`/`tooltip` channel.
  Merged at ONE seam in the chart adapter (where `ctx.fieldConfig` already merges,
  `useChartOutput.ts:107`). `ChartDef` keeps these keys indefinitely (they are the
  right ergonomic for chart-wide settings) — but they are now *defined as* the
  degenerate broadcast form of per-channel records, so the E2 editor edits one
  model with two zoom levels, not two models.
- `FieldConfig` (`unit/decimals/min/max`) → same cascade tier (it already merges
  upstream of `interpretChart`); `thresholds`/`colorMode` are declared the
  *conditional-scale* projection and migrate INTO `value.scale`/`color.condition`
  only when the threshold editor is next touched (no forced churn).
- Fixed-shape DataSpec kinds (`row-list`/`timeseries`/`growth`/`ratio-list`/
  `pivot`) are re-documented as **preset partial encodings** (ADR-049 P2b
  Composed-Preset language): each kind's resolver *emits* its implicit encoding
  through the one grammar. No behavior change; the read model can now SHOW what a
  `growth` spec encodes.
- `ColumnDef` stays the table VIEW's declaration (per ADR-041 the table is a
  Part-declared element); its `format` SSOT is the same FORMATTERS registry the
  channel `format` names. No absorption (YAGNI) — but no third format vocabulary
  either.

---

## 6. Constructor projection — the ChannelSchema registry (the E2 contract)

The grammar ships its own authoring declaration, per ADR-049 assembly-by-declaration:

```ts
// packages/core/src/data/encoding/channels.ts
interface ChannelSchema {
  channel:  string                       // 'label' | 'series' | …
  role:     'measure' | 'dimension' | 'any'   // what wellAccepts derives from
  required: boolean
  vl:       string                       // documented VL correspondence ('x|y', 'color', …)
  recordFields: readonly ChannelRecordFieldId[] // which ChannelDef facets this channel honors
  realized: 'full' | 'partial' | 'declared'    // honest capability state (canvas-never-lies)
}
export const CHANNEL_REGISTRY: readonly ChannelSchema[]
```

- `describeApp()` gains an **`encodingChannels` axis** (same pattern as
  `chartTypes`/`specTypes`/`transformOps`, locked by `constructor.fitness.test.ts:45`).
- **E2's `encoding.edit` step editor renders generically over the registry** — one
  channel-row component × N declared channels, per-channel record fields projected
  from `recordFields` via the existing FieldControlRegistry idiom. The current
  hand-built `EncodingEditor.tsx` (5 hardcoded rows) and `ENCODING_WELLS`
  (`binding.ts:34` hand list) become projections: `ENCODING_WELLS = registry.filter(realized)`,
  `wellAccepts` = the declared `role`. The byte-identical bare-string write
  discipline (`binding.ts:44` comment) is preserved — the editor writes the
  degenerate form until the author opens a channel's "advanced" facet.
- Audience planes (AR-52): `recordFields` entries carry the standard
  author/steward/system plane tags so the inspector projects `key`/`condition`
  to stewards only.

---

## 7. Unifications delivered by ENC-1

1. **Directional → typed `EncodingPatch`.** `resolveDirectional` returns
   `{ mark: string; channels: Partial<Pick<EncodingSpec,'label'|'series'>>;
   groupBy: string[]; order: { field: string; dir: 'asc'|'desc' } }`;
   a pure `projectAxisVars(patch): DirectionalAxis` derives today's six vars
   byte-identically (extend `directional.fitness.test.ts` matrix to assert
   projection ≡ legacy table). Wire form, consumers, provisioning: untouched.
   Future emit profiles (`emit:'facet'`?) return patches, never new var sextets.
2. **Emphasis → `opacity.condition` declaration.** The AR-42 highlight action's
   param is *declarable* as `opacity: { field?, condition: { param } }`;
   `resolveEmphasis` (`useChartOutput.ts:25`) becomes the lowering of that
   declaration (the hand-wired `on[].actions` scan remains the degenerate form).
   `ChartOutput.emphasis` stays the neutral output — unchanged.
3. **One format vocabulary** — channel `format` names the FORMATTERS registry;
   `seriesFormat` and `ColumnDef.format` are its degenerate/peer forms.
4. **One color law** — `scheme` = token-ramp names end-to-end (E5); `color` =
   identity scale; thresholds = declared conditional-scale trajectory. No hex in
   any encoding, ever (fitness).

---

## 8. Migration — Strangler, corpus-fitness-fenced

**The degenerate-subset law:** every stored `EncodingSpec` today is *already* a
valid canonical spec (role names kept, all new fields optional). There is no
old→new rewrite, no normalization of channel names — only two accepted-forever
degenerate forms (`tooltip: string[]`, `seriesFormat`/`seriesOrder`) that
`normalizeEncoding` (pure, reference-preserving fast path — the `resolveEncodingRefs`
pattern) lifts internally.

| Phase | Content | Risk |
|-------|---------|------|
| **E0** (pre-E2, ~1–2 sessions) | Widened `ChannelDef`/`EncodingSpec` types + `ScaleDef`/`AxisDef` + `CHANNEL_REGISTRY` + `normalizeEncoding` + `describeApp().encodingChannels` + fitness set (§9). Zero consumer change. | **Low** — purely additive types; corpus byte-fitness proves it. |
| **E1** | Cascade seam: `ChartDef.axes/legend` + `FieldConfig.unit/decimals/min/max` declared as channel defaults at the ONE adapter merge; `aggregate`/`sort` channel facets lowered onto the existing pipe ops in `normalizeEncoding`. | **Medium** — merge-precedence is where byte-identity can break; fenced by the corpus fitness + chart snapshot tests (`chartApexLocale`/`chartTemplateInterp` walk the full provisioning corpus already — reuse the walker). |
| **E2 (external)** | The `encoding.edit` editor + field wells re-render over `CHANNEL_REGISTRY`. | Low — authoring-only; bare-string write discipline keeps configs byte-identical. |
| **E3** | Directional typed patch + derived vars; `opacity.condition` declaration + lowering. | **Low** — parity-locked by the existing directional state-matrix fitness. |
| **E4+** (trigger-gated) | `size` for scatter · `text` channel · threshold→conditional-scale absorption · `facet` realization. Each = registry `realized` flip + one adapter arm. | Per-slice. |

**What chart kinds gain immediately** (E0–E1, renderer already capable): per-channel
axis config, `y2` slot assignment, per-channel `sort` (absorbs `seriesOrder`),
`format` (absorbs `seriesFormat`), typed tooltip channels, `aggregate` on a channel
(lowered to the existing op). **Via extension points:** size/shape/text/facet/bin/
log-scales — declared now, realized when a consumer triggers.

---

## 9. Fitness functions (the invariants, machine-held)

- **FF-ENCODING-CANON-BYTE** — for every encoding in the provisioning + test corpus:
  `applyEncoding(normalizeEncoding(e))` ≡ `applyEncoding(e)` (DataRow[] deep-equal)
  and `interpretChart` output deep-equal. (Extends `encoding.postel.fitness.test.ts`.)
- **FF-ONE-ENCODING-GRAMMAR** — ratchet: no NEW interface outside
  `core/data/encoding/` may declare channel-vocabulary members (`label`+`value`+
  `series`… co-occurring); the five known legacy carriers are the frozen allowlist.
- **FF-DIRECTIONAL-PATCH-PARITY** — `projectAxisVars(resolveDirectional(s,p))` ≡ the
  legacy six-var table across the full state matrix.
- **FF-CHANNEL-SCHEMA-COMPLETE** — every field-bearing channel on `EncodingSpec`
  has a `CHANNEL_REGISTRY` entry (compile-time `AssertSchemaCovers` idiom,
  `schema-contract` pattern) and `describeApp().encodingChannels` is non-empty.
- **FF-NO-HEX-IN-SCALE** — no `scale.scheme`/`condition` value matches
  `#[0-9a-f]{3,8}` anywhere in the config corpus (E5).

---

## 10. Rejected alternatives

1. **Adopt Vega-Lite verbatim (npm types / VL-as-compiler).** Rejected. VL's spec
   surface presumes VL's *runtime* (Vega compilation, its scale resolution, its
   orientation-in-encoding model). Our pipeline is DataRow→ChartOutput→Apex/SVG;
   grafting VL types imports positional x/y (breaking AR-36 rotation stability,
   §4.1), the `color` collision, a schema-evolution dependency we don't render
   with, and no home for `CtxScopeRef`/token-ramp laws. *Adopt the grammar, not
   the artifact.* (Trade-off surrendered: free VL ecosystem tooling/validators.)
2. **Status quo + per-need patches (keep per-chart ad-hoc encodings).** Rejected.
   The five-carrier fork is the disease; every future channel forks again; and E2
   would freeze the toy shape into the authoring surface and a growing authored
   corpus — the single most expensive moment to defer. (Trade-off surrendered:
   zero short-term design cost.)
3. **Full VL spec surface now (layer/concat/repeat/params/projection + all
   channels realized).** Rejected on M-5/YAGNI and on Law 10: VL's `layer`/
   `concat` are *composition* — that axis is owned by the Part grammar (ADR-041);
   importing a second composition grammar is build-forbidden. Params/selections
   are owned by the interaction grammar (AR-36/AR-42) — `condition`+`$ctx` are
   the declared join points, not a parallel param system. (Trade-off surrendered:
   day-one trellis/layering.)
4. **Relocate the grammar to `packages/contracts`.** Rejected: no `apps/api`
   consumer, six alias-map churn, and contracts' zero-dep discipline would force
   `CtxScopeRef`/`ReducerAlias` extraction for nothing. Revisit only if the API
   ever authors encodings (server-side rendering trigger).

---

## 11. Sequencing verdict

**Confirmed: E0 lands BEFORE the E2 `encoding.edit` editor is built** — the editor
is a projection of the declaration (ADR-038/049); building it over the toy shape
would hand-enumerate channels a fifth time and bake the 4-field record into
authoring UX + saved configs precisely when authored-corpus growth accelerates.
E0 is deliberately small (types + registry + normalize + fitness, no consumer
change) so it does not delay E2 materially. E1/E3 may proceed after or alongside
E2; E4+ is trigger-gated. WIP=1 discipline: E0 is one card.

---

## 12. ADR summary

**Decision:** One canonical encoding grammar in `packages/core`: role-named
channels (rotation-stable, ggplot-coord model) + the full Vega-Lite per-channel
field-def record adopted whole at realized depth with open registry doors; every
other encoding carrier (ChartDef overlays, FieldConfig, directional vars, spec-kind
presets, authoring surfaces) re-defined as projections/degenerate forms of that one
declaration; `CHANNEL_REGISTRY` makes the grammar self-describing for the
Constructor. Additive throughout; corpus byte-fitness is the gate.
**Rejected:** VL-verbatim dependency · status-quo ad-hoc · full-VL-surface-now ·
contracts relocation (§10).
**Trade-off named:** we forgo VL ecosystem interop tooling to keep rotation
stability, Law-2 state binding, and the token color law native; we accept a
documented VL-correspondence table as the interop bridge instead.
