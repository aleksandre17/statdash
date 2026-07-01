---
title: Platform & Constructor Vision (Config Object, SDUI Renderer, Authoring North Star)
status: Proposed (vision / direction-setting)
date: 2026-06-24
authors: architect (Opus)
consolidates: adr_config_and_render_vision, adr_constructor_vision_north_star
supersedes: architect memory adr_config_and_render_vision + adr_constructor_vision_north_star (now slim pointers)
---

# ADR-002 — Platform & Constructor Vision

**Status:** Proposed (vision / direction-setting; sets the finish-line target the codebase migrates toward, Law 7). Not a build order — each capability is trigger-gated (YAGNI). Concrete phased build lives in [[ADR-003]] (Constructor).

## Context

Two vision records own two of the platform's three axes: (1) the **config-object + SDUI rendering system** (is the serialized config a true SSOT, is `render(config)→UI` pure, is the contract enforced and published), and (2) the **authoring north star** — the Constructor (`apps/panel`) as the best real builder a statistician with zero code can use to author *anything the renderer can render*. Both were benchmarked against best-in-class (Vega-Lite, Grafana, Builder.io, Adaptive Cards, JSON Forms, RSC, Radix for the config/render axis; Webflow, Builder.io, Plasmic, Grafana, Tableau, Notion, Figma, JSON Forms, Sanity for the authoring axis). The renderer and config grammar are already close to best-in-class; the gaps are contract-enforcement and authoring-coverage, not the core model.

## Decision

- **Treat the config object as the Single Source of Truth** and `render(config)→UI` as pure/deterministic; enforce the invariants that are currently convention as fitness functions.
- **Finish-line P1 set (config/render axis):** (1) enforce the config contract server-side (`validateConfig` in `apps/api` on save, the same fn the renderer calls on render); (2) publish a config JSON Schema / SemVer'd capability manifest as the external contract; (3) full-page lossless round-trip; (4) generated whole-config JSON Schema; (5) color-SSOT migration. Gold-plating is explicitly deferred with doors left open.
- **Authoring north star:** the Constructor must LEAD on coverage (every renderer capability is authorable — FilterSchema, the 16 transform ops, VisibilityExpr, by-mode/pivot) then follow with non-programmer ergonomics (field-wells, Show-Me, slash commands, templates, a 4-pane shell). Coverage leads; ergonomics follow.

## Rejected Alternatives

