# Orchestrator Memory Index

> **Doctrine lives in the kit, not here** (portable across projects): identity = `.claude/agents/orchestrator.md` (the charter);
> craft corpuses = `.claude/kit/feedback/feedback_{leadership_doctrine,verification_doctrine,architecture_craft}.md` (load triggers in `kit/INDEX.md`).
> This index holds only THIS-project facts + project-bound feedback. Rule: a lesson true on any codebase → kit; a fact of this repo → here.

## Feedback — project-bound
- [green-gate panel typecheck](feedback_green_gate_panel_typecheck.md) — gate MUST include `pnpm lint` + `tsc -b apps/panel`; root typecheck is geostat-only
- [gate render suite on data changes](feedback_gate_render_suite_on_data_changes.md) — config/data changes gating the CONSUMING app's render suite, not just own units
- [localeString leak + apex blindspot](feedback_localestring_leak_apex_blindspot.md) — bilingual-but-string field = silent React #31; jsdom misses chart shells
- [model launch ledger](feedback_model_launch_ledger.md) — requested≠verified model; ledger every Agent() launch; probe = ground-truth instrument

## Project — operational
- [landing slider = featured (yellow)](project_landing_slider_featured.md) — slider built FROM yellow-highlighted source cells via semantic layer; authoring-only signal
- [server deploy build context](project_server_deploy_build_context.md) — server clone tracks only main; push+fetch-by-name; provisioning JSON is baked into api image
- [MT decision deferred](project_mt_deferred.md) — owner deferred multi-tenancy; perfect single-tenant first; preserve the tenant_id seam, don't build MT
- [infra pattern](project_infra_pattern.md) — two-stack Docker Compose: infra/ separate from app; geostat-chat-ai is the reference
- [types.ts ceiling](project_types_ts_ceiling.md) — engine/react types.ts near the 400-line hard ceiling; decompose before adding fields
