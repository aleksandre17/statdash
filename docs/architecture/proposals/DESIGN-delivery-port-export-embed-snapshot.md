# DESIGN — Delivery Port (Export · Embed · Snapshot) — AR-48

> **Decision doc for the owner.** How statdash makes any section **citable** (CSV/Excel/image), any card **embeddable** (signed iframe), and any view a **frozen, reproducible snapshot** — at the Eurostat/World-Bank/OWID/Datawrapper/Grafana standard, as **one delivery capability**, not a per-panel bolt-on.
> Scope: the headless delivery boundary of the public runner (`apps/geostat` + `apps/api` + the engine render-targets). Non-MT (AR-30), static-runner-preserving (AR-28), config-stays-data (Law 2).
> _Author: platform-architect (Opus). Date: 2026-07-08. Registry: AR-48._

---

## 0. TL;DR — the headline the code forced

**AR-48 is NOT greenfield. The delivery *backend* is already ~80% built to reference grade — the benchmark's "export = STUB, no embed/snapshot" is STALE.** What actually exists, verified in code:

| Facet | State in code | Evidence |
|---|---|---|
| **Data export** (CSV/BOM · XLSX/OOXML · SDMX-JSON) | **Reference-grade, LIVE in UI** | `core/data/export/` (OCP registry + 3 serializers); `react/…/downloadExport.ts`; `EXPORT_MENU` DI; `data:export` command; `NodeExportContext` per-section publish/subscribe; WAI-ARIA menu |
| **Snapshot serialization** (data + static HTML) | **Built, pure engine** | `react/engine/targets/api.ts` `renderPageToJSON` (rich `PageDataSnapshot`, pins resolved frames); `targets/html.tsx` `renderPageToHTML` (`RenderTarget = dom\|html\|pdf\|api`) |
| **Snapshot persistence** (durable) | **Built** | `SnapshotStore` port (in-mem LRU + `createPgSnapshotStore`); `config.snapshot` table (migration **V36**); `SnapshotEnvelope` boundary contract in `@statdash/contracts` |
| **Embed delivery** (mint + public read) | **Built + mounted** | `/api/snapshots` (JWT + **audit-logged** mint → signed URL); `/api/embed/:token?sig=` (public, **HMAC-SHA256**, 403→404→410 lifecycle); `EMBED_SECRET` production gate; same-origin CORS posture — mounted in `apps/api/src/index.ts` |
| **Permalink** (URL = view SSOT) | **Reference-grade, LIVE** | `SharePermalinkButton` (secure + HTTP-fallback copy) via `SECTION_HEADER_ACTIONS`; `useSearchParams` |

**So the real AR-48 is not "build export/embed/snapshot" — it is: (1) NAME the unifying port the three subsystems already imply, (2) WIRE the embed/snapshot backend to the client (it is a fully-built but *entirely unconsumed* seam — `renderPageToJSON` is called only from tests; geostat has zero embed/mint/render code), (3) COMPLETE three genuine facet gaps: image export (PNG/SVG), provenance-on-export, and card-scoping.**

**Recommendation:** adopt the **Delivery Port** model below (§2) — snapshot as the SSOT, extract/embed/permalink as adapters over it — then execute the 5-phase Strangler (§6) that is *mostly wiring + completion*, not construction. This is a high-leverage, low-risk mission win: the hard, risky parts (durable store, HMAC, audit, pure render targets) are already green.

---

## 1. Observation Duty — what I found en route (surface, don't walk past)

