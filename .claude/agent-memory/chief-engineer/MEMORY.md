# Chief-Engineer Memory Index

## Project
- [V13–V21 batch review](project_v13_v21_review.md) — coherence pass on the i18n + unit-measure + SCD-2-unlock + audit + trigger-versioning batch; latent bugs found
- [Finish-line recon](project_finish_line_recon.md) — 2026-06-24 authoritative finish-line: green baseline (lint RED) + completeness + quality debt; board proven stale
- [Ship-readiness](project_ship_readiness.md) — 2026-06-25 SHIP-READY verdict: green gate verified real, all prior recon findings resolved, deferred-door list
- [ACL parity review](project_acl_parity_review.md) — 2026-06-26 review of commit 69cdef8: HIGH resolveRowLocales corrupts provenance, MEDIUM isUnsetTime SSOT dup, rest sound
- [Overnight parity batch](project_overnight_parity_batch_review.md) — 2026-06-27 audit of 6-commit batch: prior 69cdef8 findings FIXED; one MEDIUM (dead conditional-GET 304 + test matched to dead code); LOW latents; no tenant/arrow/SOLID/i18n leak
- [Perspective-axis review](project_perspective_axis_review.md) — 2026-06-27 pre-code review of VISION #2 time-mode→perspective reframe: naming drift, timeMode contract-requiredness, viewState↔evalVisibility wiring gap; thesis sound
- [Master Board synthesis](project_master_board_synthesis.md) — 2026-06-27 merge of 6 domain boards into work/MASTER-BOARD.md: multi-tenancy P0 fork, adoption-debt pattern, ops/a11y floor, 3 verified correctness defects
- [CLOSE-BOARD audit](project_close_board_audit.md) — 2026-06-28 finish-line audit: green baseline real (1981 tests, lint/typecheck/laws all 0), ALL prior findings resolved, SHIP-GRADE 0.88; remaining = unbuilt commitments not debt
- [Live-product audit](project_live_product_audit.md) — 2026-07-01 exhaustive :3002 sweep (F1-F18 in work/AUDIT-live-product.md); roots: live≠HEAD staleness, bare-string i18n contracts leak Georgian into EN, missing capability nodes
- [Kit false-green classes](project_kit_false_green_classes.md) — 2026-07-01 .claude-OS closing gate: cp1252 hook stdout crashes (truncate SessionStart) + engine-stale project.json paths; how to re-detect
- [State-B fix review](project_statebfix_review.md) — 2026-07-03 merge gate on useNodeRows async cache key: APPROVE-WITH-CONDITIONS; store-axis still not node-unique; useKpiRows debugger-rationale wrong


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [Platform Maturity](project_platform_maturity.md) — what's already built vs genuinely missing; grep before claiming a gap
- [Section Migration](project_section_migration.md) — section Strangler-Fig COMPLETE (twin gone, info+export wired); paths are packages/* not engine/*
- [Color token JS-axis](project_color_token_jsaxis.md) — FF-TOKEN-ONLY guards CSS+plugins/react JS but NOT charts/core; brand #0080BE leaks there
- [DB i18n divergence](project_db_i18n_divergence.md) — silver ingest validator hardcodes ka|en, diverges from V13/V14 gold locale contract; preview can pass what gold rejects
- [DB schema](project_db_schema.md) — schema topology/model (V1-V15, corrected numbering); SDMX cube, medallion staging, revision logs
- [DB schema gaps](project_db_schema_gaps.md) — genuine non-i18n weaknesses: no unit/measure model, annual time hardcode in query layer, RLS placeholder
- [ADR-0023 code_path](project_adr0023_code_path.md) — SCD-2 hierarchy moved id-chain→code-chain (V23 expand/V24 contract); cluster CLOSED; one wrong trigger-order comment (V24:145)
