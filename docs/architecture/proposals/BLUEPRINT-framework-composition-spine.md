# BLUEPRINT — The Framework Composition Spine

> **Commissioned by:** owner (exhausted, fearing "everything is disposable — nothing framework stands on: no DI, no IoC, no reusable element sharing, canonism felt nowhere"). The ask: go DEEP into the reference platforms' composition architecture and answer with evidence — do we have real **framework bones**, or is it ad-hoc? Then deliver the **canonical composition model** that makes the framework *stand on something*, felt everywhere (0→100).
>
> **Author:** architect. **Method:** read-only, code-cited to the live tree (`platform/packages/*`, `platform/apps/*`). Builds on the five DEEP-2026-07-15 audits + the SYNTHESIS verdict + `BENCHMARK-REFERENCE-PLATFORMS.md`; does not re-verify their findings.
> **Boundary honored:** read-only. This doc is the sole write. **The object model is SETTLED** — ADR-041/042 stand verbatim; ADR-043/044 (Proposed) are the declaration-side meta-laws this spine is the *runtime peer* of. This is **not** a parallel framework, **not** a teardown, **not** the 53rd vision. It ASSESSES what exists and CANONICALIZES it into one adoption sequence.

---

## 0. The one-paragraph answer (for the owner, before the evidence)

**You have real framework bones — reference-grade ones — and they are invisible for a single, precise reason: nothing in the codebase shows "what this app is composed of" in one place.** The platform has a *declaration model* that is at or above the reference class (one type system, one containment grammar, the Projector/Publishable laws), and it has a *reflection seam* (`describeApp()`) that is genuinely Salesforce-Metadata-API-class. What it is missing is the **third leg of a composition story: a named composition root** — the single legible place where registries are populated, platform primitives are bound, and a tenant is assembled. Today that assembly is scattered across five wiring points with no name, so the bones never surface as a *felt* framework. **The fix is not new machinery. It is naming and adopting the composition root the platform is 80% of the way to already owning.** Disposable? No. Under-composed and un-named? Yes — and that is a bounded, ranked, Strangler-shaped fix, not an architecture.

---

## 1. THE HONEST VERDICT — real bones or disposable? (evidence)

### 1.1 The bones are REAL, code-cited

| Bone | Reference-class shape | Live evidence | Standing |
|---|---|---|---|
| **DI / IoC container** | Angular/Nest `InjectionToken` + typed container | `MapContainer implements Container` — `inject`/`provide`/`has`, keyed **by token `description`** (HMR-safe, survives duplicate-module hazard), phantom-typed `InjectionToken<T>` so `provide(token,v)`/`inject(token)` correlate by construction (`packages/react/src/engine/di/Container.ts`, `di/InjectionToken.ts`). Exported from `packages/react/src/index.ts:120-124`. Runtime override port: `NodePageRenderer` applies caller `ContainerSetup` over `createDefaultUI()`. | **Real, minimal, correct — under-leveraged (3 primitives).** |
| **Extension points** | VS Code contribution points / Eclipse extension registry | `ExtensionPoint<T>` (id-keyed, HMR-safe) + `Contribution<T,Ctx>{ order, when, render }` + `ExtensionRegistry.resolve(point,host) = filter(when) → sort(order) → map(render)` — **a fold, already** (`engine/extensions/ExtensionPoint.ts`, `ExtensionRegistry.ts`). Two declared points (`PANEL_TITLE_BADGE`, `SECTION_HEADER_ACTIONS`, `extensions/points.ts`); consumed via a module-singleton (`apps/geostat/src/extensions/registry.ts`). | **Real — populated at 2 points.** |
| **Capability registries** | Grafana plugin registry / Backstage catalog | ~20 registration seams; `registerSlice()` is the **ONE ingestion hub** routing an `ObjectMeta` into `objectRegistry` + the behaviour stores + i18n (`engine/registerSlice.ts`); `objectRegistry` is the **ONE kind-agnostic type-descriptor registry** (ADR-023, `engine/objectRegistry.ts`) with `list/listByKind/getByCapability`. | **Real, ADR-governed — no shared registry *primitive* (each is a bespoke `Map` class).** |
| **Reflection / describe** | Salesforce Metadata API · VS Code `package.json` contributes · Sanity schema export | `describeApp(): AppManifest` composites **11 registries** (palette, propertySchemas, chartTypes, specTypes, perspectives, datasourceKinds, transformOps, metrics, dimensions, exportFormats, filterControlTypes) into ONE JSON-serializable, **SemVer-versioned** contract (`CONTRACT_VERSION='1.1.0'`), with a fitness test locking the axis set against silent breaking change (`engine/constructor.ts`). | **Reference-grade. The single strongest bone — and least celebrated.** |
| **Declaration meta-laws** | Vega-Lite spec · LSP providers · homoiconic core | ADR-038 Bounded Element · ADR-041 Part grammar (residence-on-the-field) · **ADR-043 Projector Law** (`everySurface(decl)=fold(applicable projectors)`) · **ADR-044 Publishable Identity** — the object model is settled and the projection law is named. | **At/above reference class (see the five audits).** |
| **Dependency arrow** | Nx module boundaries / Clean Architecture | `eslint no-restricted-imports` fails the build on an against-arrow import (`platform/eslint.config.js`); engine verified zero-tenant-leakage. | **Machine-enforced. Reference-grade.** |

