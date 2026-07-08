---
name: ar48-delivery-port
description: AR-48 export/embed/snapshot — the backend is ~80% BUILT (reference-grade), the "stub" docs are STALE; real work is wiring the dark client seam + 3 facets
metadata:
  type: project
---

AR-48 (headless export/embed/snapshot delivery port) is DESIGNED — SSOT `platform/work/DESIGN-delivery-port-export-embed-snapshot.md` + the AR-48 registry card.

**The load-bearing correction:** `plugins/CLAUDE.md` ("Excel+CSV per section — now: stub") and `BENCHMARK-REFERENCE-PLATFORMS.md` row #14 ("export = STUB, no embed/snapshot") are BOTH STALE. Verified in code, the delivery backend is ~80% built to reference grade:
- Data export CSV(BOM)/XLSX(OOXML)/SDMX-JSON: `platform/packages/core/src/data/export/` (OCP registry + serializers), `react/…/downloadExport.ts`, `EXPORT_MENU` DI, `data:export` command, `NodeExportContext` per-section publish/subscribe, WAI-ARIA menu. LIVE in the section header.
- Snapshot serialization: `react/engine/targets/api.ts` `renderPageToJSON` (rich `PageDataSnapshot`, PINS frames) + `targets/html.tsx` `renderPageToHTML` (`RenderTarget = dom|html|pdf|api`). Pure engine.
- Persistence: `SnapshotStore` port (mem LRU + `createPgSnapshotStore`), `config.snapshot` migration **V36**, `SnapshotEnvelope` contract in `@statdash/contracts`.
- Embed delivery: `apps/api/src/routes/embed/` — `/api/snapshots` (JWT+audit mint→signed URL), `/api/embed/:token?sig` (public HMAC-SHA256, 403/404/410), `EMBED_SECRET` prod gate, same-origin CORS. MOUNTED in `apps/api/src/index.ts`.

**Why it matters:** this is a fully-built but ENTIRELY UNCONSUMED seam (dark code) — `renderPageToJSON` is called only from tests; `apps/geostat` has zero mint/embed-render/PNG code. The real AR-48 = NAME the port (`ViewSnapshot` SSOT), WIRE the backend to the client, and COMPLETE 3 genuine gaps: image export (PNG/SVG, app-layer OCP format over ApexCharts `dataURI()`), provenance-on-export (join `ReferenceMetadataContract` — csv footer/xlsx sheet/png caption), card-scoping (`EmbedParams.scope.nodeId`). See the deferred-seam pattern in [[deferred-framework-seams]] (orchestrator/other agents track similar).

**How to apply:** when routing AR-48 build work, do NOT scope it as greenfield export — the risky parts (durable store, HMAC, audit, pure render targets) are green. Phases P0-P2 (name+correct-docs → provenance → wire embed loop) are the mission core; mostly wiring in `apps/geostat`. Owner decision D3 (cross-origin embed CSP `frame-ancestors`) is the one flagged one-way door. If a future scan re-reads the stale "stub" note, trust the code, not the note (P0 fixes both docs).
