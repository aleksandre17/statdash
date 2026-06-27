# Engine Specialist Memory Index

## Project
- [transform/ split + Phase 2.1](project_transform_split.md) — transform.ts decomposed into 5-file sub-module; RawRow = EngineRow alias; critical byte-fidelity lesson for Write tool
- [N34d streaming + useNodeStream](project_n34d_streaming.md) — subscribe? already present pre-session; useNodeStream hook + polling/streaming; streaming stores bypass CachedStore
- [caps data pass [N29]](project_caps_pass.md) — CAPS const + NodeCap extension in slice-meta.ts; all 22 plugin META files wired; integration test in engine/plugins/nodes/__tests__/
- [schema versioning N19/P3-3](project_schema_versioning.md) — canonical runner = engine/core/config/migration.ts; react duplicate is node-tree; api decoupling blocks provisioning wiring (escalate)
- [canonical parser ADR-0031](project_canonical_parser.md) — apps/api/src/ingest/canonical/* PURE workbook→bronze deserializer; xlsx ACL-confined (F-3); DSD SSOT=STRUCTURE.dimensions; obs 415/288/1554
- [async store ACL parity](project_async_store_acl_parity.md) — stats adapter contract: label{en,ka}+parent_code, obs Number coercion+seqPos lift, display overlay (stats-display.ts), queryReadObs warm/read SSOT, AttrVal widening, resolveNodeRows i18n seam
- [perspective-axis residuals](project_perspective_axis_residuals.md) — scopeOverride.compare is dead (write-only) → delete in P6; zero MetricDefs registered in prod; scope.metric is a measure-SWAP, NOT the point↔cagr carrier (that's value.type)
- [perspective-axis P0](project_perspective_axis_p0.md) — ADR + landed P0: contract envelope (contracts) + core refinement (intersection-not-interface) + scope-key registry/catalog split + perspectiveRegistry alias + 2 FFs; additive/byte-identical, 1696 green; catalog allowlist twins (no-tenant + check-laws)