1. **Adopt Vega-Lite (or Grafana's model) wholesale as the config format** — REJECTED: adopt the *grammar of graphics* whole (Law 4) but keep our own config object; Vega-Lite has no page/section/SDUI/semantic-layer/Constructor-coverage model, and Grafana's panel-JSON is not a lossless authoring SSOT. Steal the ideas, not the schema.
2. **RSC / server-driven component streaming as the rendering system** — REJECTED: it is not a serializable, round-trippable, Constructor-authorable artifact; a function/stream in the contract is not builder-ready (Law 2 / §12).
3. **Adopt RJSF or Craft.js as the Constructor foundation** — REJECTED: RJSF generates forms from JSON Schema but cannot express our PropSchema/coverage/live-canvas model; Craft.js owns its own node model, competing with our engine's `NodePageConfig` SSOT. Adopt narrow libs instead (dnd-kit, cmdk, react-colorful); refuse frameworks that own the model.
4. **Ship ergonomics-first (nice UX over incomplete coverage)** — REJECTED: a beautiful builder that cannot author half the renderer's capabilities is not the north star; coverage is the gate, ergonomics the follow.

## Consequences

- Positive: the config contract becomes externally publishable and machine-enforced; the Constructor's target is measurable (coverage-gap audit); the platform's moat (lossless no-code spine) is preserved by keeping everything declarative.
- Negative / cost: server-side validation + published schema + full round-trip are real P1 work; coverage-first sequencing defers some ergonomic polish.
- Fitness functions: one-body cohesion invariants F1–F6 (config/render), coverage-gap fitness (authoring), round-trip fitness.

---

## Detailed Records (preserved verbatim from architect memory)

> Two original vision records follow, migrated from `.claude/agent-memory/architect/`.

### A. The Config Object & The Rendering System (one body)

# Vision ADR — The Config Object & The Rendering System (one body)

Status: PROPOSED (vision/strategy). Author: architect (Opus). Scope: design + research only.
Companion ADRs: [[adr-constructor-phase2]] · [[adr-element-config-schema-seam]] · [[adr-platform-structure-rearchitecture]] · [[adr-constructor-g3-live-preview]] · project_page_presentation_seam_adr.

**Why:** finish-line priority reshape. We are close to best-in-class on the renderer and the config grammar; the real gaps are (1) the config contract is NOT enforced server-side, (2) there is no published config JSON Schema / SemVer'd capability manifest as an external contract, (3) cohesion (one-body) is enforced by convention in several places that should be fitness functions.
**How to apply:** treat the "must-do-for-highest-standard" set below as P1 finish-line; treat the gold-plating set as explicitly deferred with doors left open.

---

## 0. Actual architecture (mapped from code, board is stale)

Config object (the SSOT artifact):
- `NodePageConfig = (_PageNode<'inner-page'|'tab-page'|'container-page'> & PageConfigBase)` — packages/react/src/engine/types/node.ts. **The page IS the root node** (no `root` wrapper). Composite tree of `NodeBase` (type · id · variant · data · view · vars · transforms · fieldConfig · dataLinks · on · visibleToRoles · storeKey).
- `NodeDef = CoreNodeDef | NodeTypeMap[keyof NodeTypeMap]` — open via `declare module` augmentation. Engine has ZERO knowledge of concrete node shapes (OCP done right).
- `DataSpec` discriminated union (core/src/data/spec.ts): query · row-list · timeseries · growth · ratio-list · by-mode · pivot · transform · custom. 100% JSON-serializable, dispatched by Strategy via `defaultRegistry.spec(type)`; `interpretSpec` + `extractRequirements` (static analysis for prefetch/warm).
- `EncodingSpec` (core/src/data/encoding.ts) = explicit Vega-Lite grammar-of-graphics mapping (label/value/series/color/pct). Long-format invariant ("data is never pivoted; encoding tells the renderer how").
- `presentation: PagePresentation` = generic projector-keyed bag (N-ADR-0029 v2). Renderer iterates the presentation-projector registry; names NO concrete key. New page-level concern = new projector registration, zero renderer/type edits.
- `view: ViewParams` = HOW/WHEN (layout/visibility/display). `vars: VarMap` = node-scoped derived values via a sandboxed VarExpr grammar (find/breadcrumbs/ref) — NOT functions.
- FilterSchema (`defineFilters`) — declarative filter bars, effects, crossValidate, computed.
- PropSchema (`PropField[]`) — the Constructor inspector contract, incl. `enum-ref` + `source` (cube.measures/dimensions/members, dataSpecs, tokens, pages) for runtime catalog discovery, `showWhen`, `localized` coverage. Bridged to JSON Schema Draft-7 (one-way) via propSchemaToJsonSchema.ts.

Rendering system:
- `renderNode()` (packages/react/src/engine/renderNode.ts) = Builder.io/Grafana-class 8+4 step pipeline: RBAC gate → migrate → visibleWhen → validate → middleware.before → resolveRows(+transforms) → compare wiring → node vars → view/fieldConfig cascade → shell lookup → lazy children proxy + SlotDef named slots + slot-placement warn → ErrorBoundary → Suspense → middleware.after. **Zero if/switch on node.type.**
- `NodeRegistry` (type::variant → renderer + meta) — defaults, slots, validate, migrate, errorFallback, caps, schema. `describeRegistry()`/`describeApp()` emit a JSON-serializable capability MANIFEST (palette · propertySchemas · chartTypes · specTypes · modes · datasourceKinds · transformOps · metrics · exportFormats · filterControlTypes). This is genuine SDUI capability-discovery.
- Chrome: `ChromeSlot` resolves page-override → site-default → 'default' (Grafana override-chain semantics), per-facet variant+config; `NullChromeSlot` = Null Object. Zero-prop shells read config via `useSlotConfig()`.
- Targets: ONE `renderNode` drives `'dom'` (SiteRenderer) AND `'html'` (renderPageToHTML / renderToStaticMarkup) with `'pdf'`/`'api'` declared as additive RenderTarget seams. Presentation projected IDENTICALLY in both paths.
- Constructor round-trip: canvasPageAdapter.ts `toNodePageConfig` / `fromNodePageConfig` — flat Identity-Map store ⇄ engine tree, stated lossless invariant with a fitness function (roundtrip-pages.fitness.test.ts).
- Migration: `migratePageConfig` lazy-on-read in apps/api pages route, version-gated, forward-compat 409 (RFC 9457) when stored schemaVersion > server. CURRENT_SCHEMA_VERSION = 1 (no migrations registered yet — the chain exists, unused).
- Versioning/governance: config.page_version is append-only immutable; publish is an atomic FSM (exactly one published version); admin-gated; audit-logged.

Cohesion spine: `@statdash/styles` = single token catalog (TS constants → CSS var refs) + TOKENS_CATALOG self-describing for the panel. Dependency arrow enforced by `eslint no-restricted-imports` build gate. Fitness culture already real: roundtrip-* , schema-completeness, no-magic-vars, no-tenant-content, second-tenant, presentation.render, paletteCompleteness, tokens.parity.

---

## 1. Lead/Lag vs best-in-class

### Config object

| Dimension | Best-in-class ref | Our position | Verdict |
|---|---|---|---|
| Grammar-of-graphics encoding | Vega-Lite | EncodingSpec is a faithful subset; long-format invariant held | **PARITY (lead on data-source agnosticism)** |
| Declarative-no-logic (no fns in config) | Adaptive Cards, Form.io | Enforced as a law + `custom.fn` is a registry KEY (string), VarExpr is a sandboxed grammar | **LEAD** |
| Discriminated-union + registry OCP | Grafana panel plugins, Builder.io | NodeTypeMap `declare module` augmentation — engine zero-knowledge | **LEAD (cleaner than Grafana's runtime-only plugin model)** |
| Capability manifest / discovery | Builder.io registered components, Backstage templates | describeApp() emits full JSON manifest across 10 axes | **PARITY/LEAD** |
| Config cascade (config → group → instance) | Vega config cascade, Grafana fieldConfig defaults/overrides | fieldConfig cascades; chrome override-chain; view defaults | **PARITY** |
| Schema-driven authoring UI | JSON Forms, RJSF | PropSchema + enum-ref runtime sources + showWhen + one-way JSON-Schema bridge | **PARITY (lead on runtime catalog binding)** |
| **Published config JSON Schema as contract** | Vega-Lite ships `vega-lite-schema.json`; Grafana has a dashboard schema | We have PropSchema (per-node, authoring) but NO whole-config JSON Schema published as the wire contract | **LAG** |
| **Server-side config validation** | Adaptive Cards host validation; any SDUI server | apps/api stores config as `z.record(z.unknown())` — opaque JSONB, ZERO structural validation on save | **LAG (real)** |
| Schema versioning + migration | Grafana schemaVersion + migrators, ProseMirror schema versions | Chain exists (migratePageConfig, 409 forward-compat) but UNUSED (v1, no migrators) — unproven | **PARITY-on-paper, LAG-in-practice** |
| View composition / spec nesting | Vega-Lite layer/facet/concat/repeat | We have node tree + slots + `repeat` cap, but no first-class layer/facet/concat *spec* operator | **LAG (minor; YAGNI for dashboards)** |
| Structured-content portability | Portable Text, Block Protocol | Our tree is portable JSON but not a published interchange format | **N/A for now** |

### Rendering system

| Dimension | Best-in-class ref | Our position | Verdict |
|---|---|---|---|
| Generic type-agnostic interpreter | Builder.io, Grafana | renderNode zero-switch, registry dispatch | **LEAD** |
| Multi-slot composition | Builder.io slots, Radix Slot, web `<slot>` | SlotDef named slots + accepts contract + render-time placement warn | **PARITY/LEAD** |
| Slot-as-merge (asChild) | Radix Slot | We compose by registry lookup (getShell) not prop-merge; different model, both valid | **PARITY** |
| Crash isolation | Grafana panel error boundary | per-node NodeErrorBoundary + per-slice errorFallback | **PARITY** |
| AOP / middleware | (rare in SDUI) | middleware.before/after registry (edit overlay, analytics) | **LEAD** |
| Multi-target from one config | Grafana render service (panel→image), RSC | dom + html share renderNode; pdf/api seams declared | **PARITY/LEAD** |
| Server components / streaming | React Server Components | We are client-render + static-HTML; no RSC/streaming-data Suspense story yet | **LAG (intentional; RSC is a big door)** |
| Lazy child rendering | (rare) | makeLazyRendered Proxy — only active tab renders | **LEAD** |
| Theming spine | design-system tokens, Vega config | single @statdash/styles token catalog + CSS-var cascade + data-theme | **PARITY** |
| App-agnostic core | (the hard part) | packages/react carries zero tenant literal (fitness-enforced); Geostat specifics in plugins | **LEAD** |

---

## 2. Highest standards — do we meet them (Law 4: full benefit, not partial)?

- Config = SSOT, render is pure `render(config)`: **YES** (renderNode deterministic; dom/html share it).
- Lossless visual↔JSON round-trip: **YES** (fitness-enforced) — but only for the node TREE; PageConfigBase fields beyond id/path/children are dropped by toNodePageConfig (it hardcodes inner-page + id/path/children). **PARTIAL.**
- Declarative-over-imperative / no code in config: **YES** (law + sandboxed VarExpr).
- Schema-driven & contract-first: **PARTIAL** — contract-first at the AUTHORING layer (PropSchema), NOT at the WIRE/STORAGE layer (server takes any JSON).
- Capability discovery / "Constructor sees only what's registered": **YES** (describeApp + paletteCompleteness fitness).
- Safe expression evaluation: **YES** (VarExpr grammar, no eval).
- DataSource port: **YES** (DataStore swap = one param; fromSDMX is the only adapter boundary).
- Schema versioning via expand-contract: **MECHANISM YES, PRACTICE UNPROVEN.**
- Grammar-of-graphics whole: **YES for encoding**, partial for view-composition operators.

---

## 3. Our real problems (root-cause, not symptom)

P-1 **The wire contract is unenforced.** apps/api/routes/config/pages.ts validates `config: z.record(z.unknown())`. The single richest invariant in the platform — "this JSON is a valid NodePageConfig" — is checked in the browser and on no other side. Root cause: the validation logic (NodeRegistry.validate, PropSchema) lives in packages/react (app-tier), which the arrow forbids apps/api from importing. So the server CANNOT reuse it. This is a genuine architectural seam gap: **there is no engine-tier, React-free config validator.**

P-2 **No published whole-config JSON Schema.** Vega-Lite's moat is partly its `.schema.json`: editors, validators, LLMs, and third parties all consume it. We emit per-node PropSchema and a one-way bridge, but never assemble the whole-document schema. Without it, "config is the contract" is aspirational at the document level.

P-3 **PageConfigBase is not in the round-trip.** toNodePageConfig hardcodes `{ type:'inner-page', id, path, children }` — frame, chrome, color, presentation, filterSchema, vars, modeOrder, schemaVersion are all DROPPED on canvas serialize. The lossless fitness function only covers the subtree, so this passes green while silently losing page-level config. **This is the most dangerous gap because a fitness function gives false confidence.**

P-4 **Migration chain is dead code.** Good that it exists; but a versioning mechanism never exercised is a mechanism you don't know works. First real schema change will be the integration test.

P-5 **Two parallel "config base" smells** — PageConfigBase mixes structural (id/path/children-via-intersection) with presentational (color, frame) with capability (filterSchema, presentation, vars). color lives BOTH as a flat field AND as a presentation projector key (buildStaticContext folds it). SSOT wobble — which is authoritative? (Currently presentation wins via fold, but the flat `color` field invites drift.) Relates to [[adr-element-config-schema-seam]] base-minimality concern at the PAGE level.

---

## 4. Hybrid best-of-breed (the target)

### Config object
Keep our spine (it's strong): Composite tree + DataSpec union + EncodingSpec + presentation-projector + PropSchema + describeApp manifest. Add the three things the leaders have and we lack:

1. **An engine-tier, React-free structural validator** (`packages/core` or a new `packages/contracts`-adjacent `validateConfig(config): Problem[]`). This is the Vega-Lite/Adaptive-Cards move: validation is a property of the SPEC, not of the renderer. Then BOTH apps/api (on save) and packages/react (on render) call the same validator. The PropSchema/NodeRegistry validators stay for RICH per-node authoring feedback; the engine validator is the STRUCTURAL floor (valid types, required fields, slot-accepts, schemaVersion present). Pattern: move the invariant down the arrow to where every consumer can reach it.
2. **A generated whole-config JSON Schema** assembled from describeApp() (compose the per-node PropSchemas + the DataSpec union + PageConfigBase into one Draft-2020-12 document, published as a build artifact / `GET /api/schema/page-config`). This makes the config a real external contract (editors, LLM authoring, third-party validation) and is the document-level expression of Law 4.
3. **SemVer the capability manifest.** describeApp() output IS the published contract (panel ships externally — [[project-panel-external-product]]). Stamp it with a contract version; a fitness function asserts removed capabilities = major bump (expand-contract / parallel-change for the manifest, not just for stored configs).

### Rendering system
Keep renderNode (it leads). Targeted additions:

4. **Make PageConfigBase round-trip-complete.** toNodePageConfig must carry ALL PageConfigBase fields (frame/chrome/color/presentation/filterSchema/vars/modeOrder/schemaVersion), and the lossless fitness function must assert a FULL NodePageConfig (not just the subtree) survives. Fixes P-3 directly.
5. **Resolve the page-`color` SSOT.** color becomes a presentation projector key ONLY; the flat PageConfigBase.color field is deprecated (expand-contract: keep reading it during migration, stop writing it). One authoritative home.
6. **First real migration as proof.** Use #5 (color → presentation.color) as schemaVersion 1→2 to exercise the migration chain end-to-end. Kills P-4 by making the mechanism load-bearing.

### Forward coherence (services, not bolted-on)
- apps/api gains `validateConfig` (engine-tier) at the save boundary AND serves the generated JSON Schema. Constructor/panel keeps using describeApp + PropSchema for authoring; same validator now backs save-guard.
- data layer unchanged (DataStore port is already right).
- The contract triad becomes: **engine validator (structural floor) · PropSchema (authoring richness) · generated JSON Schema (external/wire).** All three derive from the SAME registry — SSOT preserved.

---

## 5. One body — cohesion & growth strategy (the user's heart)

What FORCES cohesion today (keep + harden):
- The dependency arrow (eslint gate) — structural cohesion.
- @statdash/styles single token catalog + CSS-var cascade — visual cohesion. No shell hardcodes a color/space; everything is a token.
- The registry pattern everywhere (node/chrome/spec/chart/metric/transform/export/filter-control/presentation-projector) — ONE way to add a capability. describeApp aggregates them — ONE discovery surface.
- Fitness functions already pinning: round-trip, palette completeness, schema completeness, no-magic-vars, no-tenant-content, token parity, second-tenant.

What RISKS drift/entropy (the entropy ledger):
- **Capability added in N places.** A new node type must touch: NodeRegistry (renderer+meta+schema), maybe a DataSpec resolver, maybe a presentation projector, the palette (auto), the Constructor inspector (auto via PropSchema). The auto paths are great; the manual ones (schema authoring) are where drift enters — a node registered WITHOUT a schema renders but can't be authored. *schema-completeness.fitness already guards this — good.*
- **Server/client contract divergence** (P-1) — the #1 entropy source. The server accepts configs the client would reject.
- **Page-level config bypassing the round-trip** (P-3) — config that exists in JSON but the Constructor can't see/edit.
- **The flat-field-vs-projector duplication** (P-5) — every such pairing is a future SSOT bug.

The invariants that keep it whole (encode as fitness functions):
- **F1 (server=client contract):** `validateConfig` is the SAME function on both sides; a test feeds the api save-validator a corpus of configs and asserts identical accept/reject to the renderer's structural gate.
- **F2 (full-page round-trip):** `fromNodePageConfig(toNodePageConfig(p)) ≡ p` for a FULL NodePageConfig including all PageConfigBase fields (not just the subtree). *Upgrade the existing test.*
- **F3 (manifest = palette = schema):** every registered placeable type has a PropSchema AND appears in the generated JSON Schema AND in the palette. (Extends schema-completeness + paletteCompleteness to the JSON-Schema artifact.)
- **F4 (manifest SemVer):** describeApp() contract version bumps major when a capability key/field is removed (snapshot test).
- **F5 (one home per datum / no privileged dimension):** no PagePresentation concern also exists as a flat PageConfigBase field (catches P-5-class drift); extends the existing no-magic-vars discipline to the page level.
- **F6 (token-only styling):** no shell literal hex/px outside the token catalog (extends tokens.parity to a lint over plugins/react shells).

Growth orientation: the platform scales to many tenants/capabilities/datasets WITHOUT entropy precisely because adding a capability = registering in ONE registry + the manifest aggregates + the fitness functions refuse a half-registered capability. The discipline to protect: **every new capability must be reachable by all three contract faces (validator, PropSchema, JSON Schema) or a fitness function fails.** That is the one-body guarantee.

---

## 6. Prioritized recommendation set (decision-grade)

### MUST-DO for highest standard (finish-line P1)
1. **Engine-tier `validateConfig` + wire it into apps/api save** (fixes P-1). Move the structural floor down the arrow so server and client share it. Fitness F1. *Highest ROI; closes the single biggest contract gap.*
2. **Full-page round-trip** — carry all PageConfigBase fields through toNodePageConfig; upgrade the lossless fitness to a full NodePageConfig (fixes P-3). *Removes false-green confidence — do BEFORE shipping more page-level config.*
3. **Generated whole-config JSON Schema** from describeApp(), served at `GET /api/schema/page-config` + emitted as a build artifact (fixes P-2). Fitness F3. *The document-level "config is the contract."*
4. **Resolve page-color SSOT → projector-only, via the first real migration v1→v2** (fixes P-4 + P-5). Proves the migration chain. Fitness F5.

### SHOULD-DO (cohesion hardening, low cost)
5. SemVer the describeApp manifest + snapshot fitness F4 (panel is an external product — the manifest is its API).
6. Token-only styling lint F6 across plugins/react shells.

### GOLD-PLATING (defer, doors open — do NOT build now)
- First-class Vega-style view-composition operators (layer/facet/concat as DataSpec/node operators). YAGNI for statistical dashboards; the node tree + repeat covers current need. Door: it's an additive DataSpec/node type.
- React Server Components / streaming-data Suspense. Big one-way-ish door; current dom+html targets meet the need. Revisit only if data-heavy first-paint becomes a measured problem.
- Portable Text / Block Protocol interchange export. No consumer asking. Door: the tree is already portable JSON; an exporter is additive.
- PDF/api RenderTargets — seams declared, build when a real consumer (bulletin PDF, headless API) is funded.

**Sequence:** 1 → 2 (these two are the integrity floor; do first, together) → 3 (builds on the same registry) → 4 (proves migration; can parallelize) → 5,6 (hardening). Items 1–4 are the must-do-for-highest-standard; everything in §6 gold-plating stays explicitly out of scope with its re-entry door named.

---

## 7. WIRE-CONTRACT FLOOR — resolved implementation design (items #1 + #3)

Status: DECIDED (implementation-ready). Supersedes the open questions in §3 P-1/P-2 and §4.1/§4.2 with concrete placements, verified against the real eslint gate + the real package graph.

### 7.1 The arrow answer (verified, not assumed)
- `apps/api` has **NO** `no-restricted-imports` block in `platform/eslint.config.js` (only contracts/expr/styles/core/react/plugins/panel do). The arrow `contracts←apps/api` is the *declared* minimum; the gate does not forbid `api→core`. **`apps/api` may legally import `@statdash/engine` (packages/core) AND already does** — `apps/api/src/routes/config/pages.ts:3` imports `migratePageConfig`, `CURRENT_SCHEMA_VERSION`; `apps/api/package.json` depends on both `@statdash/contracts` and `@statdash/engine`.
- `packages/react` may import `@statdash/engine` (RESTRICT_REACT bans only plugins/apps). So **`packages/core` is the deepest layer BOTH `apps/api` and `packages/react` can legally import.** → **`validateConfig` lives in `packages/core` (`@statdash/engine`).** Not contracts — contracts is types-only (zero logic/classes, double-locked by contracts.fitness.test.ts); a validator is logic.

### 7.2 The structural-floor / rich-semantic boundary (the precise cut)
- **Engine-tier STRUCTURAL FLOOR (moves to / stays in core):** tree well-formedness (every node is an object with a string `type`; `children` is an array; no cycles), valid `type` discriminant ∈ the known placeable set, required base fields present (`id`, page root has children, `schemaVersion` integer if present), DataSpec union shape (already: `validateDataSpec` reads `defaultRegistry.specTypes()`), page-root type ∈ {`inner-page`,`tab-page`,`container-page`}. This is *type-agnostic*: it needs the SET of valid types, not per-type field knowledge.
- **App-tier RICH SEMANTIC (stays in react/plugins):** per-node PropSchema field validation, slot `accepts` compatibility, `nodeRegistry` slice `validate()` hooks, enum-ref source resolution. Needs the renderer registry — correctly app-tier.
- This RESOLVES the stale NOTE at `packages/core/src/validation/pipeline.ts:137` ("validatePageTree belongs in react"): that NOTE conflated *known-type-set* (engine can hold this — see 7.3) with *slice-validate hooks* (genuinely react). Only the latter stays up-tier.

### 7.3 Where the known-placeable-type SET comes from WITHOUT react (the SSOT seam)
Core has NO node-type registry today (only `EngineRegistry` for specs). The validator must not mirror a hardcoded type list (drift). Add a **minimal engine-tier node-type registry** (`packages/core/src/registry/nodeTypes.ts`): `registerNodeType(type: string)` / `knownNodeTypes(): string[]`, fail-open when empty (same contract as `validateDataSpec`). `packages/react`'s `register-all` calls `registerNodeType(t)` for every type it registers in `nodeRegistry` (one line in the existing registration loop) — so the engine learns the set by *injection from the registry that owns it* (SSOT: react registry remains authoritative; core holds a derived projection, populated at startup). `apps/api` calls a tiny `@statdash/engine` setup that registers the CORE-owned node/spec types it can validate structurally even without react loaded (filter-bar/bar/param + the three page roots) — see 7.6 for the WARN-mode consequence.

### 7.4 Structural TYPES that move down vs mirror
`NodeBase`/`PageConfigBase`/`NodePageConfig` in `packages/react/src/engine/types/node.ts` import `NodeStyles` (@statdash/styles) and `ChromeEntry` (../slice-meta, react-tier). The validator does NOT need those rich types — it validates *shape*, not the full typed interface. So **do not move the rich types down.** Instead core defines a **minimal structural mirror** used only by the validator: `StructuralNode = { type: string; id?: string; children?: StructuralNode[]; data?: unknown; [k]: unknown }` and `StructuralPageConfig = StructuralNode & { schemaVersion?: number }`. SSOT is preserved because the structural mirror is a *strict widening* of the react type (react's `NodePageConfig` is assignable to it) — a fitness function asserts that assignability (type-level test), so the mirror can never drift narrower than the real type. DataSpec types already live in core (`config/section.ts`) — no move needed.

### 7.5 `validateConfig` signature + Problem reuse
`packages/core/src/validation/config.ts`:
```
export function validateConfig(config: unknown): ValidationError[]   // structural floor; [] === valid
```
Returns the existing engine `ValidationError[]` ({path,code,severity}) — NOT ProblemDetails (core must stay zero-knowledge of the RFC-9457 URN scheme, which is api-owned per problem.ts:16). The **adapter to Problem is api-local**: add a `validation` extension carrying `issues: ValidationError[]` to the existing `validation` problem kind (problem.ts already has `validationProblem(ZodError)` — add a sibling `configValidationProblem(errors: ValidationError[])`). So the *contract* (`application/problem+json` + `issues`) is identical to Zod failures; the *engine* stays pure. `packages/react` calls the SAME `validateConfig` as the structural pre-render gate in `renderNode`/SiteRenderer (errors → existing diagnostics seam), no Problem dependency needed client-side.

### 7.6 api save wiring + migration mode (the product call)
In `pages.ts` POST `/` and PUT `/:id`: after `parseBody`, run `migratePageConfig(body.config)` then `validateConfig(migrated)`. **Recommendation: WARN/observe mode first, NOT hard-reject.** Reason: `config.page_version` holds existing stored blobs written under `z.record(z.unknown())`; we have ZERO evidence they pass the new floor, and a hard gate on save could also reject a re-save of a legacy page (one-way-door risk to existing content). Strangler-Fig: (a) land `validateConfig` + log `errors` via the AuditLogger/diagnostics on save without rejecting; (b) add a one-shot backfill audit script that runs `validateConfig` over every stored `config.page_version.config` and reports the failing corpus; (c) once the corpus is green (zero structural failures across stored configs), flip save to hard-reject with `configValidationProblem` (400). The flip is a single-line change at one seam. **FLAGGED PRODUCT CALL:** whether to hard-reject *new* pages immediately (strict from day one for greenfield configs) while warn-only for *updates* to pre-existing pages — recommend yes (new POST = strict, PUT to existing legacy page = warn until backfill green), but this is a product/governance decision.

### 7.7 #3 JSON Schema generation seam (no app-tier import at api runtime)
The whole-config JSON Schema is GENERATED from `describeApp()` (react-tier, needs the full registry) but SERVED by api (which must not import react). Resolve via **build-time artifact, not runtime generation**:
- New generator `packages/react/src/engine/generatePageConfigSchema.ts`: `generatePageConfigSchema(manifest = describeApp()): JsonSchemaObject` — composes per-node PropSchemas (via existing `propSchemaToJsonSchema`) into a `oneOf` discriminated by `type`, folds in the DataSpec union (`manifest.specTypes`) and PageConfigBase structural fields, emits Draft-2020-12 (`$defs` + `$ref`; upgrade the bridge's Draft-07 const to 2020-12 for the document root).
- A build script `packages/react/scripts/emit-page-config-schema.ts` runs `setupRegistrations(); generatePageConfigSchema()` and writes the static artifact to **`packages/contracts/schema/page-config.schema.json`** (contracts is the cross-arrow-legal home for shared wire artifacts — api already imports contracts; the schema is a *generated data file*, not code, so it does not violate contracts' zero-dep CODE rule). Wired as a `prebuild`/`build` step of the api (or a root `pnpm gen:schema`).
- `apps/api` serves it: `GET /api/schema/page-config` reads the static JSON from `@statdash/contracts/schema/page-config.schema.json` and returns it with `content-type: application/schema+json`. **Zero app-tier import at runtime** — api imports a JSON file, never `describeApp`.

### 7.8 Fitness functions (concrete)
- **F1 (server ≡ client structural gate):** `packages/core/src/validation/config.fitness.test.ts` — a shared accept/reject corpus (`config-corpus.ts`, N valid + N invalid NodePageConfigs); assert `validateConfig` verdict matches the expected label for each. Both api and react import the SAME `validateConfig`, so one test proves both sides (they cannot diverge — same fn). Plus a contract test in apps/api asserting POST with an invalid-corpus member yields `application/problem+json` + `issues` once hard-reject is on.
- **F3 (every placeable type in validator ∧ PropSchema ∧ JSON Schema ∧ palette):** extend the existing `schema-completeness`/`paletteCompleteness` fitness in react — for each `describeApp().palette[].type`: assert it ∈ `knownNodeTypes()` (validator set) ∧ has a `propertySchemas[type:variant]` ∧ appears as a `oneOf` branch in `generatePageConfigSchema()` ∧ is in the palette (tautology, the source). One half-registered type fails the build.
- **F4 (structural mirror ≥ react type):** type-level test asserting `NodePageConfig` (react) is assignable to `StructuralPageConfig` (core) — pins 7.4's no-drift guarantee.

### 7.9 Owners
- engine-specialist: 7.3 node-type registry, 7.4 structural mirror, 7.5 `validateConfig` in core + F1 corpus/test.
- senior-backend-developer: 7.6 api save wiring + `configValidationProblem` + 7.7 `GET /api/schema/page-config` + the backfill audit script + the WARN→reject flip.
- react-specialist: 7.7 `generatePageConfigSchema` + emit script, 7.8 F3, the `register-all` one-line `registerNodeType` injection (7.3).
- product call flagged at 7.6 (new-strict / legacy-warn).


---

### B. Constructor (apps/panel): the Authoring North Star


# ADR — Constructor (apps/panel): the Authoring North Star

Status: PROPOSED (2026-06-24). Builds ON [[adr-constructor-phase2]] (the C0–C5 triad — now substantially BUILT on disk: Inspector, open store model, fromNodePageConfig, suggestPanels, capabilityGate, cube-profile, live preview, variant spine, validateConfig, generated JSON Schema). This ADR sets the NEXT horizon: from "a competent registry-driven builder" to "the best REAL builder a statistician with zero code can use to author ANYTHING our renderer can render." Holds YAGNI — the best real builder, not maximal features.

Related: [[adr_config_and_render_vision]] (config-object + SDUI renderer; validateConfig/JSON-Schema floor), [[adr_semantic_token_theming_spine]] (theming = a Constructor authoring axis), [[adr_shell_variant_style_spine]] (VariantDef → data-attrs; the variant authoring face), [[adr_no_privileged_element_capability_nav]], [[adr_element_config_schema_seam]] (per-slice schema, ISP), [[project_panel_external_product]] (panel ships externally; the registry IS the published contract), [[project_semantic_layer_n26]] (MetricRegistry = a future palette/binding axis).

---

## Context — what is ON DISK (verified 2026-06-24)

The Constructor is FAR past the Phase-2 ADR's "gaps". Verified standing assets:

- **Wizard** (`features/wizard`): 3 steps Data / Site / Pages (`WIZARD_STEPS`), stepper, per-step panels.
- **Live WYSIWYG canvas** (`canvas/CanvasView.tsx`): Layer-1 the REAL `NodePageRenderer` under a `SiteProvider` (pointer-events:none) + Layer-2 `CanvasOverlay` (selection frames + slot drop zones). Builder.io/Craft.js two-layer pattern, real.
- **structural | live preview** (`useLivePreviewStores`, `livePreview.ts`, `useDebouncedLivePage`): toggle between empty `staticStore` and the REAL stats cube via the SAME `buildStoreManifest` 'stats' builder the geostat runner uses; live is fail-soft (falls back to static + badge), debounced so an edit burst collapses to one query. First-cube-bound-wins.
- **Open-registry palette** (`canvas/paletteEntries.ts`): built purely from `nodeRegistry.list()` + `getByCapability(CAPS.*)` → capability-grouped (Data panels / Layout / Content). New registered type = palette row, zero code.
- **Capability gate + suggest** (`discovery/`): `gatePaletteEntries` (profile ∩ palette — hide data panels a dataset can't support, fail-OPEN), `suggestPanels` (pure conceptRole→panel: time→timeseries, geo→map, hierarchy→tree, measure→bar/kpi-strip), `cubeProfile.store` (Identity-Map cache, loading|ready|error), `cubeEnumOptions`.
- **PropSchema-driven Inspector** (`inspector/`): renders the WHOLE property panel GENERICALLY from `nodeRegistry.getSchema(type,variant)`, dispatching each `PropField` through `FieldControlRegistry` (Strategy+Registry, OCP). `SchemaSource` port inverts the registry dependency so chrome (`chromeSchemaSource`) renders through the SAME Inspector. Controls: Text/Number/Boolean/Color/Select/Json primitives + `LocaleField` (per-active-locale tabs, `coverage:'localized'`) + `EnumRefField` (cube.measures/dimensions/members + dataSpecs/dataSources/pages, dimension-scoped, fail-soft). `showWhen`/`getAtPath`/`setAtPath` nested write; `validateField`; grouped `<fieldset>/<legend>` (WCAG).
- **Unified open store** (`store/constructor.store.ts` + slices): `CanvasNode {id,type:string,variant?,props,childIds}` — the closed `CanvasNodeKind` enum is GONE (store as open as the registry). Flat Identity-Map + ordered `nodeIds`; full undo/redo (`constructor.history`); lifecycle FSM mirror (`constructor.lifecycle`); chrome authoring (`constructor.chrome`).
- **Lossless round-trip** (`canvas/canvasPageAdapter.ts`): `to/fromNodePageConfig` with `fromNodePageConfig(toNodePageConfig(x)) ≡ x`. Page-level `meta` carried by STRUCTURAL PASS-THROUGH (PAGE_STRUCTURAL_KEYS) so a NEW PageConfigBase field (frame/chrome/presentation/filterSchema/vars/modeOrder) round-trips with zero adapter edit.
- **DataSpec authoring** (`features/data-layer/`): `DataSpecEditor` type-picker over `SPEC_CATALOG` (9 discriminants) → per-type editors query/timeseries/growth/ratio-list + JSON fallback for by-mode/pivot/transform/custom. Query editor: `MeasureSelector`, `FilterBuilder`, `EncodingEditor` (label/value/color/pct/isTotal channels), `PipelineBuilder` (dnd-kit sortable TransformSteps, per-op StepForms: derive/lookup/sort/filter).
- **Variant spine** (`variant-meta.ts`): `VariantDef` (flag|enum → data-attr) folded into PropSchema as `variants.<name>` fields via `variantPropSchema`/`nodeSchemaWithVariants` → authored in the SAME Inspector, validated by the SAME generated schema.
- **Validation floor** (`packages/core/validation/config.ts`): `validateConfig` — structural floor BOTH apps/api (save) and packages/react (render) call (one fn, can't diverge). Generated `page-config.schema.json` (`emit-page-config-schema.ts` → `generatePageConfigSchema`) is the wire contract in `packages/contracts/schema`.
- **Publish/version/RBAC UI** (`features/page-workflow/`): PageBrowser, StatusBadge, WorkflowBar, SaveIssueList, VersionHistoryDialog; `save/saveGuard`.
- **Registered universe** (the palette today): nodes section/mode-bar/filter-bar/page-header/geograph/links/repeat/hero/stats-carousel + layout row/grid/columns/stack/card/divider/spacer/wrap; panels chart/kpi-strip/table/map/text/gauge; pages inner-page/container-page/tab-page; chrome app-header/app-footer/app-banner/inner-sidebar/locale-switcher (+ variants).

**Verdict:** we LEAD the field on three axes most builders fake: (1) the live canvas IS the real production renderer (no second render path — lossless by construction), (2) the palette/inspector/store are all one open registry (new capability = zero Constructor code), (3) capability discovery from a real cube profile. We LAG on authoring ERGONOMICS for a non-programmer: data binding still exposes ObsQuery/EncodingSpec field-name typing (not Tableau field-wells), no templates/starters, no command palette, no tree/outline pane, no insert-affordances beyond drag, advanced DataSpec branches (pivot/transform/by-mode/custom) are raw-JSON, and many "must be authorable" renderer capabilities are PARTIAL or NOT (the gap audit below).

---

## Part A — Best-in-class survey: the strongest idea to steal from each

Authoring-UX and architecture, the 1–3 ideas genuinely worth adopting (named, concrete):

**Component-tree builders**
- **Webflow** — the *Navigator/Style-panel* split: a structural TREE pane distinct from the visual canvas, and styles authored as named, reusable classes (not per-element overrides). STEAL: a left **Outline/Navigator tree** (we have none) + variant/style authoring as named declarations (we have the VariantDef spine — surface it as Webflow-style emphasis presets).
- **Builder.io** — *registered components with typed inputs* + *visual data-binding to a DataSource plugin* + *content model/SemVer*. STEAL: their `inputs` model is exactly our PropSchema; their **DataSource binding UX** (pick a source, map fields) is the template for our field-wells. Already aligned; double down.
- **Plasmic** — *component variants + interaction states authored visually*, and *code-component registration with controlled props*. STEAL: **variant matrix** authoring (author a node's emphasis/density presets and preview each) over our VariantDef.
- **Framer** — *smart layout + "everything has a sensible default so the canvas is never broken"*. STEAL: **never-broken-canvas** discipline (every add yields a valid, rendering node via getDefaults — we do this; make it a guarantee/fitness).

**WYSIWYG / page CMS**
- **WordPress Gutenberg** — *block inserter with search + categories + "/" slash-command insert in place*; *block patterns* (pre-composed starters). STEAL: **slash/command-palette insert** and **block patterns = our "starters"** (pre-built section+panel compositions seeded into a new page).
- **Wix / Editor-X** — *templates-first onboarding* (you never start from blank). STEAL: **template gallery** as the default entry to a new site/page.

**Internal-tool / low-code**
- **Retool** — *the right-hand Inspector with grouped, typed property controls + `{{ }}` binding chips*; *component-tree + query panel*. STEAL: our Inspector IS this; steal their **binding-chip affordance** (a field can be a literal OR a binding to a param/dataSpec — a `$ctx`/`$d` ref picker, not raw JSON).
- **Appsmith** — *widgets with show/hide/enable conditions authored in the property panel*. STEAL: a **VisibilityExpr builder** in the Inspector (we have `showWhen` for fields; the node-level `visibleWhen` gate is NOT authorable yet — see gap audit).
- **Budibase** — *data-first app creation (connect data → auto-generate screens)*. STEAL: **data-first flow** — "connect a cube → we propose a whole dashboard" (suggestPanels exists; extend to a full-page generator).

**Dashboard / BI (the closest domain)**
- **Grafana** — *panel editor = viz picker + field/transform + options, all live-previewed*; *transformations UI as a stacked pipeline*; *template variables at dashboard level*. STEAL: our PipelineBuilder mirrors transformations; steal the **viz-picker-with-live-thumbnail** and **dashboard-level variables editor** (our FilterSchema/ParamDefs — NOT authorable yet, big gap).
- **Looker Studio** — *field "chips" you drag into dimension/metric wells; calculated fields via a formula editor*. STEAL: **dimension/metric WELLS** — the single most important non-programmer idea; replace raw ObsQuery typing with drag-a-measure-into-the-value-well.
- **Tableau / Power BI** — *Show Me (suggest the viz from selected fields)*; *field wells (rows/columns/marks/filters shelves)*; *calculated fields*. STEAL: **"Show Me"** (we have suggestPanels — surface it as the headline), **shelves/wells** as the DataSpec authoring metaphor, **calculated field editor** over our DeriveExpr (we have the engine; expose a friendly formula box).
- **Metabase** — *the notebook/visual query builder: pick data → filter → summarize → visualize, in plain language, no SQL*. STEAL: the **notebook query metaphor** for `query` DataSpec (pick measure → filter → group → encode), the gentlest possible data-binding ladder.
- **Apache Superset** — *dataset semantic layer (metrics/columns defined once, reused) + viz-type gallery*. STEAL: **named metrics reused across panels** ([[project_semantic_layer_n26]] MetricRegistry) surfaced as a palette/well source.

**Document / design**
- **Notion** — *"/" slash menu, blocks that are trivially rearrangeable, progressive disclosure (simple by default, power on demand)*. STEAL: **slash insert + frictionless reorder + progressive disclosure** as the whole-editor north star for non-programmers.
- **Figma** — *components + variants + auto-layout; a property panel that adapts to selection*. STEAL: **variants as first-class** (VariantDef) and **auto-layout = our layout nodes** (stack/grid/columns) — author layout by choosing a layout node, never x/y.
- **Adaptive Cards Designer** — *a JSON-schema-driven card editor with a live card preview and an element palette, AND a visible JSON pane kept in sync*. STEAL: an **optional, READ-mostly JSON pane** (advanced escape hatch) that stays in lockstep — proves the lossless round-trip to power users without making JSON the primary surface.

**Schema/forms/CMS (declarative-config kin)**
- **JSON Forms** — *render a form purely from a JSON Schema + a UI Schema (layout/ordering separate from data schema)*. STEAL: the **UI-Schema/data-schema split** — our PropSchema mixes both (groups/order live with fields); a separate UI-schema would let one node declare multiple inspector layouts (basic/advanced). Consider for progressive disclosure.
- **Storybook controls/args** — *auto-generated controls from arg types; the "args table"*. STEAL: validation of our model — argTypes≈PropSchema; steal the **"reset to default"** + **per-control description/hint** affordances.
- **Sanity Studio** — *schema-as-code defines the studio; portable-text; real-time collaborative editing; structure builder*. STEAL: **structure/desk customization** (how the authoring surface itself is configured) and, longer-term, **real-time collaboration/presence**.
- **Contentful / Strapi** — *content modeling + field validations + draft/publish workflow + roles*. STEAL: validation of our workflow model (we have draft/publish/version/RBAC); steal **field-level validation messages + required/unique affordances** surfaced inline.

**Synthesis of the survey:** the field splits into (1) *coordinate/layer* editors (Figma/Framer free-canvas) — NOT our model, correctly rejected in the Phase-2 ADR; and (2) *component-tree + inspector + live-preview* editors (Builder.io/Plasmic/Webflow/Retool/Grafana) — exactly our model. The BI tools (Tableau/Looker/Metabase/Superset) own the *data-binding* ergonomics we most lack. So the north star = **our component-tree/inspector/live-canvas spine (already best-in-class) + BI-grade field-wells/Show-Me/calculated-fields for data binding + Notion/Gutenberg insert-and-reorder ergonomics + templates/starters**.

---

## Part B — COVERAGE-GAP audit (the hard requirement: NOTHING un-authorable)

For each renderer capability: authorable TODAY / PARTIAL / NOT, with the exact gap. This is the key deliverable — the spec for "non-programmer can build anything."

### Node / panel / chrome types
- Node/panel placement (drag from palette, getDefaults seed) — **TODAY**.
- Chrome slot selection + per-slot config (variant + config via chromeSchemaSource) — **TODAY**.
- Page-root type (inner-page/tab-page/container-page) — **PARTIAL**: round-trips via meta, but no UI to CHOOSE the page-root kind (tab-page vs inner-page) when creating a page. Gap: a page-template picker on page create.
- `slots.accepts` drop-acceptance — **PARTIAL**: overlay reports parent+slot, but accept-filtering by `slots.accepts`/`singleton`/`max` is not enforced in the drop handler (PageStep.handleDrop appends unconditionally). Gap: registry-driven drop validation.

### DataSpec branches (the data engine)
- `query` (ObsQuery + pipe + encoding) — **PARTIAL**: editable, but via field-NAME typing (MeasureSelector/FilterBuilder/EncodingEditor map channels to raw string field names), not field-wells. EncodingEditor covers label/value/color/pct/isTotal only. Gap: Tableau-style wells; rowLimit/fromDim/toDim not surfaced.
- `row-list` — **NOT** (JSON fallback). Gap: a row editor (code/label/color/negate/isTotal/pctOf per RowSpec).
- `timeseries` — **TODAY** (TimeseriesEditor) — but `code` is free text, not measure-picked from profile. Gap: bind code to cube.measures.
- `growth` — **TODAY** (GrowthEditor) — same free-text code gap; multi-code (string[]) UX unclear.
- `ratio-list` — **TODAY** (RatioListEditor) — pairs code/denom free text; profile-bind gap.
- `by-mode` — **NOT** (JSON fallback). Gap: a per-mode sub-DataSpec editor (recursive DataSpecEditor keyed by ModeId).
- `pivot` — **NOT** (JSON fallback). Gap: rows/keyField/valueFields/colors editor.
- `transform` — **NOT** (JSON fallback for the top-level transform spec; note the PipelineBuilder DOES author the steps inside `query.pipe`). Gap: a source+steps+encoding editor reusing PipelineBuilder.
- `custom` (`fn: string`) — **NOT** and SHOULD STAY NOT for non-programmers (a code-resolver ref). Gap: at most a dropdown of registered custom resolver names; never free code. (YAGNI/Law-2 honoured.)

### Transform pipeline ops (TransformStep — 20+ ops)
- Authored ops in PipelineBuilder StepForms: **derive, lookup, sort, filter** — **TODAY** (4 of ~20).
- melt, rename, cast, concat, template, addField, select, aggregate, rollup, group, reduce, window, join, joinByField — **NOT** (no StepForm; only the 4 above have forms; OP_OPTIONS lists only 4). Gap: this is the biggest single coverage hole. Each op needs a StepForm OR a generic schema-driven step editor (a PropSchema per op → reuse the Inspector machinery). DeriveExpr authoring is free-string/JSON — needs a formula/expression builder (Looker calc-field analogue).

### EncodingSpec
- label/value/color/pct/isTotal — **TODAY** (EncodingEditor). 
- Any other EncodingSpec channel (series, by, sort, suggestedEncodings integration, semantic `by→encoding.series` from [[project_semantic_layer_n26]]) — **PARTIAL/NOT**. Gap: encoding is hand-typed field names; should be field-wells fed by the resolved row fields / profile.

### Variants (VariantDef spine)
- Authored as `variants.<name>` PropFields in the Inspector (enum→select, flag→toggle) — **TODAY**. Strong. (Figma/Plasmic variant authoring achieved.)

### Presentation projectors
- `presentation.color` / `presentation.crumbs` (PresentationProjector.schema() → PropFields) — **PARTIAL**: the projector declares Constructor PropFields and they flow into generatePageConfigSchema, but there is NO Inspector surface that selects the PAGE (vs a node) and renders page-presentation fields. Gap: a Page Inspector (select the page root → render presentation + frame + chrome + modeOrder fields).

### FilterSchema / ParamDefs (page-level filters — the dashboard's controls)
- bars / ParamDef union (hidden/year-select/cascade/select/range/multi-select/chip-select) / DefaultSpec tiers / showWhen/enableWhen / effects / crossValidate / context mapping — **NOT**. This is a major gap: a statistical dashboard IS its filters, and none of it is Constructor-authorable today. The filter-bar node is placeable but its CONTENTS (the ParamDefs) are not editable. Gap: a FilterSchema authoring surface (Grafana template-variables editor analogue) — pick a dimension → choose a control type → bind options to cube.members → set default.

### VisibilityExpr (node visibleWhen gate)
- The boolean tree (eq/neq/in/isset/and/or/not/mode-is/mode-in/mode-not) — **NOT**. Gap: an Appsmith-style condition builder on a node ("show this section when geo = Tbilisi"). Today only field-level `showWhen` (a different, string-expression mechanism inside the Inspector) exists.

### Page config (frame / chrome / modes / i18n / vars)
- chrome — **TODAY** (chrome palette + inspector).
- frame — **PARTIAL** (round-trips via meta; no editor).
- modeOrder / ModeId (the year/range/mode machinery) — **PARTIAL**: mode-bar node placeable; modeOrder + per-mode config not authored.
- vars (VarMap / page variables consumed by presentation find/breadcrumbs) — **NOT**. Gap: a page-vars editor.
- i18n (active locales, per-locale field authoring) — **TODAY** (LocaleField + coverage:'localized' + useActiveLocales). Site activeLocales come from config (SSOT). Strong.
- schemaVersion — **TODAY** (stamped/round-tripped).

### Data-source binding
- DataSource CRUD (sdmx-json/rest/static) — **TODAY** (datasources feature + DataStep). 
- `dataSourceBindings` (context key → DataSource id) — **PARTIAL** (modeled in SiteDef; thin/absent UI).
- Per-page / per-store-key binding (multi-store) — **NOT** (first-cube-bound-wins only). Gap when a page needs >1 cube.

### ContentConstraint / actualRegion gating
- The capability gate hides unsupported data panels — **TODAY** (gatePaletteEntries). actualRegion-level "don't let me build an empty combination" — **PARTIAL/NOT**: the gate is measure-presence + geo-role only; it does not yet consult actualRegion to forbid empty-by-design dim combinations. Gap: wire actualRegion into binding validation.

### Methodology / ref-metadata
- Methodology/source/last-updated/preliminary badges (Project Law 9; the section `methodology` cap) — **PARTIAL/NOT**: the cap exists and shells render badges from config, but no Inspector fields author the methodology text/source/links/preliminary flags. Gap: a methodology fieldset on data nodes (this is a compliance requirement, ONS/IMF/Eurostat — high priority).

**Coverage scorecard:** roughly — TODAY: node/chrome placement, variants, i18n, 3-4 DataSpec types, 4 transform ops, basic encoding, datasource CRUD, capability gate, publish/version. PARTIAL: query wells, page-root choice, slot-accept, presentation, frame/modes, bindings, actualRegion, methodology. NOT (the real work): page-level FilterSchema/ParamDefs, VisibilityExpr builder, 16 transform ops, by-mode/pivot/transform/row-list DataSpec editors, page-vars, calculated-field/DeriveExpr builder. **The single highest-impact gaps for "build anything": (1) FilterSchema/ParamDef authoring, (2) the remaining transform ops, (3) field-wells data binding, (4) the Page Inspector (presentation/frame/modes/vars), (5) VisibilityExpr builder, (6) methodology fields.**

---

## Part C — The non-programmer authoring vision (a statistician, zero code, end-to-end)

Design principle stack: **never edit JSON · sensible defaults (never-broken canvas) · progressive disclosure (simple by default, power on demand) · pick-don't-type (everything bound to a real catalog) · live preview · undo always · error-prevention over error-messages · suggest-the-next-step.**

The end-to-end flow (the "golden path"):
1. **Start from a template, not blank** (Wix/Gutenberg). Pick "GDP dashboard" / "Regional indicators" starter → a real page with section+chart+table+filter already wired to a sample cube.
2. **Connect the data** (Budibase data-first): pick/point a cube DataSource → cube-profile loads → palette gates + "Show Me" suggestions appear.
3. **"Show Me" the chart** (Tableau): suggestPanels surfaces a "Recommended" palette group with reasons ("time axis → line chart"). One click inserts a fit-for-data, populated panel.
4. **Bind data by field-wells** (Looker/Tableau), NOT ObsQuery: the panel inspector shows MEASURE / DIMENSION / SERIES / FILTER wells; the author drags measure/dimension chips (from the cube-profile) into wells. The wells emit the `query` DataSpec + EncodingSpec under the hood. A "calculated field" box (DeriveExpr) for derived measures, with a friendly formula syntax (`value / total * 100`).
5. **Insert more blocks** (Notion/Gutenberg): "/" slash command or a "+" insert affordance in the tree/canvas — search a block, insert in place. Drag to reorder; the Outline/Navigator tree gives a bird's-eye structure.
6. **Add filters** (Grafana variables): a Filters panel — pick a dimension → choose control (dropdown/range/cascade) → options auto-bound to cube.members → set default. No ObsQuery, no ParamDef JSON.
7. **Style by presets** (Webflow/Figma variants): emphasis (hero/compact), density, color — chosen from VariantDef enums + the semantic-token palette, never raw CSS.
8. **Localize inline** (our LocaleField): every text field has per-locale tabs; incomplete locales flagged before publish.
9. **Methodology/integrity** (compliance): a methodology fieldset (source, last-updated, preliminary, link) on each data node — surfaced as the ONS/IMF badges.
10. **Preview live** (our structural|live toggle), **undo freely**, **publish** (draft→version→publish with role gate + published-vs-draft delta).

Cross-cutting affordances to add: **command palette** (Cmd-K: insert/navigate/run), **inline help/hints** (PropField.hint + per-control descriptions, Storybook-style), **reset-to-default** per field, **error-prevention** (drop-accept validation, gated palette, profile-bound options so invalid states are unreachable), **empty-state coaching** (a blank page invites "pick a template" / "Show Me").

The litmus test (a fitness function for the whole vision): *a statistician can build, from a blank site, a published multi-panel dashboard with filters, localized labels, and methodology badges — without ever seeing JSON, a field name they typed, or an error they couldn't have been prevented from causing.*

---

## Part D — Best-of-breed hybrid (where we LEAD / LAG)

**We LEAD (keep, double down):**
- Live canvas IS the production renderer (no second render path) — lossless WYSIWYG by construction. Most builders fake this; we don't.
- One open registry for palette + inspector + store + validation — new capability = zero Constructor code (Builder.io's dream, structurally enforced).
- Capability discovery from a REAL cube profile (gate + suggest + enum-ref options). Tableau's "Show Me" + Budibase's data-first, grounded in actual data.
- Lossless flat⇄tree round-trip + generated JSON-Schema wire contract + one validateConfig both server and client run.
- VariantDef spine = Figma/Plasmic variant authoring, declaratively.

**We LAG (build):**
- Data binding ergonomics (field-wells/Show-Me-front-and-center/calculated-fields) — we expose ObsQuery/field-names; BI tools expose chips-into-wells.
- Insert/navigate ergonomics (slash-command, command palette, Outline tree, templates/starters) — Notion/Gutenberg/Wix table stakes we lack.
- Whole renderer-capability coverage (FilterSchema, VisibilityExpr, the 16 transform ops, page-presentation, modes/vars, methodology) — see the gap audit.

**The hybrid:** our spine + BI data-binding + document-editor ergonomics + total coverage. Concretely the editor becomes **four panes**: Outline/Tree (left) · Live Canvas (center) · Inspector (right) · with a Data/Filters drawer and a Cmd-K palette — the Retool/Grafana/Builder.io layout, plus Looker wells in the Inspector and Tableau Show-Me in the palette.

---

## Part E — Packages decision (adopt vs build; respect the arrow)

The arrow: `contracts ← expr ← core ← charts ← react ← plugins ← apps/*`. Constructor deps live in `apps/panel` only (app layer) — they MUST NOT leak into `packages/*`. MUI is already the panel's UI kit.

**ADOPT (global deps in apps/panel):**
- **@dnd-kit** (core/sortable/utilities) — ALREADY in use (PipelineBuilder, DataStep). Keep; it's the right, accessible, headless DnD. Use for the Outline tree reorder + palette→canvas drag too. Justify: a11y, small, no opinion on rendering. (Do NOT add react-dnd — duplicate.)
- **cmdk** (command palette) — tiny, headless, the de-facto Cmd-K. For insert/navigate. Justify: huge UX leverage (Notion/Linear), ~small bundle, app-only.
- **A color picker** — `react-colorful` (2.8kB, zero-dep, accessible) behind the existing `ColorControl`. Justify: ColorControl is a primitive today; react-colorful is the minimal upgrade. App-only.
- **An icon picker / icon set** — we already have icon keys; adopt a single icon set the picker browses (MUI icons already present, or `lucide-react` for a cleaner set). Build the PICKER, adopt the SET.
- **An expression/formula input** — for DeriveExpr/calculated fields, a small code-input (`react-simple-code-editor` + a tiny tokenizer) — NOT a full Monaco (too heavy for a non-programmer formula box). Justify: bundle discipline; the formula language is small (our DeriveExpr string form).
- **A JSON viewer** (read-mostly advanced pane) — a lightweight pretty-printer (or `@textea/json-viewer`); the EDIT path stays the structured editors. Justify: the Adaptive-Cards "see the JSON" escape hatch without making JSON editable.

**BUILD ourselves (the seams that ARE our architecture — never outsource the SSOT):**
- The **Inspector + FieldControlRegistry** — already built; it IS our PropSchema seam. Do NOT replace with RJSF/JSON-Forms: our schema is richer (enum-ref/coverage/variants/cube-binding) and the round-trip must stay ours. (Borrow JSON-Forms' UI-schema/data-schema split as a CONCEPT, not the lib.)
- The **Outline/Tree** pane — build over our flat store + @dnd-kit; a generic tree lib would fight our Identity-Map model and drop-accept rules.
- The **field-wells / Show-Me / DataSpec editors / FilterSchema editor / VisibilityExpr builder / transform-op StepForms** — these are domain-specific to our DataSpec/ParamDef/VisibilityExpr/TransformStep unions. No library models them; they ARE the Constructor's value. Build them schema-driven where possible (a PropSchema per transform op → reuse the Inspector, not N bespoke forms).

**FACTOR OUT to a local package (later, when a 2nd consumer is real — YAGNI):**
- The PropSchema→control rendering (FieldControlRegistry + controls) could become `@statdash/inspector-kit` IF a second app needs it. Today one consumer (apps/panel) → keep in-app (no premature package). Flag for when the panel splits per [[project_panel_external_product]].

**REFUSE:** RJSF/JSON-Forms as the inspector engine (DRY/SSOT violation — we have the seam); react-dnd (dup of dnd-kit); Monaco for the formula box (bundle); any builder framework (Craft.js/Puck) that would impose a SECOND render model (we already render via the production renderer — adopting one would break lossless round-trip, the cornerstone).

---

## Decision

Adopt the **four-pane authoring shell** (Outline · Live Canvas · Inspector · Data/Filters drawer + Cmd-K) and drive the roadmap by the **coverage-gap audit (Part B)** prioritized so that "a non-programmer can build ANYTHING the renderer renders" is reached, in this order: total renderer coverage FIRST (you cannot author what has no surface), then BI-grade binding ergonomics, then document-editor ergonomics and templates. Hold YAGNI: build wells/StepForms schema-driven (reuse the Inspector), not as N bespoke forms; package nothing until a 2nd consumer is real.

---

## Rejected alternatives

1. **Adopt a builder framework (Craft.js / Puck / GrapesJS).** Rejected: each imposes its OWN node model + render path → a SECOND source of truth, breaking the lossless round-trip and the "one renderer" cornerstone we uniquely have. Our canvas already embeds the production renderer.
2. **RJSF / JSON-Forms as the Inspector engine.** Rejected: SSOT/DRY violation — PropSchema + FieldControlRegistry already IS our schema-driven form engine, and it carries vocabulary (enum-ref cube-binding, coverage:'localized', variants) no generic lib models. Borrow the UI-schema CONCEPT only.
3. **Free-canvas / coordinate editing (Figma model).** Rejected again (per Phase-2 ADR): the render model is document-flow tree; coordinate state would be un-honourable → broken round-trip + least-astonishment. Layout is authored by layout NODES (stack/grid/columns), not x/y.
4. **Expose ObsQuery / EncodingSpec / ParamDef / VisibilityExpr as raw JSON to "ship coverage fast".** Rejected for the non-programmer path: violates "never edit JSON" and lets users build invalid/empty configs. Raw JSON stays only as an advanced, read-mostly escape hatch (Adaptive-Cards pattern) and for `custom` resolvers.
5. **Build a full code editor (Monaco) for calculated fields.** Rejected: bundle cost + intimidates the non-programmer. The DeriveExpr string form is small; a light tokenized input suffices.
6. **Defer total coverage; polish ergonomics on the covered subset first.** Rejected: "build anything" is the user's hard requirement — an un-authorable capability (FilterSchema, transform ops) is a correctness gap, not a polish item. Coverage leads; ergonomics follow on a complete surface.

---

## Consequences

- **Positive:** the Constructor reaches "author anything the renderer renders" (the mandate), with non-programmer ergonomics matching BI tools, while preserving the three things we uniquely lead (one-renderer WYSIWYG, one-registry openness, real-data discovery). New capabilities keep costing zero Constructor code (registry-driven), and new transform ops/filter controls become schema-driven (reuse the Inspector). 
- **Negative / trade-offs:** large surface to build (FilterSchema editor, 16 StepForms, wells, Page Inspector, VisibilityExpr builder) — mitigated by reusing the Inspector/PropSchema machinery (schema-per-op) instead of bespoke forms, and by Strangler-Fig sequencing behind the existing live editor. Cmd-K/templates add app deps (bounded, app-only). The read-only JSON pane risks becoming a crutch — keep it advanced/collapsed.
- **ISO 25010:** maximises Functional suitability (completeness — everything authorable) and Usability (non-programmer flow), trading short-term build Effort; Maintainability preserved by schema-driven reuse (no per-op/per-control panel code); Compatibility/round-trip held by the one-renderer invariant.

---

## Fitness functions (encode the invariants)

1. **Coverage completeness** — for every DataSpec discriminant, every TransformStep op, every ParamDef type, and every VisibilityExpr op, an authoring surface exists (a test enumerates the unions and asserts a registered editor/StepForm/control — no union member falls through to raw JSON except `custom`). THE headline "build anything" gate.
2. **No raw JSON on the golden path** — a test authors a full dashboard (panel+filter+methodology+locale) through the structured surfaces and asserts the emitted config is valid WITHOUT touching the JSON pane.
3. **Pick-don't-type** — every data-bound field (measure/dimension/member/dataSpec/page ref) resolves options from a catalog (enum-ref), never a free string; a test asserts no data-binding control is a bare TextControl.
4. **Never-broken canvas** — inserting any registered type via getDefaults yields a config that passes validateConfig (every default is valid).
5. **Drop-accept soundness** — a node can only be dropped where `slots.accepts`/`singleton`/`max` permit (registry-driven), tested against the registry.
6. **Show-Me soundness** — suggestPanels proposes a map for a geo dim, a timeseries for a time dim (already on disk; keep).
7. **Lossless round-trip + valid emit** — `fromNodePageConfig(toNodePageConfig(p)) ≡ p` and every emitted config passes validateConfig + locale-coverage + the generated JSON Schema (extends existing).
8. **Inspector openness** — a synthetic registered type/op/control is authorable with zero Constructor code change (the OCP guarantee).

---

## Prioritized roadmap (Strangler-Fig on the live editor; each phase ends green, reverts alone)

MUST-DO for "non-programmer can build ANYTHING" (the mandate) vs GOLD-PLATING are marked.

**V0 — Coverage: page-level FilterSchema/ParamDef authoring [MUST].** A Filters drawer: pick a dimension (cube.dimensions) → choose control type (select/range/cascade/multi/chip/year) → bind options to cube.members → set DefaultSpec → showWhen/enableWhen. Emits FilterSchema into page.meta. *Closes the single biggest gap (a dashboard IS its filters). Fitness #1.*

**V1 — Coverage: the remaining transform ops + DeriveExpr formula box [MUST].** Schema-driven StepForms (a PropSchema per op → reuse the Inspector) for melt/rename/cast/concat/template/addField/select/aggregate/rollup/group/reduce/window/join; a friendly formula input for derive (DeriveExpr string form). *Fitness #1.*

**V2 — Coverage: remaining DataSpec editors [MUST].** row-list, by-mode (recursive editor keyed by ModeId), pivot, transform (reuse PipelineBuilder). *Fitness #1.*

**V3 — Coverage: Page Inspector [MUST].** Select the page root → render presentation projectors' PropFields + frame + modeOrder + page-vars + page-root-kind. Methodology fieldset on data nodes (compliance, Law 9). *Closes presentation/frame/modes/vars/methodology gaps.*

**V4 — Coverage: VisibilityExpr builder + drop-accept validation [MUST].** Node-level "show when" condition builder (eq/in/and/or/mode-is…) in the Inspector; registry-driven drop acceptance (slots.accepts/singleton/max) in the drop handler. *Fitness #5.*

**V5 — Binding ergonomics: field-wells + Show-Me front-and-center [MUST for "easy"].** Replace channel-name typing with MEASURE/DIMENSION/SERIES/FILTER wells fed by the profile (Looker/Tableau); surface suggestPanels as a prominent "Show Me / Recommended" group; profile-bind timeseries/growth/ratio-list codes (kill remaining free-text). *Fitness #3.*

**V6 — Document ergonomics: Outline/Tree pane + slash/Cmd-K insert [MUST for "easy"].** Left Outline (flat store → tree, @dnd-kit reorder/reparent); "/" + cmdk command palette insert-in-place. *Notion/Gutenberg/Webflow ergonomics.*

**V7 — Templates & starters [MUST for "easy"].** A template gallery (Wix/Gutenberg patterns): pre-composed pages/sites seeded into a new session; data-first "connect a cube → generate a dashboard" (extend suggestPanels to a full-page generator).

**V8 — Polish [GOLD-PLATING].** react-colorful color picker, icon picker, per-field hints/reset-to-default (Storybook), read-only synced JSON pane (Adaptive Cards), published-vs-draft visual delta, variant-matrix preview (Plasmic), multi-store/per-page binding, actualRegion-level binding validation.

**Later / YAGNI-gated:** real-time collaboration/presence (Sanity/Figma); factor `@statdash/inspector-kit` (only when a 2nd consumer is real, per panel-as-external-product); UI-schema/data-schema split for multi-layout inspectors (JSON Forms concept — only if basic/advanced layouts prove needed).

**MVP of THIS vision = V0+V1+V2+V3+V4** (total coverage — "can author anything") **then V5+V6+V7** (the "easy for a non-programmer" layer). V8 is differentiation, not correctness.
