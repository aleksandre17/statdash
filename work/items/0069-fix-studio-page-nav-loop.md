---
id: "0069"
title: "P0 BUG — panel Studio infinite navigation loop on page-to-page switch (:3013)"
status: BOTH LOOP FACETS FIXED + LIVE on :3013. (1) In-app nav — 95f52c0 (Effect A single-writer), owner-confirmed fixed. (2) Boot/deep-link — a91a9b1 (Effect B stands down for a valid `?page=`); root: `initFromApi` seeds store to `pages[0]` = most-recently-updated (`pages.ts:116 ORDER BY updated_at DESC`), so a deep-link to any OTHER page starts URL≠store → oscillation; regional was exempt only as the most-recent row (NOT config). Dev-line at a91a9b19, serves 200.
FOLLOW-UPS owed: (a) lock-tests — jsdom disagreement case (store=A, URL=B → settles, active=B, URL=B) + Playwright ≥2-page boot; (b) `initFromApi` honor `?page=` → `index_page_id` → fallback (currently ignores `index_page_id:"landing"`, boots to most-recent — latent wrong-default). Both = a boot-correctness pass. Deeper: the URL↔store two-way binding is itself a coupling smell (per owner "loose coupling") — candidate for router-as-SSOT decouple.
Lesson learned: "fixed" = live-verified, not source-edited.
class: M
priority: P0
owner: —
implements: owner-reported live defect 2026-07-12 ("გვერდიდან გვერდზე გადასვლისას საიტი უსასრულოდ იციკლება")
depends_on: []
links:
  - platform/apps/panel/src/studio/StudioShell.tsx
---
**Symptom (owner, live on :3013):** navigating page-to-page, the panel loops infinitely (address bar/canvas thrash, CPU pegs). Triggers whenever you switch to a DIFFERENT page while the URL already carries `?page=` (any real nav with ≥2 pages).

**Root cause (debugger, confirmed):** two competing effects in `apps/panel/src/studio/StudioShell.tsx:86-102` form a NON-convergent two-way URL↔store binding. Effect A (URL→store, `:86-90`) reverts the store to the stale `urlPageId`; Effect B (store→URL, `:91-102`) sets the URL to `activePageId`. Both read the same pre-commit snapshot and write toward OPPOSITE targets → after commit the two sides SWAP (store=old, URL=new) → still unequal → swap back → forever. The binding's own "convergent" comment (`:75-83`) is false: Effect A can't tell "URL stale because I just changed the store" (must NOT revert) from "URL changed via Back/Forward/deep-link" (must apply), because `activePageId` is in its guard+deps.

**Minimal root-cause fix:** remove `activePageId` from Effect A's guard AND dependency array — Effect A reacts to genuine URL events only; Effect B stays the sole store→URL mirror. Store becomes the working SSOT, URL a single-writer projection ("derive, don't sync"). Trace: click p2 → `setActivePage(p2)` → Effect A does NOT re-run (urlPageId unchanged) → Effect B sets URL=p2 → urlPageId=p2 → Effect A re-runs, `setActivePage(p2)` = no-op (zustand bails on identical) → settles. Back/Forward + deep-link still drive the store.

**Why 847a9d7's e2e missed it:** `studioRouting.e2e.ts` uses a SINGLE-page mock → URL and store always agree → no swap. The loop needs ≥2 pages with URL-page ≠ store-page — never exercised.

**Lock (DoD):**
- jsdom unit: `StudioRoutes` in `MemoryRouter` at `/studio/insert?page=p1` with a **2-page** store; click the p2 chip; flush. Pre-fix throws "Maximum update depth exceeded"; post-fix settles (store=p2, URL `?page=p2`).
- Playwright real-boot: extend the mock to ≥2 pages, click a second page tab, assert URL settles to `?page=<p2>` and stays (no thrash). Closes the single-page e2e coverage gap.
- Green-gate (PARSE `Tests N failed`) + :3013 refresh + owner clicks page-to-page.

**Sequencing:** touches ONLY `StudioShell.tsx:86-102` — NO file collision with Phase 2 (`canvas/*`, `useCanvasController.ts`). Held until Phase 2 lands so the shared `tsc -b apps/panel` + panel vitest gate reflects one change-set, not a mixed in-progress tree. Then land + verify + one combined :3013 refresh.
