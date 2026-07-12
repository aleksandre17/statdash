---
id: "0068"
title: "FOUNDATION BUILD — the Part grammar + Part port (ROOT-1..4); lay the object-model foundation to framework grade"
status: CORE COMPLETE + LIVE + VERIFIED on :3013 (commit 12a6d4c pushed; panel image rebuilt, container healthy; authenticated Studio render-verify = 21 layout nodes, 0 console errors, no loop — `work/verify-reform-3013.mjs`). Phases 1-5 + DoD proof + S1-S4 all shipped. HELD for owner sign-off: Phase 6 (wrapper/leaf derive, one-way) · S5 (rail collapse) · S6 (chrome-as-part). Follow-ups: FilterBarControlsBridge dead-code removal · widen section.accepts (homeless content blocks) · initFromApi honor ?page=/index_page_id · S1-S4 e2e locks.
class: M
priority: P0
owner: —
implements: owner GO 2026-07-12 ("lay it down from scratch to platform/framework — the more canonical/conceptual/powerful architecture") on the Fable diagnosis (0067) — Option A · D-F2 retire shadow-promotion · D-F3 port-first
depends_on: ["0067"]
links:
  - docs/architecture/proposals/SPEC-object-model-foundation-diagnosis.md
  - docs/architecture/decisions/ADR-038-bounded-element-law.md
  - docs/architecture/decisions/ADR-039-bounded-element-selection-projection.md