1. **STALE DOC / mis-scored benchmark (fix immediately).** `plugins/CLAUDE.md` says *"Excel + CSV per section — now: stub"* and benchmark row #14 scores us **Lag/"export = STUB, no embed/snapshot."** Both are wrong: export is reference-grade and the embed/snapshot backend is built. **Real severity = "full backend port, UNWIRED client + 3 missing facets (image/provenance/card-scope)."** The `export/index.ts` barrel comment already anticipates `png/svg` as app-layer formats. *P0 corrects both notes.*
2. **A large published-but-unconsumed seam (dark code risk).** The entire embed/snapshot backend — routes, pg store, V36, HMAC, audit, prod-secret gate, `renderPageToJSON`/`renderPageToHTML` — was built *ahead of any consumer*. Excellent seam hygiene (matches how MT/SSG are "deferred-but-seamed"), but until wired it is **dark code that will bit-rot**. AR-48 is precisely its activation trigger. This is the single biggest finding: the value is in *wiring*, and the wiring is cheap because the seam is clean.
3. **Two paths to "the rows" — no SSOT yet.** The live export path (`SectionExportMenu` → `readActive()` → `ctx.rows`) and the snapshot path (`renderPageToJSON` → `interpretSpec` re-resolve) each independently answer *"what data is on screen?"*. They agree today (both honour the active-view gate) but are **not one source**. The port unifies them: the snapshot is the SSOT; extract serializes *from the snapshot*, not from a second read.
4. **Snapshot pins DATA but not PROVENANCE — a reproducibility half-measure.** `PageDataSnapshot` freezes resolved frames but carries no `source/vintage/methodology`. A frozen NSO number without its vintage is not fully citable. The `ReferenceMetadataContract` + engine `ProvenanceRecord`/`MetadataPort` already exist — the port must join them into the snapshot (P1).
5. **Embed is PAGE-scoped; the mission wants CARD-scoped.** `renderPageToJSON` walks the whole page; `EmbedParams` has `allowedDims`/`expiresAt` but **no node scope**. An "embeddable single card" needs a `scope: { nodeId }` on the snapshot (P2).

---

## 2. The capability model — ONE port, three facets over one SSOT

The mission says "export/embed/snapshot as facets of one port." The code already implies the shape; name it:

```
                         ┌──────────────────────────────────────────┐
   VIEW STATE  ───────►  │  ViewSnapshot  (the SSOT)                 │
   (permalink /url)      │  = configRef  (pageId + schemaVersion)    │
   RESOLVED DATA ──────► │  + viewState  (filterParams·perspective· │
   (renderPageToJSON)    │               locale·theme·SCOPE nodeId)  │
   PROVENANCE ─────────► │  + data?      (pinned frames | absent=live)│
   (reference-metadata)  │  + provenance (source·vintage·methodology)│
                         │  + generatedAt                            │
                         └───────────────┬──────────────────────────┘
                                         │  ONE serialization; everything below is an ADAPTER
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                 ▼
   EXTRACT facet                    EMBED facet                      PERMALINK facet
   snapshot(scope) → format         snapshot → persist → sign →      viewState → URL
   .serialize → bytes → download    signed iframe → headless render  (lossless, exists)
   (CSV·XLSX·SDMX-JSON·PNG·SVG)     (public HMAC read, scoped)        the "share the LIVE view"
   "cite this table / image"        "embed this card on a news site"  leg of the same port
```

**Why this is the right decomposition (not three siblings):** the three facets are not parallel — they **compose over one substrate**. *Snapshot* is the frozen `ViewSnapshot`. *Embed* = snapshot + signed delivery + headless single-scope render. *Extract* = `serialize(snapshot(scope), format)`. *Permalink* = the un-frozen state leg (re-fetch on open). Collapsing them onto one `ViewSnapshot` SSOT is the SSOT law made concrete and kills finding #3's dual-path.

**Patterns:** Port/Adapter (the delivery boundary; adapters = extract/embed/permalink) · **Command** (`data:export`; add `deliver:embed`) · **Registry/OCP** (export formats — image = a new registered format, engine interface unchanged) · **Memento** (the snapshot freezes view-state) · **Anti-Corruption Layer** (`SnapshotEnvelope` — api stores opaquely, reads only `generatedAt`, already in place). The port is a *capability*, surfaced once in chrome — never a per-panel button (the explicit anti-pattern, §7.1).

---

## 3. Where each seam lives across the arrow (Law 3)

`contracts ← expr ← core ← charts ← react ← plugins ← apps/*` (and `contracts ← apps/api`).

