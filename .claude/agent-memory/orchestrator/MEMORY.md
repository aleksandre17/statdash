# Orchestrator Memory Index

> **Doctrine lives in the kit, not here** (portable across projects): identity = `.claude/agents/orchestrator.md` (the charter);
> craft corpuses = `.claude/kit/feedback/feedback_{leadership_doctrine,verification_doctrine,architecture_craft}.md` (load triggers in `kit/INDEX.md`).
> This index holds only THIS-project facts + project-bound feedback. Rule: a lesson true on any codebase → kit; a fact of this repo → here.

## Feedback — project-bound
> Agnostic leadership doctrine (idea-source, principled-refusal incl. vs owner, one-team observation-duty, Definition-of-Done canon gate) lives in `kit/feedback/feedback_leadership_doctrine.md` — NOT here. This index holds only THIS-repo facts.
- [canon DoD incidents](feedback_canon_dod_incidents.md) — the 4 concrete session slips (Wave-8 false-green, nested all-expanded, chrome live-gap, PAGE_ROOT_TYPE hardcode) behind the agnostic DoD gate
- [green-gate panel typecheck](feedback_green_gate_panel_typecheck.md) — gate MUST include `pnpm lint` + `tsc -b apps/panel`; root typecheck is geostat-only
- [gate render suite on data changes](feedback_gate_render_suite_on_data_changes.md) — config/data changes gating the CONSUMING app's render suite, not just own units
- [localeString leak + apex blindspot](feedback_localestring_leak_apex_blindspot.md) — bilingual-but-string field = silent React #31; jsdom misses chart shells
- [model launch ledger](feedback_model_launch_ledger.md) — requested≠verified model; ledger every Agent() launch; probe = ground-truth instrument
- [panel live-boot verification](feedback_panel_live_boot_verification.md) — unit/fitness green ≠ works; prove panel features through the REAL boot path; jsdom masks boot-wiring (i18next.init, metric registration)
- [built-but-buried audit](feedback_built_but_buried_audit.md) — OBSERVE, don't react: scan for capabilities built+unit-green but unreachable in the live tool (query builder/data-pipe buried behind default-off steward role); reachability ≠ coverage-green
- [fire authorized one-way doors](feedback_fire_authorized_oneway_doors.md) — once a one-way door is AUTHORIZED + green-gate-proven, FIRE decisively; don't re-ask because owner is present; the independent gate-check (not permission) is the only discipline
- [activate not shadow](feedback_activate_not_shadow.md) — owner wants architecture SWITCHED ON + visible + done PROPERLY (real react-router routing), not shadow/flag-hedged or state-takeover shortcuts; cautious-invisible + crude = dissatisfaction
- [trunk over leaves](feedback_trunk_over_leaves.md) — leaf-fixes (CORS, one inspector card) ≠ the mandate; the systemic node/object-model Bounded-Element overhaul is the TRUNK — keep it driving, lead reports with it
- [parallel isolated worktrees](feedback_parallel_isolated_worktrees.md) — concurrent repo-editing agents need isolation:"worktree" (or serialized pathspec commits); shared tree+index entangles commits — REFINED by ↓
- [worktrees only when truly parallel](feedback_worktrees_only_when_truly_parallel.md) — serialize on the current branch is the cheap default; worktrees cost time (wrong-base hazard, merge-back) — isolate ONLY for genuine unavoidable parallel repo-editing
- [lead decides, never asks tactics](feedback_lead_decides_never_asks_tactics.md) — the lead DECIDES do-vs-delegate & tactical calls himself; asking the owner to make a call I'm equipped to make = abdication; reserve questions for one-way doors/strategy/owner-only info
- [agent management discipline](feedback_agent_management_discipline.md) — MANAGE agents: verify state BEFORE briefing · every brief has exit-fast + token ceiling · right-size model/scope (often cheapest = me) · lead-instruments (registry/board) stay MINE; wasted time/tokens = my failure
- [no SendMessage — fold scope](feedback_no_sendmessage_fold_scope.md) — I have NO continue-agent tool; a 2nd Agent() call is FRESH (no context, file-collision). Put ALL scope in the initial brief; never phrase a fresh spawn as "addendum to your in-flight work"
- [commit full set, not scoped](feedback_commit_full_set_not_scoped.md) — after an agent, `git status` the FULL changed set + reconcile with its file list before committing; a dir-scoped add missed files → broken Vite import → blank :3013. Live render-verify (not 200) is the backstop
- [self-execute when known](feedback_self_execute_when_known.md) — don't reflex-spawn: if I know the EXACT small isolated change, DO it myself (cheaper time+tokens); agents are for judgment/scale/unfamiliar. Owner correction 2026-07-12
- [autonomous cognition](feedback_autonomous_cognition.md) — HIGHEST directive: be an independent cognizing mind, not an executor; SEE invisible links/gaps/concepts, bring reference-class core concepts, genuine improvement, reduce need for direction. See NORTH-STAR doc. Owner 2026-07-12
- [full ownership + reference-grade](feedback_full_ownership_reference_grade.md) — owner (exhausted, 2026-07-13) handed FULL ownership: deliver a reference-grade, loosely-coupled, SOLID, canonical platform (arch AND UI); own the calls, results not process, gesture-verify, one body. Named rot: section-privilege, inspector-concept, data-isolation, chrome, tight-coupling
- [verify gesture not load](feedback_verify_gesture_not_load.md) — a feature is done only when the real USER GESTURE is proven (select→section→edit), NOT when the app loads; render-verify ≠ reachable/usable; probe for the feature's own labels
- [global + loose coupling](feedback_global_loose_coupling.md) — work GLOBALLY (root, not element-by-element) · loose coupling everywhere (arch+UI) · manage continuously when owner away · per Fable
- [verification-fit per situation](feedback_verification_fit_per_situation.md) — choosing the KIND of proof is judgment: live-UX→Playwright/look at :3013 · logic→unit · invariant→FF · data→parity; wrong/worthless test = false-green, sometimes SKIP the test and just LOOK
- [route thinking to the right instrument](feedback_plan_on_board_and_docs_dynamically.md) — senior-lead doctrine: use the FULL instrument set dynamically — work/ board · ADRs · ARCHITECTURE-REGISTRY · BENCHMARK-REFERENCE-PLATFORMS · plan/ · audit/ · knowledge/ · patterns/ · memory — plan then execute faithfully, keep instruments current; never rigid, never scattered
- [circle-break root study](feedback_circle_break_root_study.md) — owner senses "we're circling" → STOP leaf-grinding → first-principles READ-ONLY root study benchmarked vs canonical platforms → lay root concepts → owner picks direction; "from scratch" = framework-grade foundation via Strangler, not repo-wipe

