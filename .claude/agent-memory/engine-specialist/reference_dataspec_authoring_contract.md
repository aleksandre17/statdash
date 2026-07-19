---
name: dataspec-authoring-contract
description: ADR-049 P1 — SPEC_CATALOG promoted stub→authoring contract (make()+schema/editorKey); the binding axis' port; DataSpecEditor now switch-free
metadata:
  type: reference
---

# DataSpec authoring-contract registry (ADR-049 P1 — the binding axis gets its port)

`SPEC_CATALOG` (core `spec-catalog.ts`) is no longer a metadata stub — it is the
**authoring contract SSOT** for every DataSpec bind-kind. Each `SpecDescriptor` now
declares `make(): DataSpec` (the default factory — absorbed the panel's old
`defaultSpec` switch, re-homing it to the engine, arrow-restored) + EXACTLY ONE of
`schema?: PropSchema` (Inspector arm) or `editorKey?: string` (registered rich-editor arm).
`resolveSpecAuthoring(type)` is the ONE resolver (exported from `@statdash/engine`).

**Why:** closes ADR-038's *binding* axis exactly as ADR-041 closed *containment* — a new
bind-kind = ONE `SPEC_CATALOG` declaration (+ optionally one registered editor), zero
composer edits. The old `DataSpecEditor` had THREE per-type switches (defaultSpec + SpecBody + a stub catalog).

**How to apply:**
- The panel's `DataSpecEditor.tsx` (`features/data-layer/`) is now a GENERIC composer — NO `switch (spec.type)`, no per-kind editor import. It dispatches `editorKey`→`getSpecEditor` (panel `specEditorRegistry.ts`, boot-registered by `registerSpecEditors.ts`, wired in `App.tsx`) OR `schema`→the generic Inspector via `specSchemaSource.ts` (the exact `transformStepSchemaSource`/`filterParamSchemaSource` precedent, one rung up). Guarded by `FF-NO-DATASPEC-SWITCH` (ratchet at `[]`) + `FF-DATASPEC-AUTHORING-COMPLETE` (every SPEC_CATALOG kind resolves to schema-xor-editor).
- `pipeline` is a DataSpec discriminant but deliberately NOT in SPEC_CATALOG (workbench-authored) — completeness gate iterates SPEC_CATALOG keys, not `DATASPEC_DISCRIMINANTS`.
- **Law-2 manifest split (non-obvious; fixed post-P1, pre-P2a):** `make()` is engine RUNTIME behaviour, NOT config — it must never reach the JSON app manifest (round-trip breaks: `"make": [Function]`). `SpecDescriptor = SpecManifestEntry & { make }`; `SpecManifestEntry` is the serializable face (no fn). `describeApp().specTypes` emits `specManifest()` (core `spec-catalog.ts` — strips `make` BY CONSTRUCTION via `Object.entries().map(([t,{make,...e}])=>…)`), typed `Record<string,SpecManifestEntry>`, NOT raw `SPEC_CATALOG`. Same shape as `exportFormats` emitting ids not `SerializeFn`. Runtime `make` still flows via `resolveSpecAuthoring`. Locked by react `constructor.test.ts` "round-trips through JSON without loss".
- **Deferral (non-obvious):** only `ratio-list` migrated editor→`schema` (its `pairs` is `array`+`itemSchema` → the editable `ArrayOfControl`). `timeseries`/`growth` STAYED `editorKey`: their `years` (`number[]|'all'`, no itemSchema/registered control) + `growth.code` (`string|string[]` mode-toggle) would resolve to the read-only `SummaryCard` — a functional regression. Cleanly migrating them needs a `years`/mode FieldControl = the ADR's deferred P2a "FieldControls absorb sub-modalities" pass. See [[no-privileged-literal-guard]] class of schema-arm work.
