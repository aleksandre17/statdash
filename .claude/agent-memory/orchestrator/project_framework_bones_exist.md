---
name: framework-bones-exist
description: The framework bones (DI/IoC, plugin registry, pages) EXIST but are under-leveraged/invisible — the disease is adoption, NOT absence. Do not teardown-panic.
metadata:
  type: project
---

Owner (2026-07-15, exhausted) despaired the platform has no framework foundations — "no DI, no IoC, no reusable element sharing, packages/plugins/pages invisible, canonism felt nowhere, everything disposable." **Lead verified in code — the bones EXIST, are real (not stubs), just under-leveraged and invisible:**
- **DI/IoC real:** `packages/react/src/engine/di/Container.ts` + `InjectionToken.ts` + `engine/useInject.ts` + `engine/extensions/ExtensionPoint.ts`; used by `EmptyState`/`ExportMenu`/`PanelLayout`, exported from `packages/react/src/index.ts`. But DI touches only ~4 components — NOT pervasive.
- **Composition seam real:** `packages/plugins/registry.ts` (heavy runtime registry, namespaced exports) vs `catalog.ts` (light meta). `packages/plugins/pages` EXISTS (container/inner/tab-page).
- Prior framework-lens verdict corroborates: dependency arrow machine-enforced, engine agnostic, `resolveMeasureRef` single seam, `registerFacetSections` a real registration fold.

**The truth: not disposable — real substrate, but the framework STORY is invisible/under-adopted, so it FEELS throwaway.** The panel-relay blueprint independently found the panel is ~90% RE-HOMING (not teardown) from coherent; nothing re-opens ADR-041/042.

**Two blueprints now define the WHOLE re-lay (one body, surface + foundation, 0→100 core-to-user):**
- Surface: `docs/architecture/proposals/BLUEPRINT-panel-canonical-relay.md` — 4 moments (Data→Compose→Refine→Publish) + 3 laws (PLANE/CONTAINMENT/ONE-PLACE); Step 1 = Four-Moment Shell (rail Data-first + Publish terminal), ~90% re-homing.
- Foundation: `docs/architecture/proposals/BLUEPRINT-framework-composition-spine.md` — assess+canonicalize the EXISTING DI/registry/extension-points into a pervasive, felt composition spine, benchmarked (VS Code/Grafana/Backstage/Builder/Nest).

**Why:** the owner oscillates into teardown-despair; the recurring cure is EVIDENCE that the substrate is sound + the fix is adoption/legibility, never a rebuild.
**How to apply:** never entertain teardown; route to surfacing/canonicalizing what exists. Benchmark before adding DI machinery (idiom judgment: strengthen-existing vs add-new — do NOT cargo-cult a Spring container into React). See [[framework-platform-verdict]], [[authoring-reconception]].
