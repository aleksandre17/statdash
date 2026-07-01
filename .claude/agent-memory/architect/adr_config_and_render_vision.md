---
name: adr-config-and-render-vision
description: Decision-grade vision ADR — our JSON config-object architecture & SDUI rendering system vs best-in-class (Vega-Lite/Grafana/Builder.io/Adaptive Cards/JSON Forms/RSC/Radix), the hybrid best-of-breed, and the one-body cohesion strategy with invariants/fitness functions. Reshapes finish-line priorities.
metadata:
  type: project
---

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
