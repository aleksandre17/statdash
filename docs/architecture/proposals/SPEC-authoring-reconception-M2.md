# SPEC — Authoring Reconception M2: Model mode + the Steward role (the "define" half)

> **Status:** DESIGNED (bold proposal — owner sign-off pending) · **Author:** platform-architect (Opus) · **Date:** 2026-07-09
> **Milestone of:** AR-49 (`SPEC-authoring-reconception-vision.md`, owner-APPROVED). This is the **detailed design for M2 only.** M0 (semantic layer + Metric Palette) and M1 (the Studio shell, wizard deleted, react-admin retired) are BUILT and LIVE.
> **Registry:** AR-49 card (`ARCHITECTURE-REGISTRY.md` §B) — row-update appended.
> **Consumes / completes:** the vision's M2 scope (*define-vs-curate as a ROLE; relocate query/pivot/cube modeling behind the Steward*), AR-40 (semantic-layer spine), AR-10 (`describeApp()`/PropSchema), AR-11 (StyleField pattern reused for governance fields), AR-47 (authoring governance — the versioning discipline M2 seeds), AR-30 (MT seam — preserved, not built).
> **Grounded against (read, in code):** `packages/core/src/data/{metric,dimension,metric-calc,metric-store,manifest-catalog}.ts` (the semantic-layer engine) · `packages/contracts/src/manifest.ts` (`ManifestMetric`/`ManifestDimension`/`ManifestMetricCalc` wire shapes — already complete) · `apps/api/src/routes/bootstrap/index.ts` (reads `site_config.metrics`/`dimensions`) · `apps/api/src/routes/config/site.ts` (`PUT /` upserts arbitrary `site_config` keys) · `apps/api/provisioning/geostat.provisioning.json` (the `metrics`/`dimensions` seed) · `apps/panel/src/store/bootstrapCatalog.ts` (`fetchCatalogManifest` + `registerManifestMetrics/Dimensions`) · `apps/panel/src/lib/cubeApi.ts` (`cubeApi.profile` → raw measures + resolved units) · `apps/panel/src/studio/{rail.ts,ActivityRail.tsx,surfaces/DataSurface.tsx}` (the LOCKED `Model🔒` slot + the M1 "Advanced" disclosure awaiting relocation) · `apps/panel/src/features/data-layer/DataModelingPanel.tsx` (the raw modeler to relocate).
>
> **Scope discipline:** M2 is **apps/panel-only, additive, and reversible — the dependency arrow does not move and no engine code changes.** The metric/dimension/calc *engine* (registries, `resolveMeasureRef`, `metric-calc`) already exists; the wire contracts already carry every field; the delivery round-trip (`site_config → /api/bootstrap → registerManifest*`) already works. **M2 builds the AUTHORING half only: a role lens, a Model surface, an in-tool metric editor, and a save action** — every one riding a seam that is already in code. The one deliberate behavioral change is the promise M1's DataSurface comment already made to itself: the raw query/pivot/cube modeling **leaves the author's default path** and moves behind the Steward.

---

## 0. What M2 is, in one paragraph

M1 laid a **`Model🔒` slot** on the activity rail and parked the raw source/spec/query modeler under a demoted **"Advanced" disclosure** on the Author's Data surface, with a comment that literally reads *"present so no capability is lost before M2 relocates it behind the Steward role."* M2 keeps that promise. It introduces the **Steward** as a **lens** — a persisted mode, *not* an RBAC/auth/tenant system — that unlocks **Model mode**: a summonable left surface over the **same live canvas** where a steward **defines** the governed semantic layer. Model mode is where the relocated raw modeler lives *and* where the milestone's real novelty ships: **in-tool metric authoring** — a steward picks a real SDMX measure from a dataset's cube profile (`cubeApi.profile`), sets governance (bilingual label · unit · format · default aggregation · default-dims · methodology), and **saves a governed metric into the same `site_config.metrics` catalog the runner already boots from.** The Author's Data surface simplifies to the **Metric Palette only** — no query editor is reachable from the author's path anymore (the vision's `FF-AUTHOR-NO-QUERY`, now real). The load-bearing guarantee, inherited from M0: an authored metric is **pure JSON**, validated against its live cube profile at the boundary, delivered through the **unchanged** `/api/bootstrap → registerManifestMetrics → resolveMeasureRef` pipeline — so a steward-authored metric is byte-identical to a provisioned one, and every consuming block re-renders through the *one* resolution seam. The hard part — a **calc/measure-algebra editor** (the `MetricCalc` runtime already exists; only its authoring UI is deferred) — is explicitly **out of M2** (§4.4, §14).

---

## 1. Competitor deep-study — the MODELER-vs-CONSUMER role separation, specifically

M0 studied the *semantic model*; M1 studied the *shell*. M2's question is narrower and sharper: **how do the leaders separate the person who defines governed data from the person who composes with it — and how do they surface that split without a wall?** For each: the one role-separation idea, then where we go **beyond**.