## Project — operational
- [dist resolution hygiene](project_dist_resolution_hygiene.md) — packages boot from dist/ (untracked); a packages/* source change white-screens the live app until `pnpm -r ...build`; tsc-green ≠ dist-fresh
- [authoring reconception](project_authoring_reconception.md) — owner-mandated bold reconception of panel (UI+func+concept+arch); vision leads, existing adapts; dislikes 3-step wizard
- [landing slider = featured (yellow)](project_landing_slider_featured.md) — slider built FROM yellow-highlighted source cells via semantic layer; authoring-only signal
- [server deploy build context](project_server_deploy_build_context.md) — server clone tracks only main; push+fetch-by-name; provisioning JSON is baked into api image
- [remote-dev CLI](project_remote_dev_cli.md) — show panel on the DEV server via `tools/statdash.ps1 dev up p --mode remote` (rsync→192.168.1.199 Vite container); needs pwsh/PS7 (absent in my Git-Bash); panel not in dev Docker compose
- [three-tier environments](project_three_tier_environments.md) — LIVE dev→staging→prod on 192.168.1.199, fully isolated (172.27/28/29); dev :3013 admin/dev_admin_pw_123, real data (2479 obs); live-watch works; ADR-035 fresh-boot fix; statdash-api = per-tier network alias
- [MT decision deferred](project_mt_deferred.md) — owner deferred multi-tenancy; perfect single-tenant first; preserve the tenant_id seam, don't build MT
- [infra pattern](project_infra_pattern.md) — two-stack Docker Compose: infra/ separate from app; geostat-chat-ai is the reference
- [types.ts ceiling](project_types_ts_ceiling.md) — engine/react types.ts near the 400-line hard ceiling; decompose before adding fields
- [session state + UI priorities](project_session_state_ui_priorities.md) — owner's CURRENT stack (2026-07-11): data sound → dedup → pipelines-visible → right-side fix; NOT AI/vintage; 2 agents running (object-model activate, Fable UI benchmark); CORS/localhost anti-pattern fixed
- [object-model foundation reform](project_object_model_foundation.md) — THE root fix (0067 diagnosis→0068 build): Part grammar + engine Part port ends the BE-1..BE-4 leaf-bridge circle; residence-at-field, wrapper=derived, retire shadow-promotion (D-F2), port-first (D-F3); Strangler, zero config migration
