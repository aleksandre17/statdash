---
name: project-panel-capability-matrix
description: 0104-E1 Capability Matrix — how workbench admissibility + editor parity are DERIVED from declarations; the two-pool split and why admissibility must stay pure
metadata:
  type: project
---

# Capability Matrix (DESIGN-0104 §2·C2, wave E1 — commit 825e1e68)

Kinds DECLARE required authoring capabilities, editors DECLARE provided, three-pane
admissibility + editor parity are DERIVED. Replaced the hand `isWorkbenchShaped` allow-list.

**Where it lives.** Vocabulary = `packages/core/src/capabilities.ts` (`CAPABILITY_IDS` const
union → `CapabilityId`, Constructor-visible via `specManifest()`). Per-kind required set =
`SPEC_CATALOG[kind].capabilities` (+ `capabilitiesFor(kind)` helper). Panel derivation =
`apps/panel/.../workbench/workbenchCapabilities.ts` (`WORKBENCH_CORE_CAPABILITIES`,
`isWorkbenchAdmissible`, `requiredCapabilities`). Editor `provides` = `specEditorRegistry.ts`
(3rd arg to `registerSpecEditor`, + `providedByRegisteredEditors()`/`unregisterSpecEditor`).

**Why: the load-bearing non-obvious decision — TWO distinct provider pools.**
- **Admissibility pool (routing, MUST be PURE): workbench-core ONLY** (+ future step editors
  via `registerStepEditor`, empty today). `isWorkbenchAdmissible(kind) = required(kind) ⊆
  WORKBENCH_CORE_CAPABILITIES`. It does NOT read the whole-kind editor registry.
- **Parity pool (probe completeness, broader): core ∪ every registered editor's provides ∪
  schema-arm kinds' own caps.** Used only by the fitness's "no orphan requirement" check.

The reason admissibility must NOT read the runtime editor registry: the pure model tests
(`workbenchModel.test.ts`) assert `toWorkbenchModel({type:'timeseries'})` is null and
`toWorkbenchModel(query)` non-null WITHOUT registering any editors. If admissibility depended
on `providedByRegisteredEditors()`, query would be non-admissible in that (registry-empty)
test and it would break. Keeping admissibility catalog+static-core-driven also makes the 0104
regression **unrepresentable by DERIVATION** (registry-independent), which is strictly stronger
than a fitness catching it. `isWorkbenchShaped` is now `!!spec && isWorkbenchAdmissible(spec.type)`.

**Vocabulary (door #3, lead-review at E1).** Core (pipeline-spine, provided by the three-pane):
`head.source.pick`, `head.filter-builder`, `pipeline.steps.edit`, `encoding.edit`,
`raw-json.write`. Kind-specific (force fallback): `head.measure-code.edit`, `head.years.edit`,
`growth.single-multi.toggle`, `pivot.rows.edit`/`.key-field.edit`/`.value-fields.edit`/`.colors.edit`,
`transform.source.edit`, `row-list.rows.edit`, `ratio-list.pairs.edit`, `metric.refs.edit`,
`metric.grain.edit`. `pipeline` is NOT a catalog kind (not pickable pre-C7) → its required set
lives panel-side in `workbenchCapabilities.ts` (`PIPELINE_REQUIRED`), not `SPEC_CATALOG`.

**Fail-closed rule:** an undeclared kind (empty required) is NOT admissible — never silently
admit. **How to apply (E2a):** to auto-admit timeseries/growth/pivot/transform into the panes,
register a step/head editor whose `provides` covers their acts and union it into
`workbenchProvidedCapabilities()` (the one marked E2a seam line) — NO edit to `isWorkbenchShaped`
or any per-kind switch. Parity fitness = `editorCapabilityParity.fitness.test.tsx` (probe per
CapabilityId via `it.each`; J-PARITY unregisters an editor → degrades to JSON, never read-only).

See also [[project_panel_editor_capability_parity]] (the DU4 restoration this generalized) and
[[project_panel_pipeline_program]] (ADR-046 workbench).