| Concern | Layer | Status | Note |
|---|---|---|---|
| `SnapshotEnvelope`, `ViewSnapshot` shape, `EmbedParams` (+`scope.nodeId`), provenance projection (`ReferenceMetadataContract`) | **contracts** | exists; extend | zero-dep boundary; the api may import it, `react` may too |
| Export registry + **data** serializers (csv/xlsx/sdmx-json); `ExportMeta` (+`provenance`); pure `provenanceFooter()` | **core** (`@statdash/engine`) | exists; extend `ExportMeta` | stays **DOM-free & pure** — image cannot live here (needs the rendered chart) |
| Snapshot builder (`renderPageToJSON` + `renderPageToHTML`), `downloadExport`, the DeliveryMenu host hook, mint client, embed render-target (+node-scope), **image capture** formats (png/svg) registered here | **react** (adapter) | mostly exists; add scope + image + mint client | image = app/adapter-layer `registerExport('png', …)` over ApexCharts `dataURI()` — OCP, no engine change |
| `DeliveryMenu` surfaced in section header (generalize `ExportMenu` → export + copy-link + "Get embed code"); per-panel image-capture ref | **plugins** | `ExportMenu`/`SectionExportMenu` exist | one control cluster, section-scoped (Law 9) |
| Embed mint (`/api/snapshots`) + public read (`/api/embed/:token?sig`), pg persistence, HMAC, audit, expiry; **provenance join** at mint | **apps/api** | exists; add provenance join + node-scope passthrough | already mounted; `reference-metadata` route already serves the join source |
| The embed **render route** `/embed/:token` (fetch → `renderPageToHTML` scoped → hydrate), the mint **action** wiring, PNG/SVG **format registration** (app-layer per the barrel note), embed-code copy UI | **apps/geostat** | **MISSING (the wiring gap)** | the outermost runner is where image formats + the headless embed page belong |

**The arrow holds cleanly:** image capture is DOM-bound so it registers at the react/app layer *into* the core registry (OCP) — core never imports the DOM. The api imports only `@statdash/contracts` (never `react`). Nothing new fights the arrow.

---

## 4. Data + integrity-metadata flow (the NSO credibility leg)

An exported/embedded artifact from a national statistics office MUST carry its provenance or it is not citable (Law 9; INTEL). The pieces exist and only need joining:

```
DB stats.reference_metadata (SCD-2 vintage)
   → GET /api/stats/datasets/:code/metadata  → ReferenceMetadataContract (i18n, ESMS-lite)
   → runner store-build → engine ProvenanceRecord (MetadataPort, resolved to locale)
   ─────────────────────────────────────────────────────────────────────────────────
   AR-48 join points:
   • EXTRACT: ExportMeta.provenance = { source, lastUpdated, methodologyUrl, permalink, accessedAt }
              → csv: a commented provenance footer;  xlsx: a "Metadata" sheet;  png/svg: a caption band
   • SNAPSHOT/EMBED: ViewSnapshot.provenance folded at MINT time (api joins reference-metadata by the
              datasets the snapshot's frames reference) → frozen WITH its vintage → reproducible citation
```

**Invariant (→ fitness function):** every delivered artifact whose data references a dataset that *has* a metadata report carries `source` + `lastUpdated` + a methodology link + the permalink. Degrade gracefully (Postel) when no report exists — never block delivery, but never silently ship an unattributed NSO number.

## 4b. Snapshot serialization & reproducibility model

`ViewSnapshot` is the Memento. Two modes over the **same** shape:

- **PINNED (default)** — `data` = the resolved frames frozen at mint. Reproducible, survives data revision, is the citation/embed artifact. This is the OWID/Datawrapper/Grafana-snapshot standard: *what you cited is what renders forever.* `renderPageToJSON` already produces this.
- **LIVE (opt-in)** — `data` absent; the snapshot stores only `configRef` + `viewState`; the embed route re-resolves via `interpretSpec` on open (always-current dashboards). Same substrate, one flag.

Reproducibility rests on the two fitness functions AR-28 already defined and this port depends on: **`FF-RENDERER-ISOMORPHIC`** (embed render runs headless in Node/nginx, no `window` at module load) and **`FF-RENDER-DETERMINISTIC`** (same snapshot ⇒ same output). AR-48 is a *second consumer* of those seams — which retroactively justifies them.

---

## 5. Rejected alternatives (ADR-style, ≥3)