| Platform | The one role-separation idea | Take it? / Beyond |
|---|---|---|
| **Looker / LookML** | A hard **Develop mode** toggle in the header: the modeler edits `.model`/`.view` LookML (an IDE); analysts *Explore* and build dashboards from the governed result. Two audiences, one product, gated by a `develop` permission. | **The keystone — take the split, refuse the IDE.** LookML makes the modeler write **code**; our Steward composes governed nouns in a form (non-programmer, the whole AR-49 thesis). The header **Develop toggle** is exactly our role lens; the *content* behind it is a metric editor, not a text buffer. |
| **Power BI** | A left **view-rail: Report · Data · Model** — the modeler enters **Model view** (relationships, DAX measures) on the *same file*; a report author rarely opens it. The split is a **lens on one artifact**, not a separate app. | **The closest analog — take the lens shape.** Our `Model` rail entry is a summonable surface over the **same live canvas** (M1's Power-BI-role-rail-but-a-lens framing). **Beyond:** Power BI's Model view is a full context-swap that *hides the report*; our Model surface leaves the canvas mounted — the steward sees the dashboard react as they define. |
| **Sigma** | Governance by **object class**: admins model **datasets/connections** (governed, versioned); analysts build **workbooks** on top. The boundary is the *object*, not a mode. | **Partial.** Confirms "the governed layer is a distinct, protected object." We express it as a *surface* (Model) rather than a separate object store, because our governed catalog is one `site_config` SSOT (M0 decision), not a per-object ACL system. |
| **dbt Semantic Layer / MetricFlow** | Metrics are **defined once in versioned YAML by analytics engineers**, consumed everywhere downstream (BI, notebooks, API). Pure define-once; the definition is **code under review**. | **Take the define-once discipline; the review/versioning is AR-47.** dbt proves the metric is the contract. **Beyond:** our definition is *authored in a UI by a non-programmer*, yet still pure declarative data (Law 2) — it gets dbt's governance without dbt's code barrier. |
| **Cube.dev** | The **modeler owns a schema (`dataSource`-on-measure); the API is the product.** Consumers never see the model, only the measure. | **We already ship this** (`MetricDef.dataSource`, benchmark row 6). Cube validates the *shape*. **Beyond / refuse-the-runtime (held from the vision):** Cube assumes SQL; we stay SDMX/OLAP-native (Law 5). The Steward defines over a **cube profile**, not a warehouse. |
| **Metabase / Superset** | A **progressive query notebook** hides SQL until the modeler wants it — the escape hatch. | **This is where the relocated raw modeler belongs.** Metabase's notebook is the *steward's* on-ramp, never the author's. Our `DataModelingPanel` (query/pivot/growth/transform) is exactly this — M2 moves it from the author's Advanced disclosure into Model mode. |
| **Tableau (Data Source vs Sheet)** | Data-source authoring (joins, calc fields, governed roles) is a **distinct tab** from sheet-building. | Confirms **tab/surface separation of define vs compose**; we already have the surfaces (M1) — M2 fills the modeling one. |

**Synthesis — the split the field agrees on, and our shape of it:** every leader separates a *modeling audience* (defines governed entities, once) from a *composing audience* (curates many artifacts), and the **best** (Power BI) express it as a **lens on one artifact gated by capability**, not a separate tool. **Where we go beyond all of them:** (1) the modeler is a **non-programmer** — Model mode is a governed *form over a cube profile*, not LookML/DAX/SQL/YAML; (2) the lens **never hides the artifact** — the canvas stays live while the steward defines, so define-vs-curate happens on **one document**; (3) the defined metric is **statistics-grade by construction** — bilingual label, unit, methodology and provenance are *fields of the definition*, not afterthoughts (Law 9). **The opinion, plainly:** M2 is **Looker's Develop-toggle + Power BI's Model-lens + Metabase's escape-hatch — with the modeler's tool being a governed metric form a domain expert can drive.**

---

## 2. The Steward role as a LENS (not a permission system)

This is the first load-bearing decision, and the one with an auth/one-way-door adjacency the brief flags. **The Steward is a lens, not RBAC. M2 builds the lens and *preserves* — does not build — the seam that later binds it to real auth** (the same discipline AR-30 applies to multi-tenancy).

### 2.1 What a lens is here

A single value `Role = 'author' | 'steward'`, read through **one selector, `useRole()`**, that decides:
- whether the `Model` rail entry is **unlocked** (steward) or **absent/locked** (author);
- whether the Data surface shows **only the Metric Palette** (author) or the palette **plus** a "manage catalog" affordance (steward — a shortcut into Model).

That is the entire behavioral surface of the role. Everything else — the canvas, pages, store, save pipeline — is identical for both. Define-vs-curate is an **information-architecture projection over one document**, exactly as M1 promised ("role is a lens on ONE canvas, not a separate tool").

### 2.2 Where the role value comes from today (no auth built)

The panel is **already behind Bearer-JWT auth** (`config/*` is guarded; `lib/auth.getToken()` exists; the steward is, by construction, an authenticated user). So M2 does **not** build a login, a user table, or roles-in-the-DB. The lens value comes from a **persisted local preference**:

- a tiny Zustand slice (`role: Role`, default `'author'`) persisted to `localStorage` (`statdash.role`), toggled by a **"Model mode" control** in the top bar and a `⌘K` command ("Enter Model mode / Return to Compose");
- default **`author`** — the safe, governed-noun surface is what a fresh session lands on.

**Honest framing (Observation Duty):** because there is no server enforcement yet, the lens is a **task/audience organizer and safety-by-default device, not an access-control boundary.** A user can flip the toggle. That is *correct* for single-tenant-first: Geostat's tool has one trusted operator surface; the split's job today is to keep the query cliff off the compose path, not to police users. Enforcement arrives when the claim binds (§2.3). Stating this prevents a false sense of security later.

### 2.3 The preserved seam — later binding to real auth (built: 0 lines of RBAC)

`useRole()` is the **single reader** of role, so its *source* is swappable behind an unchanged signature:

```
today:   useRole() → localStorage preference (default 'author')
later:   useRole() → auth-claim projection (JWT 'role'/'scope' the config API already issues)
```

When multi-user/RBAC is really needed, the change is: the API's auth token carries a `role` claim, and `useRole()` reads it instead of (or gated by) the preference. **No component changes** — they all read `useRole()`. This is the AR-30-style "seam preserved, not built": the indirection exists now; the enforcement point is reserved and documented, not implemented. `FF-ROLE-IS-LENS` (§12) locks it — role is read *only* through `useRole()`, and the Model surface gates on the lens value, never on an auth/tenant/user primitive.

### 2.4 Author vs Steward over the SAME document

| | **Author** (default lens) | **Steward** (Model lens) |
|---|---|---|
| Rail | `Insert · Data · Layers · Pages&Site · Style` | + `Model` (unlocked) |
| Data surface | **Metric Palette only** — governed nouns, bind-by-pick | Metric Palette + "manage catalog →" shortcut into Model |
| Sees the query/pivot/cube editors? | **No** — not reachable from any author surface (`FF-AUTHOR-NO-QUERY`) | Yes — in Model mode (the escape hatch) |
| Defines metrics/dimensions? | No — consumes the catalog | **Yes** — the Metric Editor (§4) |
| Canvas / pages / store | identical | identical (Model is a left surface over the *same* live canvas) |

The steward and author edit the **same site, the same pages, the same store** — the rails recontextualize; the document never forks. That is the whole point of role-as-lens.

---

## 3. Model mode — unlock the slot, relocate the modeler

### 3.1 Unlock the `Model🔒` slot

M1 registered the rail entry with `locked: true` (`rail.ts`) and rendered it as a disabled, lock-badged button (`ActivityRail.tsx`) tooltip'd "coming in M2". M2:

- drops `locked` from the `model` `RailEntry` and instead makes its **visibility** a function of `useRole() === 'steward'` (the rail filters entries by lens; adding a role-gated surface = one predicate, OCP-clean — the rail is already a data table, not a switch);
- adds the `model` case to `StudioShell`'s left-dock dispatch (one `case`, mirroring the other five surfaces).

The `Model` surface is a **summonable left dock over the always-mounted canvas** — never a route, never a mode that hides the artifact (the M1 shell contract, held).

### 3.2 What Model mode contains

Three regions, top to bottom by frequency (progressive disclosure, the M1 non-programmer contract):

1. **Metric catalog (define — the headline, §4):** the governed metric list + the **Metric Editor** (define/edit a base metric from a cube-profile measure + governance). This is the "define" half of define-vs-curate, in-tool for the first time.
2. **Dimension catalog (curate the noun — thin peer, §4.5):** the governed dimension list + a thin editor (label · conceptRole · defaultMember · member whitelist over a cube dimension). Law 1 symmetry; cheap because `DimensionDef` is thin.
3. **Raw data modeling (the escape hatch — relocated):** the **existing `DataModelingPanel`** (DataSources with Excel ingest + `SourceAuthoringPanel`; DataSpecs with the `DataSpecEditor` suite — query/pivot/growth/transform — + Show-Me), **moved verbatim** from M1's Data-surface "Advanced" disclosure into Model mode. No rewrite (Strangler, Law 6/7 — the component is already extracted and shared).

### 3.3 Model mode vs the Author's Data surface — the difference

| | **Data surface (Author)** | **Model mode (Steward)** |
|---|---|---|
| Purpose | **Curate** — browse + bind governed metrics/dimensions | **Define** — author the governed catalog + the raw feeds behind it |
| Metrics | read-only palette (pick to bind) | **read-write** editor (create/edit) |
| Raw sources / DataSpecs / query editors | **absent** | present (the relocated `DataModelingPanel`) |
| Writes to config | a block's `measure` field (a metric-id) | the `site_config.metrics`/`dimensions` catalog SSOT |
| Blast radius of an action | one block | every block bound to the edited metric (§6) |

After M2, the Data surface's M1 "Advanced" `Accordion` is **removed** — its `DataModelingPanel` now lives only in Model. This is the Strangler relocation the M1 comment reserved; nothing is lost, one thing moves audience.

---

## 4. In-tool metric authoring — the "define" half (the milestone's real novelty)

Today metrics exist in the tool only because they were **seeded from `geostat.provisioning.json`** into `site_config.metrics`; there is **no in-tool metric authoring**. M2 adds it. The engine (`MetricDef` registry, `resolveMeasureRef`, provenance decorator) and the wire contract (`ManifestMetric`) already carry every field — **M2 adds the authoring surface and a save action, nothing in `packages/`.**

### 4.1 The Metric Editor — pick a measure, govern it

The steward's flow (all **pick, never type** — Law 2 discipline extended to *definition*):

1. **Pick a dataset** — `cubeApi.datasets()` (the same public list the source-authoring cube picker uses).
2. **Pick a raw SDMX measure** — `cubeApi.profile(datasetCode).measures` (code + **resolved unit** with its source tier). The steward never hand-types a measure code; they select a real one that provably exists in the cube (this is the `FF-CATALOG-EDIT-SAFE` boundary, §6).
3. **Govern it** — a form (PropSchema-shaped, reusing the generic Inspector controls where they fit — Law 8, no bespoke form machinery):

| Governance field | Control | Source / default |
|---|---|---|
| `id` (registry key) | text, **immutable after create** (§6) | steward-chosen, slug-validated, uniqueness-checked against the catalog |
| `label` (bilingual) | `LocaleString` editor (exists) | required |
| `unit` (bilingual) | `LocaleString` editor | **pre-filled** from the measure's resolved unit (`CubeResolvedUnit`); a `source:'none'` unit warns (steward must supply one) |
| `format` (`FormatKey`) | enum picker over the format registry | optional; drives numeric display once |
| `agg` | `sum \| avg \| last` select | optional |
| `dims` (default-dims) | **governed dimension pins** — pick dimension + member from the cube profile | optional; Law 1 generic `Record`, never `year`/`geo` special-cased |
| `methodology` | URL text | optional; flows to provenance badges (Law 9) |
| `description` | bilingual text | optional |
| `dataSource` | **auto-set** to the picked dataset's storeKey | derived, not typed |

4. **Save** → the catalog SSOT (§5), re-registered live so the new metric appears in the Author's Metric Palette **without a reload**.

### 4.2 Why this is safe by construction

- The output is a **pure `ManifestMetric` JSON object** — no function, no expression-as-code, no `fetch` (Law 2). It is the *same shape* the provisioning seed carries; a steward-authored metric and a seeded one are indistinguishable downstream.
- The `code` is chosen from the **live cube profile**, so a governed metric can never reference a non-existent measure (the boundary validation, §6).
- It lowers through the **unchanged** `resolveMeasureRef → DataStore` pipeline — the renderer, ViewSnapshot, export, and provenance seams are untouched (the M0 guarantee, extended to the define side).

### 4.3 Provisioning becomes the *seed*, the tool becomes the *editor*

`geostat.provisioning.json` remains the **initial seed** of `site_config.metrics`; after M2, the tool **edits the same rows**. One SSOT, two writers (seed-once, then author). **Flag (§14):** a naive re-provisioning would overwrite tool-authored metrics (last-write-wins on the blob) — recommend provisioning's metrics/dimensions keys become **seed-if-absent**, or accept provisioning as a strict one-time bootstrap. A minor governance note, not a blocker.

### 4.4 Explicitly DEFERRED — the calc/measure-algebra editor

The **runtime** for calculated metrics **already exists and is live**: `MetricCalc` (engine), `ManifestMetricCalc` (wire), `metric-calc.ts` (`resolveMetricValue` via `@statdash/expr`), and `resolveMeasureRef` already expands a calc metric to its components. A steward *cannot yet author* "GDP per capita = GDP ÷ population" **in the tool** — that requires a **visual expression builder** (pick inputs, compose a safe whitelisted expression), which is a substantial authoring surface of its own. **M2 defers it** (YAGNI on the hard authoring UI; the seam is proven by the runtime + the seed can still carry calc metrics as JSON). It becomes **M2.5 or M3** ("measure-algebra editor"). This is the honest power/simplicity call: ship base-metric authoring (covers the vast majority of governed nouns) at high polish; defer the expression editor until a real steward needs to author a derived metric that the seed can't cover.

### 4.5 Dimension authoring — thin, included last (droppable)

`DimensionDef` is deliberately thin (curation over a cube dimension: label · conceptRole · defaultMember · member whitelist). A steward editor for it is cheap and preserves Law 1 symmetry (dimensions are equal citizens). **Included as the final M2 sub-milestone (M2.4), droppable without affecting the rest** — if timeboxed out, dimensions still reach authors as raw cube members (byte-identical status quo), losing nothing.

---

## 5. Persistence + delivery — the round-trip (reuses M0/M1 seams end-to-end)

**The single most important finding of the grounding: the delivery round-trip already works. M2 adds only the write half in the panel.**

```
STEWARD authors (Model mode)
        │  (edits an in-memory ManifestMetric)
        ▼
saveSemanticCatalog()  ── PUT /api/config/site { metrics:[…], dimensions:[…] }   ← existing route, accepts arbitrary keys
        ▼
config.site_config (keys 'metrics'/'dimensions')  ← the ONE governed catalog SSOT (M0 decision; NOT publish-versioned)
        ▼
GET /api/bootstrap  ── projects site_config.metrics/dimensions verbatim          ← existing route (already reads these keys)
        ▼
registerManifestMetrics / registerManifestDimensions (@statdash/engine)          ← existing boot seam (runner AND panel)
        ▼
engine registry → resolveMeasureRef → Author's MetricPalette + the runner's render
```

### 5.1 What M2 adds in the panel (and only there)

- **A `semanticCatalog` store slice** — `{ metrics: ManifestMetric[], dimensions: ManifestDimension[] }`, hydrated at boot from **`fetchCatalogManifest()`** (already exists in `bootstrapCatalog.ts`; it already returns `{metrics, dimensions}`). This is the editable authoring copy.
- **A `saveSemanticCatalog()` action** — `PUT /api/config/site { metrics, dimensions }`. The transport already accepts arbitrary keys (`SiteBody = z.record(z.unknown())`). This is a **new, distinct action from `saveSite`** (ISP — identity/theme save vs catalog save are separate concerns; do **not** widen `saveSite`'s field whitelist).
- **Live re-registration after save** — call `registerManifestMetrics/Dimensions` with the saved catalog (the exact seam `bootstrapCatalog` uses), so the live `MetricPalette` and canvas reflect the new metric immediately, no reload. Closes the author-sees-it-instantly loop.

### 5.2 api / contracts additions — essentially none (M2 rides existing seams, like M1 rode the arrow)

- **contracts:** **no change.** `ManifestMetric`/`ManifestMetricCalc`/`ManifestDimension` already carry every field (`code`/`calc`/`label`/`unit`/`format`/`methodology`/`dims`/`dataSource`; dimension `code`/`label`/`conceptRole`/`defaultMember`/`members`).
- **api:** **no route change required** — `PUT /api/config/site` and `GET /api/bootstrap` already do the job. **One optional, additive hardening (recommended, §6):** a server-side **validator** on the `metrics`/`dimensions` keys at `PUT` time (shape + "id unique" + "code non-empty") — contract-first at the boundary. Additive, api-only, respects the arrow. Can be client-first in M2 and server-hardened as a fast-follow; flagged, not blocking.
- **arrow:** **unchanged.** M2 is `apps/panel` + a reused `apps/api` route + reused `@statdash/engine` seams. `packages/core`/`contracts` untouched.

---

## 6. Governance integrity — "one governed number" must not become "one silent break"

The M0 promise ("one governed number on every surface") is a double-edged sword once stewards can *edit* metrics: a change to a metric's `dims`/`unit`/`format` propagates to **every** bound block — which is the *intended* power, but it must never be **silent** or **corrupting**. Five protections, tied to the M0 `FF-BIND-PARITY` discipline:

1. **Immutable id (parallel-change / expand-contract).** The Metric Editor **cannot change an existing metric's `id`** (rename the `label`, never the key). Stored page configs reference metrics **by id** (M0 bind writes the id into `measure`); an immutable id means a stored ref can never dangle. Changing identity = **add a new metric + migrate refs + retire the old** (expand-contract), never an in-place id mutation. `FF-ID-IMMUTABLE` (§12).

2. **Boundary validation (contract-first).** Before persist, an authored `MetricDef` is validated against its **live cube profile** (`cubeApi.profile`): `code` must be a real measure in its dataset; every `dims` key must be a real dimension; every default member must be a real member. **An invalid metric cannot be saved** — the governed catalog is provably resolvable. `FF-CATALOG-EDIT-SAFE` (§12).

3. **Impact preview (blast-radius before commit).** Editing an existing metric shows **"N blocks across M pages reference this metric"** (a reverse index over page configs' `measure` fields — a pure read, computable in the panel from the loaded pages). The steward sees the blast radius *before* saving a default-dims/unit/format change. This turns the propagation from silent to **surfaced** — the governance-integrity affordance.

4. **Delete-guard.** Deleting a **referenced** metric is **blocked with the consumer list** ("used by N blocks — rebind or remove them first"). If an unreferenced metric is deleted, no consumer is affected. Postel backstop: even if a dangling ref somehow reached a config, `resolveMeasureRef` treats an unknown id as a **raw code** (empty state / no governance), so a delete degrades gracefully — never crashes a render.

5. **Parity discipline (extends FF-BIND-PARITY).** A governance edit re-renders **all** consumers through the **one** `resolveMeasureRef` seam — there is no second path that could drift (the structural reason chart≡KPI holds). `FF-METRIC-AUTHORING-SERIALIZABLE` asserts an authored metric is pure JSON that round-trips `site_config → bootstrap → registry` byte-identically — the *define* side of the byte-identity M0 proved for the *bind* side.

**Versioning posture (ties to AR-47).** The M0 decision stands: the semantic catalog is **global `site_config`, one SSOT, not publish-versioned** (there is no draft-vs-published for the model itself — the runner and the author read the same catalog). M2 protects consumers via *immutability + validation + impact preview + delete-guard*, **not** via a version history. **Per-metric version history / audit / review-before-publish is AR-47's job** — M2 seeds the discipline (immutable id, impact preview) and names the expand-contract migration to a relational per-metric store (§14) as AR-47's future move, not M2's.

---

## 7. Target architecture + Strangler path (arrow unchanged)

M2 lives entirely in `apps/panel` (plus a reused api route and reused engine seams). **The dependency arrow does not move; no package below `apps` changes.** As with M1, the strongest evidence M2 is right: the engine never notices.

```
contracts ← expr ← core ← charts ← react ← plugins ← apps/panel
   │                 │                                   │
 (ManifestMetric   (MetricDef registry ·                │  NEW (apps/panel only):
  already carries    resolveMeasureRef ·                 │   • role lens: store slice + useRole() + top-bar/⌘K toggle
  every field)       registerManifest* ·                │   • Model surface (rail unlock + StudioShell dispatch case)
                     metric-calc runtime)                │   • MetricEditor + DimensionEditor (define)
                     — ALL ALREADY LIVE, unchanged       │   • semanticCatalog slice + saveSemanticCatalog() action
                                                         │   • RELOCATE DataModelingPanel: DataSurface "Advanced" → Model
                                                         │
apps/api (reused): PUT /api/config/site (arbitrary keys) · GET /api/bootstrap (reads metrics/dimensions)
         (optional additive hardening: server-side validator on the metrics/dimensions keys)
```

**What M1's "Advanced" disclosure becomes:** it is **removed from the Data surface** and its `DataModelingPanel` is **mounted in Model mode**. The component is untouched (already extracted + shared in M1.3); only its host changes. Author loses the query cliff from their path; steward gains the escape hatch in the right room.

**Strangler principle (Law 7):** every M2 move is a **relocation or an additive surface**, never a rewrite. The role lens is additive (default `author` = today's behavior). The Metric Editor is additive (a new surface over existing engine seams). The modeler relocation is a host swap. Each is independently reversible: lens off → author-only (M1 behavior); editor unshipped → provisioning-seeded catalog (M0/M1 behavior); relocation reverted → Advanced disclosure back. **No page of authoring capability is ever offline.**

---

## 8. Package / library evaluation for M2

Selection principle unchanged (adopt only if it strengthens AND simplifies AND honors the arrow + Config = SSOT). **M2's honest call: add nothing.**

| Candidate | Verdict | Why |
|---|---|---|
| A form library (react-hook-form / Formik) for the Metric Editor | **REJECT** | The governance form is small and PropSchema/Inspector controls already exist (`LocaleString` editor, enum pickers). A form lib = churn + a second field model competing with our PropSchema (Config = SSOT risk). Reuse the generic Inspector controls (Law 8). |
| A validation lib (Zod) in the panel for the authored metric | **REUSE existing** | Zod is already the api's boundary validator; the panel validates against the **cube profile** (semantic, not just shape) — a pure function, no new dep. |
| An expression-editor lib (for calc metrics) | **N/A — deferred (§4.4)** | The calc editor is out of M2; evaluate at M2.5/M3 (a monaco/blockly-class decision), not now. |
| A state/persistence lib for the catalog slice | **REJECT** | Zustand already carries the store; the catalog slice is one more slice. No new machinery. |
| react-admin / any CRUD framework for the metric list | **REJECT (M1 already retired it)** | The metric list is a Zustand-backed list + our own editor. Re-introducing a CRUD framework would re-grow the drift magnet M1 cut. |

**M2 adds only our own code:** the role lens, the Model surface, the Metric/Dimension editors, and the save action — all on existing seams. The value is *capability* (in-tool define) + *reorganization* (relocate the modeler behind the role), not accretion — the same discipline as M1.

---

## 9. Phasing within M2 — sequenced, each reversible & independently valuable

| Sub-M | Delivers | Reversible? | FFs that lock the seam | Depends on |
|---|---|---|---|---|
| **M2.0 — role lens + unlock Model** ⭐ (recommended first) | `role` slice (persisted, default `author`) + `useRole()` + top-bar/⌘K toggle; rail filters entries by lens; unlock the `Model` slot; `StudioShell` dispatches the (initially minimal) Model surface. **Preserved auth-binding seam documented.** | Yes (lens defaults to author = M1 behavior) | `FF-ROLE-IS-LENS` | — (M1 shell) |
| **M2.1 — relocate the modeler** | Move `DataModelingPanel` from the Data-surface "Advanced" disclosure into Model mode; **remove the Advanced disclosure** from the Data surface (Author = Metric Palette only). | Yes (re-add the disclosure) | `FF-AUTHOR-NO-QUERY` (no query editor reachable from an author surface) | M2.0 |
| **M2.2 — Metric Editor (define)** ★ headline | `semanticCatalog` slice + Metric list + **Metric Editor** (dataset→measure pick, governance form, immutable id, validation) + `saveSemanticCatalog()` (PUT config/site) + live re-register. Base metrics only. | Yes (unship editor → provisioning-seeded catalog) | `FF-CATALOG-EDIT-SAFE`, `FF-METRIC-AUTHORING-SERIALIZABLE`, `FF-CATALOG-ONE-SSOT`, `FF-ID-IMMUTABLE` | M2.0 |
| **M2.3 — governance integrity affordances** | Impact preview (reverse index) + delete-guard; **optional** server-side validator on the metrics/dimensions PUT keys (additive api hardening). | Yes | (folds into `FF-CATALOG-EDIT-SAFE`) | M2.2 |
| **M2.4 — dimension curation editor** (thin, droppable) | The `DimensionDef` editor (label · conceptRole · defaultMember · whitelist) over a cube dimension; saves via the same `saveSemanticCatalog()`. | Yes | (rides `FF-CATALOG-ONE-SSOT`) | M2.2 |

**Deferred beyond M2:** the **calc/measure-algebra editor** (M2.5/M3, §4.4); per-metric **version history / review-publish** (AR-47).

### First sub-milestone recommendation: **M2.0 — the role lens.**

**Rationale:** (1) it is the **smallest, lowest-risk, fully additive cut** (default `author` = today's exact behavior — zero regression), yet it establishes the **organizing axis** every other M2 piece hangs on; (2) it **de-risks the sensitive decision** (auth binding) by making the lens a documented, swappable seam *before* any editor exists to argue about — the owner can bless the "lens now, claim later" posture on a tiny surface; (3) unlocking `Model` gives an immediate, visible win (the steward surface appears) that frames the milestone; (4) it lets M2.1 (relocate the modeler) proceed the moment the lens exists, because "behind the steward" needs the steward to exist first. Sequencing the Metric Editor first would build the headline before the room it lives in.

---

## 10. Build decomposition (ordered; owner tier; deps; parallelism)

| # | Work item | Owner tier | Depends on | Parallel? |
|---|---|---|---|---|
| **1** | `role` slice (`role: Role`, persisted `statdash.role`, default `'author'`) + `useRole()` selector (the single reader) | react-specialist | — | ∥ start |
| **2** | Top-bar "Model mode" toggle + `⌘K` command ("Enter Model mode / Return to Compose") | react-specialist | 1 | after 1 |
| **3** | Rail: filter `RAIL_ENTRIES` by lens; drop `locked` on `model`, gate visibility on `useRole()`; `ActivityRail` renders the filtered set | react-specialist | 1 | ∥ with 2 |
| **4** | `StudioShell` left-dock dispatch: add the `model` case (mounts the Model surface shell) | react-specialist | 3 | after 3 |
| **5** | `FF-ROLE-IS-LENS` (role read only via `useRole()`; Model is the only role-gated surface; no auth/tenant/user branch) + document the auth-claim binding seam | react-specialist | 1–4 | after 4 |
| **6** | Relocate `DataModelingPanel` into the Model surface; **remove** the Data-surface "Advanced" `Accordion` | react-specialist | 4 | after 4 |
| **7** | `FF-AUTHOR-NO-QUERY` (no `DataSpecEditor`/query/pivot editor reachable from any author-lens surface) | react-specialist | 6 | after 6 |
| **8** | `semanticCatalog` store slice (`{metrics, dimensions}`) hydrated from `fetchCatalogManifest()` at boot | react-specialist / plugins-specialist | — | ∥ (after M2.0) |
| **9** | Metric list (Model mode) — browse the catalog, select to edit, "new metric" | plugins-specialist / react-specialist | 8 | after 8 |
| **10** | **Metric Editor**: dataset picker (`cubeApi.datasets`) → measure picker (`cubeApi.profile.measures`, unit pre-fill) → governance form (reuse `LocaleString` editor + enum pickers), immutable id | plugins-specialist / senior-frontend | 9 | after 9 |
| **11** | Boundary validation: authored `MetricDef` validated against the live cube profile (code/dims/members real) before enabling save | plugins-specialist | 10 | after 10 |
| **12** | `saveSemanticCatalog()` action (`PUT /api/config/site {metrics,dimensions}`) + live `registerManifest*` re-register after save | react-specialist | 8,10 | after 10 |
| **13** | `FF-CATALOG-EDIT-SAFE` + `FF-METRIC-AUTHORING-SERIALIZABLE` + `FF-CATALOG-ONE-SSOT` + `FF-ID-IMMUTABLE` | plugins-specialist / react-specialist | 10–12 | after 12 |
| **14** | Impact preview (reverse index over page configs' `measure` refs) + delete-guard | react-specialist | 9,12 | after 12 |
| **15** | *(optional)* Server-side validator on the `metrics`/`dimensions` PUT keys (additive, api-only) | api-specialist | 12 | ∥ after 12 |
| **16** | Dimension curation editor (label · conceptRole · defaultMember · whitelist over a cube dim) → same `saveSemanticCatalog()` | plugins-specialist / react-specialist | 10,12 | after 12 (droppable) |

**Critical path:** 1→3→4 (lens + Model surface) → 6 (relocate modeler) → 8→9→10→11→12 (Metric Editor + save) → 13/14 (FFs + integrity). **Parallel lanes:** 2 ∥ 3 (toggle vs rail); 8 forks early (catalog slice) and rejoins at 9; 15 (server validator) ∥ the editor lane; 16 (dimensions) forks after 12 and is droppable. **M2.0 (1–5)** is a self-contained mergeable unit; the modeler relocation (6–7) and the editor lane (8–16) fork after it.

---

## 11. Rejected alternatives (ADR discipline — ≥2)

- **(a) Build real RBAC / a users-and-roles system to gate Model mode.** **Rejected.** Single-tenant-first: the panel is already authenticated; a role *permission* system (user table, role claims, per-object ACLs) is scope the owner deferred (AR-30 MT posture). The lens delivers the *audience separation* the milestone needs; the enforcement seam is **preserved** (`useRole()` swappable to an auth claim), not built. Building RBAC now = solving a problem no current stakeholder has (YAGNI) and forking into MT prematurely.
- **(b) Store the authored catalog in a new relational `config.metric`/`config.dimension` table.** **Rejected for M2** (kept as an AR-47 future). It contradicts the committed M0 decision (the catalog is one `site_config` SSOT, not publish-versioned), forces a DB migration + a new api resource + a second delivery channel (SSOT/DRY violation), and buys per-metric versioning/audit that **AR-47** owns — not M2. The blob path is additive, zero-migration, and already the delivery SSOT. Named as an **expand-contract migration** for AR-47 (§14), not a symptom-patch now.
- **(c) Ship the calc/measure-algebra editor in M2.** **Rejected as scope** (§4.4). A visual safe-expression builder is a substantial surface; base-metric authoring covers the vast majority of governed nouns at high polish. The calc *runtime* is already live and the seed can still carry calc metrics — so deferring the *editor* loses no capability, only in-tool convenience for derived metrics. Defer to M2.5/M3.
- **(d) Keep the raw modeler on the author's Data surface (just hide it better).** **Rejected.** It leaves the query cliff reachable from the compose path — the exact root the whole AR-49 vision targets. The vision's `FF-AUTHOR-NO-QUERY` demands the query editors be *unreachable* from the author lens; a nicer disclosure is a symptom patch (Law 6). Relocate, don't re-hide.
- **(e) Make Model mode a separate route/app (Superset-style tool split).** **Rejected** (held from M1). Splitting the tool by artifact is the wizard's sin at a different grain; Model is a **lens over the same live canvas**, so the steward sees the dashboard react as they define (the Power-BI-but-better call, §1).

---

## 12. Fitness functions (invariants → executable, not prose)

- **FF-ROLE-IS-LENS** — the `Role` value is read **only** through `useRole()`; the `Model` surface is the **only** role-gated surface, and it gates on the lens value, **never** on an auth/tenant/user primitive (grep-guard: no component reads a JWT claim / tenant id to decide UI in M2). Locks "lens, not RBAC."
- **FF-AUTHOR-NO-QUERY** — no `DataSpecEditor` / query / pivot / transform editor is reachable from any **author-lens** surface (the Data surface renders only the Metric Palette). The vision's promise, now enforced.
- **FF-CATALOG-EDIT-SAFE** — an authored `MetricDef` **validates against its live cube profile** (code is a real measure; every default-dims key/member is real) before it can be persisted; a governance edit lowers through the **one** `resolveMeasureRef` seam (no second resolution path).
- **FF-METRIC-AUTHORING-SERIALIZABLE** — an authored metric is pure JSON (no function/`fetch`/expr-as-code, Law 2); a saved catalog round-trips `site_config → /api/bootstrap → registerManifest*` **byte-identically** (the *define*-side sibling of M0's `FF-BIND-PARITY`).
- **FF-CATALOG-ONE-SSOT** — the authoring store, the delivery manifest, and the runner registry all read the **same** `site_config.metrics`/`dimensions` catalog; there is no second catalog store (a re-declaration would be the drift the FF forbids).
- **FF-ID-IMMUTABLE** — the Metric Editor cannot mutate an existing metric's `id` (only its `label`); identity changes go through explicit add-new (expand-contract), so stored `measure` refs never dangle.

---

## 13. Definition of done (M2)

A trusted operator flips **"Model mode"** in the top bar (a persisted lens, default off) and the **`Model` rail entry unlocks** over the *same live canvas*. In Model mode they **define a governed metric** by picking a dataset and a real SDMX measure (its resolved unit pre-fills), setting a bilingual label · format · aggregation · default-dims · methodology, and **saving** — whereupon the metric persists to `site_config.metrics`, is delivered through the unchanged `/api/bootstrap → registerManifestMetrics` pipeline, and **appears in the Author's Metric Palette without a reload**, byte-identical to a provisioned metric. The raw source/spec/query modeler **no longer appears on the Author's Data surface** (which is now the Metric Palette only — `FF-AUTHOR-NO-QUERY` bites); it lives in Model mode as the steward's escape hatch. Editing a metric's governance shows the **blast radius** ("N blocks reference this") before committing; an invalid metric **cannot be saved** (validated against the cube profile); an existing metric's **id is immutable**; a referenced metric **cannot be deleted** out from under its consumers. The **dependency arrow is unchanged**, `packages/` is untouched, no contracts change was needed, and the **auth-binding seam is preserved (documented) but not built** — the lens remains swappable to a real claim when multi-user RBAC is actually required.

---

## 14. One-way-door decisions needing the owner's explicit call

1. **Persistence SSOT of the authored catalog — BLOB now vs relational table later.** *Recommendation: keep the `site_config.metrics`/`dimensions` JSON blob* (additive, zero-migration, already the M0 delivery SSOT). Name the migration to a relational `config.metric`/`config.dimension` store (per-metric versioning/audit/concurrency) as an **AR-47 expand-contract future**, not M2. **Owner call because it touches persistence/schema.** If the owner wants per-metric audit/history *now*, that promotes AR-47 ahead of the rest of M2.
2. **Role source — persisted local preference now, auth claim later.** *Recommendation: build the lens as a local preference; preserve (don't build) the auth-claim binding.* The honest caveat: the lens is **not an enforcement boundary** until the claim binds — a user can flip it. **Owner call because it touches the auth seam** (bless "lens now, RBAC later," matching AR-30's MT posture).
3. **Calc/measure-algebra editor — deferred.** *Recommendation: DEFER to M2.5/M3.* The calc *runtime* is live; only the in-tool authoring UI waits. **Confirm the deferral** (no capability lost — the seed can still carry calc metrics as JSON).
4. **Provisioning re-run posture.** *Recommendation: make provisioning's `metrics`/`dimensions` keys seed-if-absent* so a re-provision does not clobber tool-authored metrics. Minor; **owner should be aware** that provisioning becomes a one-time seed once the tool owns the catalog.

---

## Appendix — relationship to registered architectures

- **Completes (vision M2 scope):** define-vs-curate as a **role** (the Steward lens + Model mode); relocate the query/pivot/cube modeler behind the steward; in-tool metric authoring (the "define" half).
- **Consumes / rides (all already in code):** AR-40 (`MetricDef`/`DimensionDef`/`resolveMeasureRef`/`registerManifest*`/`metric-calc` — the whole semantic engine), M0 (Metric Palette, `FF-BIND-PARITY`), M1 (the Studio shell, the `Model🔒` slot, the shared `DataModelingPanel`), AR-10 (PropSchema controls reused for the governance form), the existing `PUT /api/config/site` + `GET /api/bootstrap` delivery seams, `cubeApi.profile` (raw-measure introspection).
- **Seeds / sets up:** AR-47 (authoring governance — M2 seeds the versioning discipline via immutable id + impact preview; the relational per-metric store is AR-47's expand-contract future), M2.5/M3 (the calc/measure-algebra editor), the future auth-claim binding of `useRole()`.
- **Refuses to disturb:** the dependency arrow (M2 is apps-only), Config = SSOT (an authored metric is pure JSON), Law 2 (no function/expr-as-code in a metric), Law 5 (`fromSDMX`-only — the steward defines over a cube profile, never a warehouse; Cube/Malloy-the-runtime still refused), AR-30 (MT deferred — the role is a lens, not a tenant), the M0 catalog-is-one-`site_config`-SSOT decision.
