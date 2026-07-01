# HUNT — Future-Vantage / Capability-Model audit

> READ-ONLY senior audit. No product code touched. Lens: *see from the future's vantage — design so what we build is used maximally, everywhere, and open the seams for it today.*
> Author: platform-architect (Opus). Date: 2026-07-01 · Branch: `feat/tenant-agnostic-platform`.
> Method: every prior finding re-verified against **live source** (file:line), not the frozen CLOSE-BOARD snapshot. Multi-tenancy **build** is owner-deferred — this audit designs *toward* the future and checks *seams aren't foreclosed*, it does not order the MT build.

---

## 0. What changed since CLOSE-BOARD (2026-06-28) — the board is partly stale

The tree has advanced. Re-verified this pass:

| CLOSE-BOARD claim | Live truth (file:line) | Consequence for this audit |
|---|---|---|
| TM-STRANGLER "RATIFIED, UNBUILT"; fused-mode literal survives at `template.ts:74-75` | **RETIRED.** `template.ts:86-94` is a generic `PerspectiveCarrier` collapse — no `'year'`/`'range'` literal, no arm-count; locked by `core/src/config/no-mode-literal.fitness.test.ts` | Time-mode is **done**. The perspective spine is a clean `Record<param,string>` — the lattice's foundation is *already load-bearing*. |
| EXP-01 cross-filter/drill "PARTIAL, authoring not delivered" | **Runtime BUILT.** `links/types.ts` (`FilterDataLink`), `links/resolver.ts:76-80` (filter branch), `packages/react/src/engine/crossFilter.test.ts`, `plugins/panels/chart/default/useChartInteractions.ts` | The *runtime* capability ships. The gap is **authoring** — see S2/Seam-3. |
| ADR-0031 ingestion "build-ready" (proposed) | **BUILT.** `apps/api/src/ingest/canonical/{parse,compat,registry,ops}.ts` + e2e; provenance landed (`submit.ts` + `submit.provenance.test.ts`) | Serializer/RuleSpec/PROV seams are **real and open**, not aspirational. |
| Serializer port (North-Star #A) | **OPEN, json-only.** `routes/stats/serialize/registry.ts:107` registers only `json`; `:52-61` reserves 6 formats behind the `?format=` dispatch | The exemplar of correct future-proofing (see S4). |
| AgencyScheme (DB-08 / MT-1) | **STILL UNBUILT.** `stats.agency` / `agency_scheme` appear **only** in `work/*.md` design docs — zero code/migration | The one keystone seam that is *closed and expensive-to-retrofit-late* (Seam-1). |

**Net:** the planned roadmap is ~80% built and fitness-locked. The remaining future-facing work is **not more features** — it is (a) one identity keystone that everything compounds on, (b) closing the authoring↔runtime capability gap so the Constructor moat is *complete*, and (c) resisting the temptation to build the reserved ports before a real consumer.

---

## 1. Capability roadmap — ranked by (future-need × compounding-leverage ÷ effort)

Each row: capability | why the future needs it | seam open today? (file:line) | build-now / open-seam-now / YAGNI-defer | the real consumer that justifies it.

### S1 — AgencyScheme as identity SSOT (`stats.agency` + FK indirection)  ·  **BUILD NOW**
- **Why the future needs it:** `agency` is the platform's structural-ownership identity (SDMX maintenance agency = the owner of every DSD/codelist/dataflow). It is the SSOT that per-agency rollups, tenant RBAC, provenance-agent identity, governance, and (owner-deferred) multi-tenancy **all** ride. It is also the single most expensive thing to retrofit late — a `tenant_id`/`agency_id` FK threaded through a feature-laden cube is the most invasive change a data platform can make.
- **Seam open today?** **NO.** `agency TEXT NOT NULL DEFAULT 'SDMX'` is repeated free-text on V27/V29/V31 + `stats.dataset.source`; there is no `stats.agency` table (grep: only in `work/*.md`). The model "names agency everywhere and stores it nowhere."
- **Verdict:** **build-now** — but justified by a *today* consumer, not by MT. The free-text `agency` columns are an unmodeled SSOT **right now** (DB-08). Model `stats.agency(id, code, name i18n, parent)` + repoint the free-text columns by expand-contract. Because tenancy (when the owner greenlights it) binds `tenant_id → agency.id` through an FK indirection, building this on SSOT grounds **incidentally keeps the MT door open without designing the MT build** (Protected Variations — the variation point "is agency also a tenant?" sits behind a stable FK).
- **Real consumer:** the 4 free-text `agency` columns + reference-metadata (V31) agency attribution — live today.

### S2 — Schema-driven authoring parity (`describeApp()` → `PropSchemaForm`)  ·  **OPEN SEAM NOW**
- **Why the future needs it:** the Constructor moat is only real if it can author **everything the runner renders**. Today authoring is hand-coded per feature (`SectionEdit.tsx`, the react-admin forms). Every new node/link/interaction capability then needs a *hand-written editor* — Shotgun Surgery, and the exact failure that lets a capability ship in the runtime but never reach the palette. The future demand is *capability-authoring parity as an invariant*: register a capability → its editor is generated.
- **Seam open today?** **PARTIAL/published-but-unconsumed.** `PropSchemaForm` (`engine/react/src/components/PropSchemaForm.tsx`), `describeApp()`, `propSchemaToJsonSchema` exist and are tested but have **no production consumer** (per the deferred-seams inventory). The introspection spine is built; nothing rides it.
- **Verdict:** **open-seam-now** via Strangler-Fig — migrate **one** hardcoded editor to `nodeRegistry.getSchema(type) → PropSchemaForm`, proving the loop, then convert the rest one at a time. Cheap now (the form renderer exists); expensive later (N hand-coded editors diverge, and capability-invisibility becomes structural).
- **Real consumer:** the shipped-but-unauthorable cross-filter/drill runtime (S2's concrete instance = Seam-3) is a live capability with no editor **today** — that is the real driver, not speculation.

### S3 — Perspective Lattice (N orthogonal axes → 2^N permalink views)  ·  **BUILD WITH A CONSUMER**
- **Why the future needs it:** this is the crown — the compounding payoff of the generic `perspectiveState` spine. Vintage/revision, geo-mode, seasonal-adjustment, unit-basis all become *axes*, and their product is addressable permalink state with zero new machinery.
- **Seam open today?** **YES, and clean.** `perspective-state.ts::activePerspective` + `ctx.perspectiveState: Record<param,string>` is Law-1-generic (param name is data). `_geoMode` (`geostat.provisioning.json:4678`) is already a latent derived axis; vintage provenance (V25) and reference-metadata (V31) exist as candidate axes.
- **Verdict:** **build WITH a real second consumer** — a **vintage/revision toggle** is the honest justifying consumer (the provenance data exists; "GDP as published 2024-Q3 vs latest" is a genuine statistical need). Promote `_geoMode` to the first *declared multi-member* axis at the same time. Building the lattice *speculatively*, without the vintage consumer, makes it **adoption-debt itself** — the crown that no one wears.
- **Real consumer:** vintage/revision comparison (spec the consumer first, then build the generic lattice under it).

### S4 — SDMX-REST serve + ecosystem serializers (sdmx-json / sdmx-csv / qb-turtle / datapackage / parquet / prov)  ·  **YAGNI-DEFER (seam already open)**
- **Why the future needs it:** becoming a *producer* in the official-statistics ecosystem (not just a consumer) is the platform's outward moat — one `?format=` port unlocks six interop capabilities.
- **Seam open today?** **YES.** `routes/stats/serialize/registry.ts` + `dispatch.ts` — one registration adds a format, routes unchanged; unknown format fails-closed with RFC-9457. This is *textbook* future-proofing.
- **Verdict:** **YAGNI-defer — do NOT build a serializer speculatively.** The seam being open is the whole win; adding `sdmx-csv` the day a consumer asks is a bounded, additive change. **One-way-door caveat:** the *first public mint* commits agency+version identity — decide that identity scheme once (reuse V27/V29/V31 artefact identity + S1's AgencyScheme), before registering any non-json format.
- **Real consumer:** the first external/ecosystem client or a second front-end needing structure messages. None today.

### S5 — VTL / RuleSpec engine (validation-and-transformation as data)  ·  **YAGNI-DEFER (port reserved)**
- **Why the future needs it:** extends the declarative moat to data-quality — curator-authored, .Stat-portable rules.
- **Seam open today?** **YES.** `runRules(rules, rows, ctx)` port + 3 DQAF rule kinds shipped as data (ADR-0031 wave 2a). VTL engine reserved behind the port.
- **Verdict:** **YAGNI-defer.** Trigger: the second integrity rule a *non-programmer curator* must author, or a rule that must round-trip with .Stat. Until then the port + 3 built-in kinds are correct and complete.

### S6 — Sub-annual grain (G4 threading, G5 cross-grain blend, G6 rollup-router)  ·  **YAGNI-DEFER (data-gated)**
- **Why the future needs it:** quarterly/monthly series are inevitable for a national-accounts platform.
- **Seam open today?** **PARTIAL.** The port (`valAt`, `point-series`, `grain.ts`, `StoreCaps.grains`) exists; `time-dimension.ts:124` does not yet thread `granularity` at the resolve seam.
- **Verdict:** **YAGNI-defer, data-gated.** No sub-annual dataset exists. G4 (thread the field, S-M) is worth doing the day a quarterly dataset lands; G5/G6 wait for a *real* cross-grain blend. Building the router now = speculative generality.

### S7 — Full ESMS/SIMS metadata tree + ESQRS/DQAF quality reports  ·  **YAGNI-DEFER (seam reserved)**
- **Seam open today?** **YES.** V31 `metadataflow_code` FK is the reserved seam for the predicate-row attribute engine. ESMS-*lite* (the badge) ships.
- **Verdict:** **YAGNI-defer.** Trigger: a metadata *panel/consumer* or SDMX-RM export. No consumer today (V31's own note). The full 21-concept tree is a cathedral until someone worships in it.

---

## 2. The ≤3 seams to open NOW (cheap now, expensive later) — with the pattern

### Seam-1 · AgencyScheme identity SSOT — *pattern: Single Source of Truth + Protected Variations (FK indirection)*
- **Where:** `ops/postgres/migrations/*` (new `stats.agency_scheme` + `stats.agency`); free-text `agency` on V27/V29/V31 + `stats.dataset.source` repoint by expand-contract.
- **Why now:** cheapest it will ever be (new tables = two-way door); most expensive change to make late (an FK threaded through the whole cube). It closes a **live** SSOT gap (DB-08) independent of tenancy, and the FK indirection means the future "agency == tenant?" decision stays swappable — the MT door stays open **without building MT**.
- **Fitness:** an introspection gate that no `stats.*` artefact carries a free-text agency once the FK exists (expand→contract completion check).

### Seam-2 · Schema-driven authoring parity — *pattern: Capability Discovery + Strategy/Registry (introspection → generated form)*
- **Where:** `apps/panel` — migrate one hardcoded editor (`SectionEdit.tsx`) to `nodeRegistry.getSchema(type) → PropSchemaForm` (`engine/react/src/components/PropSchemaForm.tsx`, published-but-unconsumed).
- **Why now:** the form renderer + `describeApp()` introspection already exist; wiring the first consumer is cheap. Deferring it means every future capability hand-codes an editor (Shotgun Surgery) and capabilities silently ship un-authorable — the moat erodes invisibly.
- **Fitness:** a parity test — for every registered node type with a `PropSchema`, the Constructor renders a form (no hand-coded editor required); a new registered type is authorable with zero panel edits.

### Seam-3 · Expose the live cross-filter/drill capability in the palette — *pattern: capability-authoring parity (the concrete instance of Seam-2)*
- **Where:** `apps/panel` has **no** DataLink editor (grep: `dataLink` appears only in `canvas/walkNodes.ts` traversal), yet the runtime is fully built (`links/resolver.ts`, `crossFilter.test.ts`, `useChartInteractions.ts`).
- **Why now:** this is the mirror-image of the `panels/map` stub — there a dead node is *visible*; here a **live** capability is *invisible* to the Constructor. A shipped runtime capability with no authoring surface is un-adopted power. Cheap now (a `DataLinkDef` is a small discriminated union → one PropSchema-driven editor once Seam-2 lands); expensive later as more interaction capabilities pile up unauthorable.
- **Fitness:** a Constructor test that authors a `FilterDataLink` and round-trips it losslessly to JSON (the §12 lossless-round-trip invariant, applied to interactions).

*(Seam-3 is deliberately the concrete first payload of Seam-2 — do them together: prove the schema-driven loop by making the already-shipped cross-filter capability authorable.)*

---

## 3. Gold-plating ledger — tempting, but YAGNI until a real driver

Honest "do NOT build yet" list. Each seam is open or reserved; building the *capability* before its consumer is adoption-debt.

| Tempting build | Seam state | Real trigger (absent today) | Verdict |
|---|---|---|---|
| SDMX-REST / RDF-cube / Parquet / DataPackage serializers | port open (json-only) | first ecosystem/2nd-frontend consumer | **defer** — the open seam *is* the deliverable |
| VTL 2.1 engine | RuleSpec port + 3 kinds shipped | curator-authored rule / .Stat round-trip | **defer** |
| Grain G5/G6 cross-grain blend + rollup-router | port partial | a real sub-annual dataset | **defer (data-gated)** — G4 field-thread only when quarterly lands |
| Full ESMS/SIMS 21-concept tree + ESQRS/DQAF reports | `metadataflow_code` reserved | a metadata panel/consumer or SDMX-RM export | **defer** |
| Statistical disclosure control / cell suppression (τ-ARGUS class) | V26 predicate-rows + OBS_STATUS='c' latent | a confidential micro-dataset | **defer** — national-accounts aggregates non-sensitive; reserve nothing |
| DOI/PID minting per vintage | `release` UUID is citable-ready | external citation/publication requirement | **defer** (one-way door on first mint) |
| **Perspective Lattice built without the vintage consumer** | spine open+clean | a vintage/revision (or 2nd real) axis consumer | **defer the BUILD** — spec the consumer first, or the crown is adoption-debt |
| MT-2 → MT-7 full multi-tenancy build | V6 `USING(true)` placeholder only | owner sign-off (explicitly deferred) | **do NOT build** — only keep the door open via Seam-1 |
| Dynamic plugin loading / module federation | compiled-in microkernel | a tenant needing a non-catalog node | **defer** (rejected in bootstrap ADR) |

---

## 4. The compounding order (why this sequence, each unlock enabling the next)

1. **Seam-1 (AgencyScheme SSOT)** first — it is the identity keystone every downstream capability (per-agency rollups, tenant RBAC, provenance agent, governance, MT-when-greenlit) resolves through. Cheap, two-way, justified today. *Compounds: unblocks 5+ deferred capabilities the day each trigger fires.*
2. **Seam-2 + Seam-3 (authoring parity)** next — completes the Constructor moat so *every* future capability (S3 lattice, S4 serializer authoring, new nodes) reaches the palette *for free* instead of via a hand-coded editor each time. *Compounds: every future node/link ships authorable by default.*
3. **S3 (lattice) with a vintage consumer** — the crown, built only once its consumer is specified; rides the now-complete authoring loop and the clean `perspectiveState` spine.
4. **S4–S7 stay reserved** — their seams are open; each is a bounded additive registration the day a consumer arrives. The discipline is to *not* build them early: the platform's maturity is proven by how many capabilities sit correctly behind open seams, un-built, awaiting a real driver.

**The thesis, restated from the future's vantage:** this platform already did the hard neutral work (config-is-data, registry-everywhere, boundary-scope for locale/perspective/tenant, ports for serialize/rules/query). The future-facing job is **not to build more** — it is to (a) lay the one identity keystone that everything compounds on (Seam-1), (b) make the Constructor able to author 100% of what the runner renders (Seam-2/3), and (c) hold the line on YAGNI so the six open ports stay open until a real consumer walks through — because a seam held open cheaply is worth more than a capability built early and unused.
</content>
</invoke>