1. **Per-panel bespoke export/embed button.** REJECTED — the mission's named anti-pattern. Shotgun surgery (every panel grows delivery UI), N inconsistent controls, no SSOT, no reuse. The port is ONE capability surfaced once per scope (section header), consistent everywhere.
2. **Server-side headless-browser render (Puppeteer / Grafana image-renderer) as the baseline for image + snapshot.** REJECTED as baseline — a live Node+Chromium tier breaks the static-runner north-star (AR-28) and duplicates the pure render engine we already have. Use **client-side capture** (ApexCharts native `dataURI()`, leaflet canvas) + pinned-data snapshots (static HTML on the same nginx). Keep Puppeteer as a deferred escalation *only* if server-side high-fidelity PNG becomes a real, stated requirement (mirrors AR-28's R4 gate).
3. **Store only the live URL for snapshots/citations (no data pinning) as the DEFAULT.** REJECTED as default — a citation that silently changes when Geostat revises the series violates reproducibility & auditability (the NSO integrity mission). PIN by default; offer LIVE as an explicit opt-in (§4b).
4. **Re-serialize exports server-side (CSV/XLSX in the api).** REJECTED — the pure serializers already live in `core` and run client-side against the *exact on-screen slice*. Moving them server-side duplicates the SSOT and forces the server to re-resolve view-state. Extract stays client-side; the api only *persists snapshots + serves embeds*.
5. **A new `embed`/`export` NODE type in the config tree.** REJECTED — delivery is a *channel over any scope*, not content. Putting it in config violates Law 2 (config is data/content, not delivery mechanics) and bloats the schema for every author. It is a **port + command surfaced by chrome**, parameterized by `EmbedParams` (data). The scope is addressed by an existing `node.id`, not a wrapper node.
6. **Three independent subsystems left un-unified (ship the wiring, skip the port abstraction).** REJECTED — leaves finding #3's dual "rows" path and three drifting mental models. Naming the `ViewSnapshot` SSOT is the cheap architectural act that makes extract/embed/permalink provably consistent (a fitness function, §6).

---

## 6. Phased Strangler build order (each phase green + reversible; FF per phase)

The heavy lifting is done; these phases are **wire + complete + unify**, additive, CSR/static-runner intact throughout.

- **P0 — Name the port + correct the record (no behaviour change).** Introduce the `ViewSnapshot` SSOT type (contracts) and a thin `DeliveryPort` facade in react that both `downloadExport` and the mint client route through; assert the two "rows" paths derive from one snapshot. Fix the stale `plugins/CLAUDE.md` "stub" note and benchmark row #14. **FF-DELIVERY-ONE-SSOT** — extract and embed both resolve their payload through `ViewSnapshot`, not a second `interpretSpec`/`ctx.rows` read (grep-guard + unit). *Gate: green build, docs corrected, no UI change.*
- **P1 — Provenance on every artifact.** Extend `ExportMeta` + `ViewSnapshot` with `provenance`; join `reference-metadata` into export (CSV footer / XLSX metadata sheet) and into the snapshot at mint. **FF-DELIVERY-PROVENANCE** — an export/snapshot whose data references a dataset with a metadata report carries `source` + `lastUpdated` + methodology link + permalink; absence degrades, never blocks. *Gate: a real Geostat export opens in Excel with a provenance sheet; snapshot JSON carries vintage.*
- **P2 — Wire the embed loop to the client (activate the dark seam).** Add the mint action to the DeliveryMenu (`deliver:embed` command → POST `/api/snapshots` → signed URL + iframe embed-code copy), the geostat `/embed/:token` render route (GET `/api/embed` → `renderPageToHTML` scoped → hydrate), and node-scope the snapshot (`EmbedParams.scope.nodeId`, `renderPageToJSON`/`renderPageToHTML` honour it). **FF-EMBED-ROUNDTRIP** — mint a card snapshot → fetch by signed token → renders exactly that one scoped card headless (no chrome); bad sig 403, expired 410. *Gate: a copied embed code renders a single live card in a bare iframe.*
- **P3 — Image facet (citable as picture).** Register `png` (and optionally `svg`) export formats at the app layer (per the `export/index.ts` barrel note) over ApexCharts `dataURI()` + a Leaflet capture; image carries a provenance caption band (P1). **FF-IMAGE-EXPORT** — chart & map panels expose image export; the emitted PNG is a valid image with the provenance caption; registry-driven (no per-panel code). *Gate: export a chart as PNG with source+date caption.*
- **P4 — North-star (build on real trigger, YAGNI-gated).** LIVE-embed mode (re-fetch); snapshot-on-publish tied to AR-28's publish-FSM/ISR (a published page auto-mints its canonical citation snapshot); Constructor authoring of `EmbedParams` (AR-10 surface); permanent-citation (no-expiry) tier. *Gate: each activated only by a named requirement.*

Sequencing note: P0→P1→P2 are the mission core (citable + attributed + embeddable). P3 is the image leg. P0 and P1 touch `core`/`contracts`/`react` (no app collision); P2/P3 add geostat app code (the empty wiring surface) — low collision risk with in-flight chart/table branches.

---

## 7. Owner-facing DECISION POINTS (distilled — the real choices)

Each is a genuine fork; my recommendation follows. Per the "decisive initiative / you decide, lead" standing directive, I will proceed on these defaults unless the owner overrides — none is a one-way door except D3's cross-origin CSP posture, which I flag explicitly.

| # | Decision | Options | **Recommendation** |
|---|---|---|---|
| **D1** | **Snapshot data model** — pinned vs live | (a) pinned only · (b) live only · (c) **both, pinned default** | **(c)** — a citation must be reproducible (pin); expose LIVE as an explicit opt-in for always-current dashboards. Same substrate, one flag. |
| **D2** | **Snapshot storage & lifetime** | (a) pg `config.snapshot` (built, V36) with TTL · (b) + a permanent no-expiry "citation" tier · (c) object storage | **(a)+(b)** — keep the durable pg store; default TTL for dashboard embeds, opt-in **permanent** for published-page citations (a citation URL must not 410). Object storage is YAGNI. |
| **D3** | **Embed CORS/CSP posture (⚠ one-way-ish)** | (a) same-origin iframe only · (b) **cross-origin embeddable** on third-party sites | **(b) — scoped.** The whole point of embed (OWID/Datawrapper) is a card on a *news/partner* site. Serve ONLY the `/embed/*` route with `frame-ancestors *` (or an allowlist) + the embed asset CORS-open; the rest of the app stays same-origin locked. Data is already scope+dim-whitelisted and HMAC-gated. **Flagging: this is the security posture that needs your explicit yes.** |
| **D4** | **Export format scope** | csv/xlsx/sdmx-json (have) + **png** + svg? + parquet? | **Add PNG** (mission: "any section citable as image"); **SVG optional** (vector, cheap follow-on); **defer parquet/JSON-stat** until a real consumer. |
| **D5** | **Image capture mechanism** | (a) **client-side** (ApexCharts `dataURI`, leaflet canvas) · (b) server-side Puppeteer | **(a)** — no new tier, preserves the static-runner north-star (AR-28). Map fidelity is the only soft spot; acceptable, revisit only on a stated need. |
| **D6** | **Provenance depth in the artifact** | (a) **minimal** (source + lastUpdated + methodology link + permalink) · (b) full ESMS (coverage/quality/contact) | **(a) in the payload**, with the methodology link resolving to the full ESMS via the existing metadata endpoint. Keeps artifacts lean; full report stays one click away. |

---

## 8. Alignment with project laws
- **Law 2 (config is data):** delivery is a port/command/chrome concern; nothing logic-in-config is added. Snapshot = serialized config+state, re-rendered by the pure engine — the SSG/OWID model AR-28 already blessed.
- **Law 3 (arrow):** image registers app→core via OCP (core stays DOM-free); api imports only `contracts`. Clean.
- **Law 4 (full standard):** adopts Eurostat/World-Bank export, Grafana snapshot+signed-embed, Datawrapper/OWID embed-code — whole, in their best form, plus SDMX-JSON and ESMS provenance.
- **Law 5 (API-readiness):** extract serializes from the `DataStore`-resolved snapshot; swapping the store is unchanged. `SnapshotStore` is itself a port (pg↔memory).
- **Law 6 (root-cause):** fixes the *actual* gap (unwired client + 3 facets), not the phantom "stub" the docs describe.
- **Law 7 (architecture leads):** the `ViewSnapshot` SSOT is the target; the two existing "rows" paths migrate onto it (Strangler), not the reverse.
- **Law 8 (platform thinking + YAGNI):** one reusable port (new format = new capability, interface unchanged); LIVE-mode/Puppeteer/parquet deferred to real triggers.
- **Law 9 (a11y + integrity + permalink):** provenance on every artifact; export/embed reachable via disclosure; permalink is the citation URL and the LIVE-embed key.
- **AR-28 (static runner):** preserved — client-side capture + pinned static-HTML embeds on the same nginx; no live render tier. **AR-30 (MT):** untouched — `config.snapshot.tenant_id` is already an inert forward-add; the port neither builds on nor blocks MT.
```