---
**Direction (owner-chosen, delegated to lead judgment):** Option A — settle the root. Lay ROOT-1..4:
- ROOT-1 Element (exists — keep verbatim).
- ROOT-2 **Part grammar** — unify the four containment grammars (`SlotDef` · `array+itemSchema` value-bands · `META.band` sourced · chrome regions) into ONE `PartField` concept; **residence declared on the FIELD, never the node** (Puck's law). Wrapper/leaf becomes a DERIVED predicate (declares ≥1 part-field), never a stored kind.
- ROOT-3 **Part port** (the missing primitive) — ONE engine-level interface `enumerateParts`/`writePart` (generalize BE-4's `BandSource` from app-level/value-only to engine-level/all-parts); ONE address grammar `(nodeId, partPath?)`; ONE anchor; adapters `slotParts`/`valueParts`/`sourcedParts` — BE-1/BE-4/BE-5 become three adapters of one mechanism, no per-kind bridge.
- ROOT-4 Facet — keep; reframe **Promotion Law = RENDER-side only** (D-F2: retire the `kpi-card` shadow promotion; BE-1 band is THE authoring answer).

**Method (binding — Law 7):** Strangler-Fig, alias/re-export discipline (R1-proven), **ZERO config migration**, platform GREEN + reversible after every phase. NOT a from-scratch rewrite — "framework-grade foundation," existing tested platform migrates onto the root.

**Sequencing (D-F3 port-first):** BE-4 (0062) stays HELD uncommitted → re-homes as the first `sourcedParts` adapter one layer down.

**Fitness (new, per diagnosis §5):** `FF-ONE-PART-GRAMMAR` (all constituent enumeration flows through the port) · `FF-RESIDENCE-AT-FIELD` (residence on the field, never the node) · `FF-DERIVED-CONTAINMENT` (no kind/flag may contradict declared part-fields). `FF-COMPOSITE-INTEGRITY` becomes the port's validation projection; `FF-NO-EXTERNAL-SPECIAL-CASE` stays green.

**Phase 0 — DONE (2026-07-12):** ADR-041 (ACCEPTED) + `PLAN-part-grammar-strangler-build.md` (6 phases + Phase 1.5 FENCE) + inert `partPort.ts` scaffold. Protection layer folded in (regression-guard ratchet FFs, check-laws tripwire, eslint sliver, law text). **Governance REGISTERED by lead:** root `CLAUDE.md` law 10 · `packages/CLAUDE.md` module law · Registry §0 ADR-041 row · opus-brief ROOT-LAW-FIRST banner.
**Phase 1 — IN FLIGHT (engine-specialist):** promote `partPort.ts` to live + `partFieldsOf` unified reading (slots→slot, array+itemSchema→value, band→sourced) + barrel export + `FF-ONE-PART-GRAMMAR`/`FF-RESIDENCE-AT-FIELD` scaffold. Additive, reversible, zero config migration.
**Phase 1 — DONE+VERIFIED (2026-07-12):** engine Part port live + `partFieldsOf` (3 residences on real corpus); `478/478` engine, lint 0, tsc×2 exit 0, dist rebuilt; inert (grep-confirmed no consumers), reversible.
**Phase 1.5 FENCE — DONE+VERIFIED (2026-07-12):** ADR-041 Delta 1 (sourced address = stable KEY, `field`=address/`source`=adapter; `EnumeratedPart.key?`). 4 BITES-proven ratchet guards (allowlists recon-exact: only node-`band` = filter-bar; only containment `canHaveChildren` read = `insertNode.ts`); check-laws `ADR041-part-grammar-no-bridge` in repo-root `.claude/project.json`; eslint sliver deferred to Phase 5. `49/49`, gate green. **Fence gates Phase 2.**
**Phase 2 — DONE+GREEN (2026-07-12):** 3 residence adapters (`valueParts`/`slotParts` engine-side app-agnostic + `sourcedParts` = BE-4 re-homed); `registerPartSource(residence,...)` (by residence, NEVER type); `useCanvasController` resolves via `enumerateParts`. BE-1/BE-4/BE-5 = ONE port. Gate: lint 0, tsc×2 exit 0, vitest (obj-model 26 incl ratchet, guards 6+7, panel 474, engine 490), e2e 2 passed, dist rebuilt. **Transitional positional `BandSource` facade kept over the SAME reading for the un-migrated CanvasOverlay + positional e2e selectors (Delta-1 stable-key live for Phase 3 to collapse onto; Phases 3–4 delete the facade).** `slotParts` registered+tested, wired to live selection in Phase 4.
**DoD PROOF — DONE ✅ CIRCLE CLOSED (2026-07-12):** table `columns` declared as a `value` PartField on `TableNode.ts` (Strangler over existing `ColumnDef`, compile-assert `AssertSchemaCovers` = 1:1 no fork). **ZERO generic-layer edits** — only table meta + co-located `column-part.fitness.test.ts` + regenerated `page-config.schema.json` (generated artifact). Proven: `partFieldsOf`→`columns`, `bandFieldsOf`→discovers, `bandItemsOf`→`columns.0/1` bounded items — same live path as a KPI card. Kind reconciled (table `canHaveChildren:false`, wrapper-by-value-band). Gate: lint 0, tsc×2 exit 0, vitest 64+17+3, dist. **A new authorable kind cost ONE declaration, ZERO mechanism.**
**Phase 3 — DONE+GREEN:** selection triple → ONE `PartAddress` (chrome = discriminated arm, per ADR-041 R4); positional facade DELETED; `FF-ONE-SELECTION-ADDRESS`. 807 panel tests, e2e 2/2. App-only.
**Phase 4 — DONE+GREEN:** ONE `PartAnchor`/`data-part-*` family for node+value+sourced+slot (`bandAnchor.tsx`→`partAnchor.tsx`, alias byte-identical); `slotParts` consumed by CanvasOverlay via recursing `enumerateParts` (`walkNodes` kept as deduped byte-identical fallback — full removal = later contract step gated by FF-COMPOSITE-INTEGRITY). e2e 4/2, FF-PROMOTION-LOSSLESS kept green, dist rebuilt.
**S1–S4 IA light-up — DONE+GREEN (2026-07-12):** S1 dock purely contextual (Element|Page tabs removed; page-config only when deselected) · S2 palette honest+droppable (accepts∪wrap-reachable; ROOT-CAUSE: unforked `handleDrop` onto the single `resolveInsertPlan`/`planInserts` path → blank-page drop auto-wraps page→section→chart) · S3 `nodeContextEditors` type-keyed map DELETED (ADR-038 anti-pattern gone, filter controls project generically, FF-NO-EXTERNAL-SPECIAL-CASE green) · S4 chrome canvas-selectable (authoring-gated `data-canvas-chrome-slot` anchor in `packages/react/ChromeSlot`, dist rebuilt; interim → folds into PartAddress at S6). Gate: 814 panel tests, e2e 7 passed, tsc×2 exit 0.
**FLAGS (follow-ups, non-blocking):** (a) `FilterBarControlsBridge.tsx` now dead code (kept only by `filterControlDrill.fitness` rendering it directly) → remove component+gate. (b) **Homeless content blocks** — hero/text/links/card/divider/spacer/stack accepted by neither page root nor `section` → still can't drop on a blank page; deeper fix = widen `section.accepts` or a generic page content-container (declarative META, a design call) — this is the residual of the owner's "blank page" complaint beyond S2.
**Then (autonomous):** Phase 5 (retire shadow-promotion + eslint sliver) → commit reform increment → **dev-image-rebuild deploy to :3013** (owner clicks the new capabilities). **HELD for owner sign-off:** Phase 6 (derive wrapper/leaf, one-way) + S5 (collapse rail) + S6 (selection/chrome-as-part).
**Then:** DoD proof (table columns as a `value` PartField via declaration ONLY — no bridge) → Phase 3 (selection→one PartAddress) → 4 (anchor merge) → 5 (retire shadow-promotion, eslint sliver) → 6 (derive wrapper/leaf, ⚠️one-way, owner sign-off). Each green-gated (PARSE `Tests N failed`) + dist + :3013.

**DoD:** the circle ends structurally — a NEW kind (table columns, hero cards, chrome items, repeat instances) is a DECLARATION only, no new bridge; proven by adding one such kind through declaration alone; ADR-038/039 + both SPECs extended (not forked); config byte-stable.

---

## ⭐ FOUNDATION DELIVERS THE WHOLE FELT LIST (owner directive 2026-07-12 — "საძირკველს რომ ამოაშენებ, ყველაფერს მიხედე"). The port is the ROOT; these are the surfaces that must LIGHT UP + be VISIBLE + DEPLOYED. This is the real DoD of 0066+0068.

| Owner's felt problem (2026-07-12) | 0066 ref | Resolved by | Status |
|---|---|---|---|
| "ვერ ეხები ყველა ელემენტს — კონტრაქტები" (can't reach every element) | ROOT-1 | The Part port: every element selectable/editable through ONE `enumerateParts` | Phases 2-4 (2 ✅) |
| **chrome კონფიგები** (chrome not contract-editable) | ROOT-1 / P3 | chrome as a `sourced`/`slot` residence adapter — **IN SCOPE, NOT deferred** (owner named it) | Phase 4/5 — ADD |
| **ბლანკ ფეიჯზე მხოლოდ სექცია დაემატა** (blank page: can only add a section) | ROOT-3 / P0 | slot composition: palette offers EVERY node the page's slots declare `accepts` (declared, not hardcoded to `section`); `slotParts` + drop | Phase 4 + palette — ADD |
| **n სიღრმისეული შესვლები** (n-deep nesting) | — | Composite/slot recursion — depth for free once slots project generically | Phase 4 |
| **მარჯვენა პანელში უადგილო გვერდი-კონფიგები** (right dock shows page-config out of place) | P1 | contextual dock: page-config ONLY when page/nothing selected; select an element → ONLY its own contract (bounded projection on the PartAddress) | contextual-dock slice — ADD |
| **არაკანონიკური სტუდიოს ზედაპირები / რთული UI** (non-canonical Studio surfaces, too complex) | ROOT-2 / P2 | Studio IA cleanup — PARALLEL design workstream (Webflow/Figma/Notion canon), architect-designed | IA workstream — REGISTER |

**Sequence (visible-first):** finish port wiring (Phase 3 ✅ selection → Phase 4 anchor+slotParts, in flight) → then LIGHT UP + DEPLOY the visible surfaces → then Studio IA cleanup. Each increment DEPLOYED to :3013 (dev image rebuild) so the owner SEES it. Nothing deferred silently.

**IA design DONE → `docs/architecture/proposals/SPEC-studio-ia-canonical.md` (ROOT-2, the UI twin of ADR-041).** Root-caused the owner's complaints: RightDock's persistent Element|Page tabs bleed page-config into element context; palette over-shows the whole registry while page root only accepts `section`; `nodeContextEditors['filter-bar']=FilterBarControlsBridge` is a per-type dock bridge (ADR-038 anti-pattern, now redundant); chrome is a separate non-canvas-selectable species. Canonical IA: `Canvas · Left Navigator (Add|Layers) · Right contextual Inspector · thin Top bar` (Theme + Data-model demoted from peer rail surfaces to top-bar workspaces — 6 surfaces → 2 left + 1 right). Every surface = generic projection of the port (no `if type===`).
**Migration (Strangler, felt-impact first):**
- **S1–S4 = apps-only, reversible — BUILD after Phase 4** (S4 touches CanvasOverlay = Phase-4 file, so serialize): **S1** dock purely contextual (drop the persistent Page tab; page-config only when page/nothing selected) · **S2** palette blank-page fix (`registry ∩ page-accepts∪wrap-reachable`, declared) · **S3** delete the `filter-bar` per-type bridge (controls become generic canvas parts) · **S4** chrome selectable on canvas (interim bridge to `selectChrome`/`ChromeInspectorPanel`).
- **S5 (collapse the rail) + S6 (selection-triple→one PartAddress + chrome-as-part, rides Phase 3 done + Phase 6 one-way) → OWNER SIGN-OFF (high-visibility / one-way).**