**This is not the profile of a disposable app.** A disposable app has none of: a typed DI container, HMR-safe extension folds, an ADR-governed one-ingestion-hub registry spine, and a versioned reflective capability manifest. The platform has **all four**, plus the declaration laws above them.

### 1.2 So why does it FEEL disposable? — the one structural cause

The bones are real but **each is populated or consumed from a different place, at a different time, with no single seam that says "this is the app."** Concretely, the Constructor is assembled across **five uncoordinated wiring points** (the panel-quality audit's GAP G1, re-verified):

1. `App.tsx startApp()` — dynamically imports `setupCanvasRegistry`, races it with `initFromApi()` + `bootstrapCatalog()` (`apps/panel/src/App.tsx:67-119`).
2. `setupCanvasRegistry()` — registers perspectives, spreads plugin slices through `registerSlice`, wires store-builders, presentation projectors, and canvas anchor middleware (`apps/panel/src/canvas/setupCanvasRegistry.ts`).
3. `registerBuiltinDockSections()` — a **module side-effect** invoked from `RightDock.tsx`.
4. `fieldControlRegistry` — **self-populates at module-eval** (`FieldControlRegistry.ts`).
5. `App.tsx:35` — a bare `import './inspector/controls/value-mapping/register'` **side-effect** to register a rich control.

There is **no `composeApp(manifest)`** — no place a reader (or a second tenant, or a plugin-SDK host) can look to answer *"what is this app composed of, and in what order."* And the mirror of that gap: the tenant identity is **baked as constants inside** those scattered points — `defaultLocale:'ka'` in three files, the brand string in `LoginForm`, `year`/`range` perspectives hardcoded in `setupCanvasRegistry` (panel audit GAP AG1). So a second tenant cannot drive the panel zero-code (H5 fails).

> **The diagnosis in one line:** the platform has a reference-grade **DECLARATION** model (ADR-038/041/043/044) and a reference-grade **REFLECTION** seam (`describeApp`), but **no named COMPOSITION ROOT** that assembles declarations into a running app. `describeApp()` is the *read* half of a composition root that has no *write* half. **Canonism is unfelt not because it is absent, but because it is never gathered into one visible place.** That is the whole of the owner's felt truth, stated structurally.

### 1.3 Verdict

**REAL BONES, UNDER-COMPOSED.** Reference-class at the substrate (declaration, arrow, reflection, DI, extension folds); **PARTIAL** at composition (no root, scattered wiring, baked tenant). The residual work is a bounded aggregation seam over machinery that already exists — not a rebuild. This is the *same shape* the SYNTHESIS verdict reached for the platform overall ("PARTIAL, converging, not circling"), now localized to the composition layer.

---

## 2. THE BENCHMARK — us vs the class that does this well

Reference-class claims are from product/domain knowledge of these platforms; our column is code-cited to the live tree.

| Platform | Extension / plugin registration | DI / IoC | Reusable-element sharing | Composition root | What makes it "stand on something" |
|---|---|---|---|---|---|
| **VS Code** | `package.json` **contribution points** (declared, static, manifest-scanned) + lazy **activation events** | Services via a hand-rolled `IInstantiationService` + `createDecorator` tokens (a narrow DI, not Spring) | Extensions publish; the marketplace + `extensionDependencies` share them | The **extension host** + the merged contribution manifest — one legible registry of *everything contributed* | **The manifest IS the contract.** You can enumerate every command/menu/view before any code runs. Declaration-first. |
| **Grafana** | `plugin.json` + a signed plugin registry; panels/datasources register into typed catalogs | Light context-based service location; not a DI framework | Plugins are the share unit; versioned + signed | The **plugin registry** + backend service registry; a plugin is discovered, not wired | **Typed catalogs + a plugin manifest** — capabilities are data, not code paths. |
| **Backstage** | Plugin **system** + the new **backend system** (`createBackendPlugin`, `createExtensionPoint`) | Real **DI**: services resolved by ref, extension points injected into plugins | Plugins + shared packages; a plugin *extends* another via its extension points | `createBackend()` — **the explicit composition root**; you `backend.add(plugin)` and it wires the graph | **An explicit `createBackend()` that composes plugins over declared extension points.** This is the closest analogue to what we lack. |
| **Builder.io / Sanity** | `Builder.registerComponent(inputs)` / `defineType`+`defineField` — register a typed descriptor | Minimal; React context for the editor | The **registered component / schema type** IS the reusable, shareable unit | The registry itself (the editor is a projection of it) | **The registry is the SSOT the whole editor projects from** — exactly our `NodeSliceMeta`→palette. |
| **Angular / Nest** | Modules declare `providers`/`imports` | **Full constructor DI** with `InjectionToken`, hierarchical injectors, scopes | Modules + injectable services | The **root module / root injector** — the canonical composition root of the class | **The injector graph** — every dependency is resolved, nothing `new`-ed ad hoc. (The heavyweight end of the spectrum.) |
| **statdash (us)** | `registerSlice()` ingestion hub → `objectRegistry` + behaviour stores; `registerSpec`/`registerMetric`/… (~20 seams); `ExtensionRegistry` fold for additive UI | `MapContainer` + `InjectionToken` — **the right minimal shape**, exported, HMR-safe — but bound at **3 primitives**, no hierarchical scope (correctly, we don't need it) | The **slice / `ObjectMeta` declaration** — registered in `packages/plugins`, projected to palette + inspector generically (above Builder.io: our surface is *completeness-gated*) | **MISSING as a write-seam.** `describeApp()` is the *read* half (11/20 registries, versioned); the *write* half is scattered across 5 points; tenant baked. | **Declaration + reflection are reference-grade; the composition ROOT is un-named.** |

### 2.1 What the leaders do that we don't (the gap, precisely)

1. **Backstage's `createBackend()` / VS Code's merged manifest — the ONE explicit composition root.** Every leader has a single legible place that answers "what is this instance composed of." We have `describeApp()` for *read* and nothing for *write*. **This is the #1 gap and the spine of this blueprint.**
2. **VS Code / Grafana / Builder — the manifest is declaration-first and complete.** You enumerate contributions *before* code runs. Our `describeApp()` is 80% there but covers 11/20 registries and is computed *after* a scattered, order-sensitive boot — so it is a reflection of a wiring you can't see, not a manifest you author.
3. **Backstage — plugins extend each other over *declared* extension points.** Our `ExtensionRegistry` is the right mechanism but is populated at only 2 points and is not yet recognized as a *projector* (ADR-043) — so "contribute to a surface" is an island, not a pervasive spine.

### 2.2 Where we already EXCEED the class (state it — the owner needs the true standing)

- **Completeness-gated projection.** Builder.io/Puck trust the schema author; our `FF-SCHEMA-COMPLETE` makes "every renderable prop is authorable" a build failure if violated. No leader gates authoring-completeness.
- **One containment grammar with residence-on-the-field.** Ahead of Builder.io/Grafana/Sanity (they keep the value band; none unified slots+bands+sourced+chrome under one address grammar — DEEP system-architecture §Appendix).
- **A versioned reflective contract with a conscious SemVer bump policy** (`CONTRACT_VERSION` + fitness lock). Grafana has `plugin.json` versions; few builders version the *whole capability surface* as one contract. This is a genuine strength that is simply not surfaced as "the framework."

---

## 3. THE IDIOM JUDGMENT — Spring-style DI, or registries + context + extension points?

**The critical question, answered without cargo-cult.**

### 3.1 The verdict: STRENGTHEN WHAT EXISTS. A Spring/Angular constructor-DI framework is the WRONG answer here.

For a **TypeScript / React config-driven** platform, the idiomatic IoC is **not** a pervasive constructor-injection container. It is the **triad the platform already owns**, given crisp boundaries and adopted pervasively:

| Mechanism | Cardinality / semantics | The question it answers | Idiomatic in the class | Our seam |
|---|---|---|---|---|
| **Registry** (`registerSlice`, `registerSpec`, `objectRegistry`, …) | **many-of-a-kind**, read via `list`/`get`/`getByCapability` | *"What capabilities of type K exist?"* | Builder.io `registerComponent`, Grafana catalogs, Sanity `defineType` | `objectRegistry` + the ~20 typed stores |
| **DI Container** (`MapContainer` + `InjectionToken`) | **exactly one binding per token** (override/replace) | *"Which implementation of this platform PRIMITIVE is in force?"* | VS Code `IInstantiationService` decorators; React context (the idiomatic React DI) | `createDefaultUI()` + `ContainerSetup` override |
| **Extension points** (`ExtensionPoint` + `ExtensionRegistry.resolve` = fold) | **many additive contributions**, folded by `when`/`order` | *"What optional content contributes INTO this surface?"* | VS Code contribution points; Backstage extension points; Eclipse | `PANEL_TITLE_BADGE`, `SECTION_HEADER_ACTIONS` |

These are **three genuinely distinct roles** (one-of / many-of-a-kind / many-additive), not a fork — and crucially, **the existing shapes are already correct and minimal**: token-by-description (HMR-safe), fold-with-order, one ingestion hub. **Nothing is wrong with the machinery. The failure is adoption (3 DI primitives, 2 extension points) and the missing root — not the mechanism.**

### 3.2 Why a Spring-style container would be *wrong* here (the honest architectural reasons)

1. **React already IS the DI framework.** Context/providers are constructor-injection for components; `useInject` already bridges container→hook. A second, parallel constructor-DI graph would fork the wiring React already owns (SRP violation at the framework level).
2. **The config-driven engine resolves by *declaration*, not by *injection*.** A node is dispatched by `nodeRegistry.get(type,variant)` — the "dependency" is a *registered capability keyed by declared identity*, which is a registry, not an injector. Forcing it through constructor-DI would erase the declaration-first property that is the platform's whole thesis.
3. **YAGNI, named as a trade-off.** Hierarchical injectors, scopes, lifecycle, decorators, reflection-metadata — the entire weight of Angular/Nest DI exists to solve request-scoped server graphs and deep object wiring. We have neither. Buying that machinery would be *over-engineering a container nobody needs* — the exact mirror-error of having no composition story. **The reference-grade move is the minimal container we already have, made pervasive — not a bigger one.**

### 3.3 The one convergence to name (so the triad doesn't drift into a fork)

The `ExtensionRegistry.resolve` fold and the ADR-043 **Projector** fold are **the same shape** (`fold of applicable, ordered contributions over a host/declaration`). An extension point is a **proto-projector**. The canonical model (below) names this so that when ADR-043 builds, extension points are absorbed as the *UI-contribution* family of projectors — **not** left as a fourth parallel mechanism. This is the anti-fork discipline the whole program turns on.

---

## 4. THE CANONICAL COMPOSITION MODEL

> Four named things. Each already 60–90% present. The model is their *unification and pervasive adoption*, not new invention.

### 4.1 The Composition Root — `composeApp(manifest)` ⊕ `describeApp()`

**One module, two faces of one seam** (`packages/react/src/engine/composition/` for the engine-generic half; `apps/panel/src/composition/` for the app half):

```
                         ┌─────────────────────────────────────────────┐
   ConstructorManifest → │  composeApp(manifest)   (WRITE — the root)   │ → a wired app
                         │    · registers every slice (declared order)  │
                         │    · binds every platform primitive (DI)     │
                         │    · installs every extension contribution   │
                         │    · seeds tenant identity (locale/brand/…)  │
                         └───────────────────┬─────────────────────────┘
                                             │  the SAME manifest, reflected
                         ┌───────────────────▼─────────────────────────┐
                         │  describeApp()          (READ — reflection)  │ → the versioned contract
                         └─────────────────────────────────────────────┘
```

- **`composeApp(manifest)` is the missing write half** — the peer of `describeApp()`. It **folds the five scattered wiring points into one ordered, idempotent, introspectable call.** `App.tsx` calls it once; nothing self-populates at module-eval; no bare side-effect imports. This is Backstage's `createBackend()` / VS Code's merged manifest, in our idiom.
- **`describeApp()` stays as-is and grows** to cover the remaining 9 registries (facets, field-controls, dock-sections, presentation, chrome, chart-renderers, skeletons, migrations, expr-ops) — so read-completeness matches write-completeness. Its `CONTRACT_VERSION` discipline already exists; extend the fitness lock over the new axes.
- **Invariant:** `composeApp` and `describeApp` read the SAME `ConstructorManifest`. Compose writes it; describe reflects it. One SSOT of "what the app is."

**Fitness function:** `FF-ONE-COMPOSITION-ROOT` — no registry is populated outside `composeApp`; no capability enters via module-eval self-population or a bare side-effect import (grep gate + a boot test asserting an empty-registry state before `composeApp`).

### 4.2 The Registration Contract — `ConstructorManifest`

The **declarative SSOT of what an app is composed of** — the thing a second tenant swaps, the thing a plugin-SDK host contributes into, the thing `describeApp` reflects:

```ts
interface ConstructorManifest {
  slices:       RegistrableSlice[]        // nodes · panels · chrome · controls · pages (via registerSlice)
  specs:        SpecRegistration[]        // DataSpec resolvers (registerSpec)
  metrics:      MetricDef[]               // governed nouns
  dimensions:   DimensionDef[]            // governed peers (Law 1)
  perspectives: PerspectiveOption[]       // ← today HARDCODED in setupCanvasRegistry; hoist here
  projectors:   Projector[]               // facets + parts + future EXPLAIN (ADR-043 family)
  primitives:   PrimitiveBinding[]        // DI token → component (PanelLayout, EmptyState, ExportMenu, …)
  contributions:ExtensionContribution[]   // extension-point folds (badges, actions, …)
  tenant:       TenantSeed                // { locales, defaultLocale, brand, … } ← today BAKED as constants
}
```

- **Every capability enters through `registerSlice`'s discipline** (one ingestion hub → `objectRegistry` + behaviour store + i18n). The write-seams **stay in their arrow layers** (Law 3 — no mega-registry in `core`); the manifest is the *ordered list of what to register*, not a new registry.
- **`tenant` hoists the baked constants** (`ka`×3, brand, perspectives) into data. Geostat becomes **one `ConstructorManifest` instance**, not the hardcoded default (first-tenant-erosion discipline; makes H5 real).

**Fitness function:** `FF-MANIFEST-IS-TENANT` — no tenant literal (locale, brand, perspective id) appears outside a `ConstructorManifest`; the panel reads seeds from the manifest, never from a constant.

### 4.3 The Reuse Mechanism — "usable elements share in `packages/plugins`"

The owner's felt gap ("no reusable element sharing") has a precise answer in the model the platform already runs:

- **The share unit is the slice / `ObjectMeta` declaration.** A reusable element = a slice folder in `packages/plugins` (`{ Node.ts contract · Shell.tsx render · meta.ts descriptor }`), registered once via `registerSlice`, projected generically to palette + inspector + canvas. **Sharing = registration, not copy.** This is Builder.io's `registerComponent` — and we already exceed it (completeness-gated). *This mechanism exists today and works.* The reason it doesn't *feel* like sharing is §4.1 — there is no root that shows the shared set as one catalog.
- **The next tier of reuse — instance-level sharing (the market's symbols/repeat) — is ADR-041-clean but not yet first-class** (DEEP system-architecture Invisible 7): a *reusable governed sub-instance* (a "governed indicator card" placed N times, each rebinding a different metric, inheriting layout+provenance) requires a `slot` part whose child is itself a full declaration with per-instance overrides. This is benchmark **N1 (symbols) + N2 (governed repeat)** — registered as ARs, gated behind the journeys. **The composition spine is the prerequisite:** a symbol is a *manifest-registered reusable declaration*; without the manifest as SSOT, symbols become a fourth residence and re-open the circle.

**Fitness function (already live):** `FF-NO-EXTERNAL-SPECIAL-CASE` + `FF-SCHEMA-COMPLETE` — a shared element is projected generically; no consumer per-type-special-cases it.

### 4.4 How DI + Extension-Points go PERVASIVE (0→100, without new machinery)

The two mechanisms are "felt everywhere" by **adoption and boundary-clarity**, not by growth:

- **DI Container = the platform-primitive swap port.** Today: 3 bindings (`PANEL_LAYOUT`, `EMPTY_STATE`, `EXPORT_MENU`). Pervasive: **every replaceable platform primitive is a token** — skeletons, error boundaries, the toast/notify port, the a11y-narration surface, the loading affordance. The rule: *if a second tenant or a test might replace it, it is a DI token, bound in the manifest's `primitives`.* This turns "swap a surface" from a fork into a `provide()`.
- **Extension points = the surface-contribution spine.** Today: 2 points. Pervasive: **every place chrome/surfaces gain OPTIONAL, ordered, conditional content is a declared `ExtensionPoint`** folded through `ExtensionRegistry.resolve` — badges, header actions, footer provenance blocks, empty-state CTAs, the future EXPLAIN reader blocks. The rule: *additive content into a surface is a contribution, never a hardcoded child.* And per §3.3, these are **the UI-contribution family of ADR-043 projectors** — so when the Projector Law builds, extension points are absorbed, not forked.

**The crisp boundary that makes canonism *felt* (the SSOT decision):**
> **Declare a capability → Registry. Swap a primitive → DI token. Contribute to a surface → Extension point (a projector).** Three questions, three mechanisms, zero overlap. This single sentence, enforced, is the "framework standing on something."

---

## 5. THE RANKED STRANGLER ADOPTION SEQUENCE (make the spine felt 0→100)

> **Sequencing law (binding):** none of this opens before the live product waves (W1–W5) reach journey-DoD, and **none opens before Stage 0's CI gate runs** — an un-run gate makes "composed correctly" untestable (SYNTHESIS §1). This is the substrate the waves *earn* the right to consolidate. Each step is additive, Strangler-reversible, and sized. WIP=1.

| # | Step | What it does | Size | One-way? | Gate / trigger |
|---|---|---|---|---|---|
| **S1** | **Name `composeApp(manifest)` — the write-half root.** Fold the 5 scattered wiring points (`App.startApp`, `setupCanvasRegistry`, `registerBuiltinDockSections`, `fieldControlRegistry` module-eval, the `value-mapping/register` side-effect import) into one ordered, idempotent call. `App.tsx` calls it once. | **M** | No (aliases through; old points delegate to it, then retire) | After W-planning; rides the panel-quality backlog #3. **This is the first motion.** |
| **S2** | **Hoist the tenant seed into `ConstructorManifest.tenant`.** Retire `defaultLocale:'ka'`×3, the brand literal, the hardcoded `year`/`range` perspectives → manifest data. Geostat = one manifest instance. | **M** | No (additive; seeds move, don't change) | Composes with S1 (same seam). Makes H5 real. |
| **S3** | **Complete `describeApp()` to read-parity** — extend the reflection manifest over the remaining 9 registries (facets, field-controls, dock-sections, presentation, chrome, chart-renderers, skeletons, migrations, expr-ops); extend the `CONTRACT_VERSION` fitness lock. | **S–M** | No (additive read-model) | Fold incrementally into W2/W3 where the Constructor already reads registries. |
| **S4** | **Adopt the boundary doctrine + fitness gates.** Ship `FF-ONE-COMPOSITION-ROOT`, `FF-MANIFEST-IS-TENANT`; write the one-sentence boundary (§4.4) into `packages/CLAUDE.md`. This is what makes canonism *machine-held*, not testimony. | **S** | No | Rides S1/S2 (the gates guard what they land). |
| **S5** | **Pervasive DI — promote replaceable primitives to tokens** (skeleton, error-boundary, notify, a11y-narration, loading), bound in `manifest.primitives`. | **S** each, YAGNI-gated | No | Per real second-consumer/test need — never speculatively. |
| **S6** | **Pervasive extension points — declare a point per additive surface slot** (footer provenance, empty-state CTA, …), folded through `ExtensionRegistry`. | **S** each | No | As each surface needs optional contribution; converges into ADR-043's projector family when H-EXPLAIN builds. |
| **S7** | **Instance-level reuse (N1 symbols / N2 governed repeat)** — the reusable governed sub-instance as a manifest-registered declaration. | **L** | Partly (a new node concept in `packages`) | **AR-registered, gated behind the journeys** and behind S1–S4 (the manifest must be the SSOT first, or symbols fork a residence). |

**Read the ordering as a 0→100 dial:** S1–S2 (the root + de-baked tenant) take composition from *invisible* to *legible* — the single biggest felt jump. S3–S4 make it *complete and machine-held*. S5–S6 make DI + extension points *pervasive by adoption*. S7 is the reuse capability the owner names, landing cleanly only *because* S1–S4 gave it an SSOT.

### 5.1 What to explicitly NOT do

1. **Do not build a Spring/Angular constructor-DI container.** The triad + React context is the idiomatic answer; a parallel injector graph is the over-engineering mirror-error (§3.2).
2. **Do not pull the write-seams into one mega-registry in `core`.** Each stays in its arrow layer (Law 3). `composeApp` is an *ordering* over the existing registries, not a new one.
3. **Do not let extension points become a fourth parallel mechanism.** They are the UI-contribution family of ADR-043 projectors — name the convergence now (§3.3), absorb at build time.
4. **Do not build S7 (symbols) before S1–S4.** Without the manifest as SSOT, a reusable sub-instance becomes a fourth residence and re-opens the exact circle the object-model settlement closed (DEEP system-architecture Invisible 7).
5. **Do not open any of this before Stage 0's gate runs.** Un-run CI makes "composed correctly" untestable; consolidating wiring you can't prove green is motion, not progress.

---

## 6. THE SINGLE FIRST FOUNDATION-MOTION

> **Drive `composeApp(ConstructorManifest)` — the named composition root (Step S1).**

It is the write-half of the seam the platform is already 80% to owning: `describeApp()` proves the reflection works; `composeApp()` is its missing mirror. In one bounded, Strangler-reversible, additive move it:

- gives the framework **the one legible place** that answers "what is this app composed of" — the thing every leader (Backstage `createBackend`, VS Code's merged manifest) has and we don't;
- makes the **scattered five wiring points into one ordered call** — killing the module-eval self-population and side-effect imports that make the boot feel accidental;
- is the **prerequisite** for de-baking the tenant (S2 → H5), completing reflection (S3), the fitness gates (S4), and instance-reuse (S7);
- and it is the smallest possible act that turns the owner's felt "nothing framework stands on" into a false statement — because after S1 there **is** a single place the framework stands, and it is called by name.

**It costs one M-sized aggregation seam over machinery that already exists. It is the key that makes the bones visible.**

---

*— architect, framework composition spine, 2026-07-15. Read-only study; the object model (ADR-041/042/043/044) stands verbatim. This blueprint canonicalizes composition; it does not re-conceive it.*
