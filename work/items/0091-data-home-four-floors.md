---
id: "0091"
title: "W-P6a — THE DATA HOME: four floors, SOURCES FIRST (owner verdict on /studio/model: «საშინელება — გადახლართული ლოგიკები, წყაროები ბოლოში, გამეორებები»)"
status: QUEUED-HOT (2026-07-18 — pulled forward from W-P6; fires after 0087+0089 land; the DQ-on-ingest half stays W-P6b in place)
class: M
priority: P0
owner: lead → senior/apex build agent (Opus)
implements: CLAUDE.md Law 11 C1 — «data first, always: raw → governed model → bound elements → published pages — THE VISIBLE SPINE» · SPEC §2 four-floor ladder · the owner's verbatim logic: «თუ არ გაქვს მონაცემი, რას აკეთებ სხვას» — sources LEAD
links:
  - platform/apps/panel/src/studio/DataModelBody.tsx      # today's accretion (front door + lens + surfaces, wave-by-wave)
  - docs/architecture/proposals/SPEC-query-pipeline-data-home.md   # §2 — the decided floor plan
---
**The verdict this answers (owner, live walk of /studio/model):** tangled coupling · bad UI · data SOURCES buried at the BOTTOM when everything should START with them · upload repeated in multiple places · SOLID/SSOT violations · anti-patterns. He is right, and the page predates the canon it violates.

**The build — the Model page becomes the FOUR-FLOOR LADDER, read top-to-bottom (SPEC §2, one vertical spine):**
1. **Floor 1 · ნედლი წყაროები (TOP — sources lead):** the cube/dataset inventory (governed titles, dim summaries, the 0084 label-debt chips) + ONE upload door (`CanonicalUpload` — exactly one mount; every duplicate dies). Steward-owned per the plane law.
2. **Floor 2 · მართული მოდელი:** metrics + dimensions (the catalog manager, the dictionary) — fed FROM floor 1 (the promotion loop lands here).
3. **Floor 3 · query-ები/მილსადენები:** which specs exist, where bound (summary; editing stays in the workbench — one editor, 0086 law).
4. **Floor 4 · ელემენტები/გვერდები:** where the data lands (read-only orientation; DataFlowMap becomes THIS floor's view, not an exile).

**SOLID/SSOT cleanup (the tangle he named):** one mount per concern (upload ×1, dictionary ×1, flow-map ×1 — audit and kill every duplication); each floor a self-contained section component with its own store hook (no cross-floor reach-ins); the lens (author/steward) gates VISIBILITY, never duplicates surfaces; every floor derives from its ONE existing store/SSOT (cubeApi, semanticCatalog, provisioning) — no second fetch paths.

**Boundaries.** IA + composition re-architecture, apps-only — NO new grammar, NO ingest/DQ changes (W-P6b) · reuse every existing surface component (this is re-homing + deduplication, not rewrites) · honest states per floor · bilingual, WCAG · the page must answer a first-time steward's question in order: რა მაქვს (1) → რას ნიშნავს (2) → სად მუშავდება (3) → სად ჩანს (4).

**DoD.** Live walk: /studio/model reads as the four-floor ladder, sources FIRST; exactly ONE upload door; no duplicated surface; each floor honest when empty; author vs steward lens differ by visibility only; zero console errors; panel gate green; screenshots; the owner's re-walk is the acceptance.
