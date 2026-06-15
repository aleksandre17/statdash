# Kit Changelog

> One entry per version. Read on `/upgrade`. Newest first.

## 1.9.0 — architecture restructured on the lean-core principle

Acted on the honest critique (the system was over-built relative to proven need, doctrine-heavy and field-light). Restructured around the concepts that make it ideal, *subtractively/structurally* rather than by adding more:
- **Explicit two-tier model** (INDEX): **CORE** = the small binding spine that runs without anyone reading a doc (hooks + manifest law_patterns + agent files + CLAUDE.md + the SessionStart injection). **REFERENCE** = the on-demand library (strategy / skill / feedback), consulted for depth, not required to operate. This names what already truly binds vs what is advisory.
- **Earned-growth governing law** (INDEX + 09 architecture-protection + README): the CORE stays minimal; new doctrine enters REFERENCE and graduates only when real use proves it changes outcomes. **Over-engineering is architectural erosion; measure before you add (YAGNI as a fitness function); doctrine grows from feedback/ lessons, not speculation.**
- Deliberately added **no new automated check** for this — an unproven enforcement mechanism would itself be the over-engineering being warned against. The law binds via the Disposition + chief-engineer review.

The remaining work to reach true ideal is not more building — it is *use*: the first real /audit on live code will show what to prune and what genuine gap to fill (earned).

## 1.8.0 — consolidation pass 2: strategy 15 → 9, docs merged, all refs resolve

Scattered doctrine merged into cohesive files, no information lost, every cross-reference rewritten: strategy **15 → 9** (01-A→01 · 04→03 · 07-A→07 · 10→09 · 12→11 · WORKING-STRATEGY→INDEX), the project examples slot renamed 04-A→03-A for consistency. Top-level docs consolidated: HISTORY→UPGRADE-NOTES (one history), KIT→README (one system reference). md bloat limit raised 300→500 (doctrine docs are legitimately longer than code; code limits unchanged). Full coherence re-verified: no dangling refs, no orphans, INDEX covers everything, all numeric/path refs resolve, doctor green.

## 1.7.1 — senior reflex: good-is-not-best + benchmark against the proven best

Extended the Disposition with the senior interrogation: *"this works / this is architectural — but is it the BEST? what would the higher-standard version be?"* (never settle at good-enough) and the benchmark reflex: *"how would the leading, established engineering orgs and reference platforms solve this?"* — with canonical sources in the skill (AWS/Google Well-Architected · Google SRE · Netflix resilience · Stripe API · Fowler · ThoughtWorks Tech Radar · 12-Factor · the domain reference impl). Added to all three carriers (SessionStart contract, B.md, per-agent Disposition line) and the skill §5 benchmark-sources note.

## 1.7.0 — the Engineer's Disposition (agents that think)

Crystallized the proactive, critical, never-a-deaf-slave mindset into one binding doctrine, present in three places so every agent carries it on every task: (1) SessionStart injects it into the operating contract (every session), (2) B.md states it as the always-on identity, (3) a one-line **Disposition** sits at the top of all 12 agents. The disposition: THINK don't transcribe (senior architect/engineer/scientist, not executor) · miss no architectural problem (surface every smell/erosion/violation, even unbriefed) · best-case only (works+agnostic+ISP+extensible+tested; root-cause not symptom; refuse sub-standard — never execute a bad decision) · highest situation-fit standard (SOLID + right pattern, deliberate not rote) · architecture alive never frozen (evolve via Strangler-Fig/evolutionary-arch, never erode) · improve always · research the best method when unsure · flag-name-propose.

## 1.6.2 — end-to-end hardening pass

Full audit across every dimension (version coherence · dangling refs · strategy cross-refs · agent arming + model tiers + allowlist · drift · INDEX coverage · manifest/schema · command shims · skill mirror · English-only · literal-free · live hook-fire · selftest). All green. Fix: kit changelog genericized (no project literals) so the framework is fully portable. Confirmed: every senior on Opus, middle on Sonnet, junior on Haiku; all 12 agents armed with their named canon; doctor live-fires every law/arch/Class-M/bloat guard.

## 1.6.1 — every agent armed with its full named canon

Each agent gained the remaining relevant named, canonical principles for its responsibility (no duplication — only what each lacked): orchestrator (Conway/SRP/least-privilege/SoC) · chief-engineer (ISO 25010/Lehman/Pareto/DORA) · architect (KISS/Hexagonal/Strangler-Fig/Evolutionary-Arch/CQRS) · database-architect (CQRS/Outbox/Saga/polyglot) · senior-backend (GRASP/backpressure/graceful-degradation/DI) · senior-frontend (Atomic Design/WAI-ARIA/mobile-first/Core-Web-Vitals) · project-manager (MoSCoW/critical-path/Little's-Law/Theory-of-Constraints) · debugger (scientific-method/rubber-duck/delta-debugging) · explorer (Chesterton's-Fence/read-before-edit) · junior-executor (spec-fidelity/fail-loud). Skill enriched with all newly-named principles as canonical definitions (§1 Atomic/ARIA/CWV · §2 KISS/Chesterton/Pareto/Lehman · §10 Little's-Law/ToC/MoSCoW/backpressure/graceful-degradation/evolutionary-arch/polyglot · §11 debugging discipline).

## 1.6.0 — platform-architect agent + config-driven-platform canon

New senior agent **platform-architect** (Opus): designs declarative, config-driven, visual-builder systems (Builder.io / Form.io / JSON-Forms / dashboard-constructor class) at the highest standard. Skill gains **§12** — the named canon for this domain: config-as-SSOT · declarative-over-imperative · Interpreter+Composite+Registry+Strategy · OCP via discriminated unions · JSON Schema / schema-driven UI · capability discovery/palette · lossless visual↔JSON round-trip · safe sandboxed expression eval · DataSource port (headless/API-first) · schema versioning via expand-contract · MDE/DSL design. Roster 11 → 12; allowlist + doctor + INDEX updated.

## 1.5.0 — consolidation pass 1: agents (16 → 11, each armed with its named canon)

Agent roster consolidated and strengthened — the "weak / too many" problem fixed:
- **16 → 11 agents.** migration folded into **database-architect**; markup-specialist into **senior-frontend-developer**; the four near-identical module specialists (backend/frontend/retrieval/ingestion) into **one generic `module-specialist`** that reads its module's CLAUDE.md. Roster: orchestrator · chief-engineer · architect · database-architect · senior-backend-developer · senior-frontend-developer · project-manager · debugger · explorer · junior-executor · module-specialist.
- **Each agent now carries the named canonical principles of its discipline** (not a thin pointer): database-architect → SSOT/ACID/normalization/CAP-PACELC/expand-contract; senior-backend → SOLID/Demeter/Postel/fail-fast/12-factor/resilience; senior-frontend → WCAG/unidirectional-flow/SoC/progressive-enhancement/BEM-ITCSS; architect → SOLID/SSOT/Least-Astonishment/Conway/YAGNI/fitness-functions; debugger → 5-Whys/Occam/reproduce-first/bisection; PM → DORA/one-way-two-way-doors/WIP/INVEST; explorer/junior → map-first/flag-don't-guess/Boy-Scout.
- Skill gained the missing named laws (SSOT, Postel's Law, Law of Demeter, Least Astonishment, Conway, fail-fast, 5 Whys, Occam, one/two-way doors, expand-contract, WCAG). doctor roster + allowlist + INDEX updated; drift-guard green.

Next (pass 2, pending owner go): strategy 15 → ~7 and top-level docs 7 → 3.

## 1.4.4 — owner's philosophy preserved (full soul integrated)

The previously-empty `user_philosophy.md` arrived with content. Transferable orientations woven in (project-specific case details deliberately excluded — universal concepts only): skill §5 gains **architecture-leads-code-follows** as a governance principle (legacy code migrates to the target via Strangler-Fig; never bend the architecture to violations); §11 platform-thinking gains the **extension-point check**. The owner's standing **engineering philosophy + collaboration style** are preserved in the project's `memory/user_profile.md` (full-standards-not-partial · high abstractions · best-solution/root-cause · benchmark-against-the-best · plan-first · why≥what). 

## 1.4.3 — inherited engineering orientations (from a sibling project's soul)

Integrated transferable highest-standard orientations distilled from another of the owner's projects (a component-platform kit), keeping only the universal concepts (its stack-specific lessons were left out):
- Skill §11 — **standards of resolution** (the "done" bar = works + agnostic + ISP-clean + extensible + tested; **root-cause over symptom**, stated as root cause → standard → fix) and **platform-level thinking** (solve once as reusable power, balanced by YAGNI).
- Orchestrator — the **"who before how" reflex** ("I can" ≠ "I should"; judgment work routes to a senior).
These validated heavy overlap between the two systems (plan-before-implement, delegate-verbatim, read-before-edit, agnostic-core, architecture-leads were already present).

## 1.4.2 — agents hold standards, not case-state (transferable requirements)

Project agents carried transient case-specifics (version gates, named seams, debt-item codes, exact ports) that bound them to one moment and duplicated the module CLAUDE.md / project_debt. Rewrote all specialists + database-architect + senior-frontend to hold **highest standards as transferable concepts** (dependency direction, resilience, contracts-as-interfaces, pipe-and-filter, polyglot/idempotent data, i18n/runtime-config) and to **read the current specifics from the authoritative sources** (`<module>/CLAUDE.md` + `project_debt`) at runtime. The `module-specialist` template is now concept-first too, so new modules inherit the principle. Result: every agent works optimally in any situation, and there is no stale case-state in a prompt.

## 1.4.1 — full-body coherence pass (schema completeness)

Whole-system validation: 127 files cross-checked — INDEX covers every command/strategy/feedback/skill, allowlist ⊇ all agents, doctor checks the full roster, version coherent across VERSION/manifest/changelog, no dangling refs or orphans, all `NN`/`NN-A` cross-references resolve. One gap fixed: the schema now documents **every** manifest field (added `modules`, `shared_lib_root`, `$schema`) — the manifest↔schema contract is now complete.

## 1.4.0 — senior-concept deepening + craftsmanship catalog

- Skill gains **§11 Craftsmanship & refactoring**: code-smell taxonomy + Fowler refactoring catalog + clean-code rules (the code-level half of senior judgment that was missing).
- Every Opus senior now **auto-loads the standards skill** (added debugger + project-manager) and carries an explicit **highest-concept lens** naming the sections it wields (architect: full catalog; debugger: resilience/concurrency/consistency/observability; project-manager: delivery/DORA/risk-ordering).
- B.md ↔ 03 layering made **explicit** (B = compact always-on rule; 03 = full protocol; cross-referenced) — confirmed correctly layered, not merge-able; the only true format duplicate (Brief-quality) already consolidated to B.md. Feedback files deliberately NOT merged (per-trigger on-demand load = token economy).

## 1.3.1 — agent-as-lead protocol (talk to a specialist directly)

Documented the native Claude Code mechanism for running a specific agent as the lead: `@agent-<name>` (one task, orchestrator stays) and `claude --agent <name>` (the main session becomes that agent — prompt+tools+model, persists on resume). Same trade-off as the Opus-lead switch (no orchestration while a specialist leads) and same continuity rule (durable state, not the chat thread); hooks + refusal still bind. Doctrine in `01`; pointers in README + INDEX. Docs-only.

## 1.3.0 — /mode operating-mode switch

New `/mode` command + `.claude/session/mode` state: switch the whole team's posture in one word — **build** (default) · **plan** (design only, no edits) · **review** (scrutiny) · **strict** (max enforcement, reversible-first) · **fast** (minimal ceremony, reversible tasks). SessionStart injects the active mode every session; the orchestrator respects it. Binding invariant: a mode is a posture, never a bypass — no mode disables the hard guards (laws · Class-M · architecture · bloat · Intake Gate · refusal); `fast` cuts questions, never safety.

## 1.2.0 — canonical pass: agent-mirror drift guard + skill/DRY consolidation

- **Agent two-folder model made canonical + drift-proof.** Claude Code discovers only `.claude/agents/`, so active copies must live outside the kit; the kit holds the seeds. Role-agent project copies are now declared **verbatim mirrors**, tuned ones carry `tuned: true`, and **doctor flags any undeclared divergence** — killing the stale-agent class of bug. Rule documented in `KIT.md`.
- **DRY:** the "Brief quality" epilogue had three copies → canonical home is `B.md`; `03` and `03` now reference it.
- **Skill gaps filled from source chat:** §7 data (ACID/BASE · isolation levels · CAP/PACELC · consistency models), testing (TDD/BDD · test-doubles · the full type taxonomy · consumer-driven contracts), API (RFC 9457 Problem Details).
- **Orchestrator routing** made explicit: match every task to tier+agent via the rank matrix; ask rather than misroute.

## 1.1.0 — real slash commands (/bootstrap etc. now work)

Playbooks live in `kit/commands/` (canonical) but Claude Code only discovers slash commands in `.claude/commands/`. Added thin **shims** there for all 14 playbooks (`/bootstrap /audit /architecture /roadmap /layer /refactor /debt /review /close /board /collab /verify /upgrade /senior`) — each points to its canonical kit playbook, so `/name` works natively AND natural-language invocation still works. `/bootstrap` scaffolds the shims; doctor verifies them. Same kit/project pattern as agents and skills.

## 1.0.9 — Intake Gate v2 (clarify + propose-the-best)

The lead's gate is now six steps: Echo → **clarify-until-clear** (simple, jargon-free questions in the owner's language, as many rounds as needed — guessing forbidden) → standards pre-check with hard pause on violations → **propose the best approach/pattern for every stated intent** (architect supplies it for architectural ones) → journey naming → route. The lead never transcribes an intent into tasks without offering the best-known route first.

## 1.0.8 — journeys + repo structure standard

New `11-work-board.md`: situation→workflow map (new project · improve existing · refactor · feature · incident · DB change · architecture decision · collab · daily) with canonical output locations; the repo-root folder standard + hexagonal module layout; the guardrail stack summarized. Lead now names the journey before work and pauses on deviation. Doctor gains a repo-top structure check (`hygiene.repo_sanctioned_top`). Token rule reaffirmed: Quality → Learning → Tokens.

## 1.0.7 — /collab task-force protocol

New playbook: multi-senior collaboration on one problem (user + 2–4 agents chosen by lens). Card-anchored, one shared append-only scratch, round structure (analyze → verbatim synthesis with explicit agreements/conflicts → user decides), conflict rule from `09` §A, exit via ADR + brief distillation. Closes the gap where multi-agent collaboration had no choreography.

## 1.0.6 — skill: security + operations sections

`architecture-standards` skill gains §9 Security (OWASP/ASVS · STRIDE · OAuth2/OIDC · Zero Trust · secrets · supply chain/SBOM) and §10 Operations (observability pillars · SLI/SLO/error budgets · AKF scale cube · caching strategies · trunk-based/IaC/GitOps · FIRST tests · standards-as-code). Chief-engineer and senior-backend-developer get pointwise lens lines. Pure knowledge addition — loads on demand only.

## 1.0.5 — prevention layer (system hygiene)

New `hygiene` manifest section + four standing guards: **file-bloat hard block** (post-edit-laws blocks any edit leaving a file over limit×hard_factor — split, don't append; doctor reports soft-limit breaches) · **structure guard** (doctor checks `.claude/` against sanctioned dirs; new structural homes go through Intake Gate + architect proposal, never a silent mkdir) · **token-weight protocol** (on-demand loading discipline reaffirmed) · **Intake Gate extended to the user's structural plans** (wrong folders/architecture in the request itself → pause before work + best-quality counter-proposal). Doctrine: `09` §Prevention protocol.

## 1.0.4 — full team (rank matrix) + chief overseer

New agents: **chief-engineer** (Opus, the supreme all-seeing overseer — system-wide coherence + quality command, read-only) · **project-manager** (Opus — board/roadmap/DoD discipline) · **senior-backend-developer** + **senior-frontend-developer** (Opus — hard implementation after design, carrying the resilience/concurrency and state/a11y/CSS-architecture pattern sets pointwise from the standards skill) · **markup-specialist** (Sonnet, middle) · **junior-executor** (Haiku — bulk-to-spec, flags instead of guessing). `01` gains the Rank-matrix table (lead/oversight/senior/middle/junior as one body, depth-1 intact). Session token-log archives moved to `session/archive/`. Doctor verifies the full roster.

## 1.0.3 — work board (planning workspace) + Task Intake Gate

New: file-based kanban (`strategy/11-work-board.md` + `/board` playbook + `templates/work/`). Cards = stable files with status in frontmatter (no folder moves — git history and links survive); BOARD.md is a generated view; flow rules 1–7 binding (nothing starts off-board, planning playbooks emit cards, WIP ≤ 2, rejection needs a reason). Opt-in per project via `paths.work_dir` (drafted by default for new projects); `/bootstrap` scaffolds it, doctor verifies it.
New: **Task Intake Gate** on the lead — before executing ANY task (the user's included), a standards pre-check; a task that would violate laws/architecture or degrade a guarantee is stopped BEFORE work starts, with the violation named and a better alternative proposed; the user decides.

## 1.0.2 — model-agnostic lead (role ≠ model)

The orchestrator's frontmatter no longer pins `model:` — the lead inherits the session model. Default Sonnet (economy); `/model opus` upgrades the lead's reasoning for judgment-heavy sessions with **zero behavioral change**: routing, gates, mediation, refusal, depth-1, and Class-M→architect bind identically on either model. Doctrine updated (`01` swappable-lead rule, `01` Mode 2 — switching no longer trades away orchestration). Pure kit change; pull via `/upgrade`.

## 1.0.1 — Windows path-separator hardening (enforcement fix)

`pre-edit-gate.py` and `post-edit-laws.py` now normalize backslashes to forward slashes before matching path regexes/globs. Closes a Windows-only enforcement hole: a `file_path` with backslashes (e.g. `apps\…\db\migration\V95__x.sql`) previously slipped past the Class-M migration gate silently. `doctor.py`'s probe now uses a forward-slash path, so `/verify` reports the live-fire check correctly on Windows (was a false 38/39). Pure kit fix — no project changes; pull via `/upgrade`.

## 1.0.0 — initial release

Orchestration framework: decision-density routing (Sonnet/Opus/Haiku), mediator discipline, Class-M gates, enforcement hooks (session-start · pre-edit-gate · post-edit-laws · stop-check · token-log · selftest), playbooks, agent layer + per-module specialist generation, architecture-protection law patterns, architecture-standards skill, bootstrap + doctor.

---

# Project hardening history (from UPGRADE-NOTES.md)


> Project-specific: what was changed in THIS project's setup and why. The kit's own changelog lives at `.claude/kit/UPGRADE-NOTES.md`.

What changed, why, and the few items still needing the owner's decision.

## Done (no decision needed)

**Token / structure**
- `opus-brief.md`: 176→52 lines (−91%). §Last Session essays → `docs/layers/` pointers; "last 3 layers" → deltas. Read every task, so recurring saving.
- Root `CLAUDE.md`: DB P1–P7 + 18 antipatterns (2.6 KB) → `apps/ingestion-service/CLAUDE.md` (loads **on-demand**). Root −30% on every non-ingestion task. Quality safe: migrations are ingestion-only; `check-laws.sh` enforces globally.
- Owner architecture-quality note relocated from hot-path → `memory/project_debt.md` (verbatim).

**Mediator discipline** (`01` §Mediator Communication Discipline) — the weak link, fixed structurally:
- A. Faithful intake (Intake Echo before routing). B. Never distort **and** faithfully amplify (B.1 preserve / B.2 develop). C. Routing. D. Faithful back-relay. E. No silent decisions.
- Verbatim user-words now **default**, not opt-in (`feedback_verbatim_relay`); `B.md` makes Opus treat the verbatim block as ground truth.

**Living system**
- Pre-Work Gate: Class-M (mandatory Opus, no self-waive) vs Class-G; objective Opus-signals (breadth/irreversibility/under-spec/long-horizon/precision/non-obvious-debug).
- Opus = hunting dog + best thinker; **discovered-problem protocol** (dependency ordering: blocker→fix first; else note) + **fix-on-sight economy** (`03`, `06`). Principle: rework is the real token sink — quality and tokens don't conflict.

**Enforcement layer (NEW — the big one)** — `08-enforcement.md` + `.claude/kit/hooks/` + `settings.json`:
- SessionStart → inject §Current State (resume/compaction). Stop → §Current State ≤80 + token-log appended. PostToolUse → auto `check-laws.sh`. PreToolUse → Class-M gate detector. SessionEnd → token rollup (closes the measurement loop).
- Default posture WARN; flip to `exit 2` to hard-enforce (see file headers).

**Hygiene**
- Laws unioned to 11 in `CLAUDE.md` (canonical); `laws.md` + `07` now point there (was 3 drifted lists).
- Empty files filled: `02-layer-flow.md` (restored), `07-learning-system.md` (drafted; moved memory/→strategy for crisp memory(WHAT)/.claude(HOW) split), `settings.json` (hooks+perms).
- MEMORY/INDEX/WORKING-STRATEGY synced to 8 strategy files + hooks.

## NEEDS YOUR DECISION (left untouched / conservative on purpose)
1. **closed-items**: did `debt-2.4-k` fully close "V60 degradation tail" + "HttpRetrievalClient"? I removed them from opus-brief; confirm or I restore.
2. **opus-brief §Current State** internal inconsistency: "f,g,n pending" vs n complete elsewhere; `l`/`m` marked ✓ but no layer docs. Reconcile = your project-state call.
3. **DB scope (#1)**: DB rules ingestion-only + root pointer (my rec) vs keep global. Adjustable.
4. **Law union**: kept ALL 11 (nothing dropped). Drop any obsolete? Edit in `CLAUDE.md` only.
5. **Hook enforce vs warn**: default warn. Which to promote to `exit 2`?

## NOT DONE (deliberate — deserves its own careful pass)
- **Phase B mass de-dup**: V68 case study ×3, Decision-Inventory table ×3, Brief-Quality template ×3 still duplicated across `01`/`03`/`03`/`03-A`/`feedback_opus_brief_style`. Bundling 5 multi-file deletions into this pass risks breaking cross-refs — do it focused + verified next.
- **Gate 3** (phase retrospective) likely dormant — the mechanism for the owner's "layers don't harmonize" note. Run it on completed phases.
- **docs/layers / docs/learning / docs/decisions / drift.md** completeness — not in this archive; verify the trim's "detail lives in docs/layers" promise holds, and that the learning loop actually runs.

## Kit/Project split — portable framework (DONE)

Extracted a domain-literal-free `claude-kit/` (generic doctrine + hooks + feedback + INDEX + settings + `project.schema.json` + `KIT.md` + slot templates). Mechanism: `.claude/project.json` manifest — the ONLY place project specifics live. Hooks rewritten generic (read `class_m_triggers`/`law_patterns`/`resume_marker`/`code_globs` from the manifest via `_manifest.py`); doctrine leaks (B.md/01/03/05/07) genericized to point at `CLAUDE.md`/manifest. geostat is now `kit + project.json`. Validated: manifest passes `project.schema.json`; kit selftest 8/8 standalone; geostat selftest 8/8. You never edit a kit file — only `project.json` + slots.

## 01 split — Mediator Discipline → 01-A (DONE)

Mediator Communication Discipline (A–E, ~47 lines) extracted from `01` to `01-team-and-decisions.md` (loads only when Sonnet intakes a directive or relays agent↔user). `01` keeps a lean A–E map + pointer. Cross-refs (04/08/feedback_verbatim_relay) repointed to 01-A. 01: ~5000→~4169 tok (routing-only load now ~830 lighter); 01-A ~1230 tok selective. Win is mostly organizational (one-concept-one-file); token benefit is situational (saved on non-intake interactions, neutral on full intake).

## Phase B — one-body de-dup (DONE)

V68 case study + Decision-Inventory table collapsed to single canonical homes (`03-A §A.4–A.5`, template `04 §A.4`); `01` Decision-Inventory section (~31 lines) → lean pointer keeping only the routing framing it owns; `feedback_opus_brief_style` V68 narrative → pointer, unique "why self-test failed" insight kept. Third target (Brief-Quality template) was already consolidated (self-test→Decision-Inventory). DRY law now holds across the brief-writing path. 01: ~5280→~5000 tok (de-dup); remaining weight is legitimate operating-model doctrine (authority/parallelism/risk), not duplication.

## Operating model pass (owner's 17 requirements)

Encoded:
- **Authority ≠ orchestration** (`01`): Sonnet *runs* Opus (spawn/brief/parallel) but only the **user commands/overrules Opus's judgment** (#6/#7). Sonnet disagreeing → relays to user, never imposes.
- **Dynamic parallelism** (`01`): Sonnet decides fore/background + count; **depth=1** (spawned agent can't sub-spawn); parallel ≈ ~7× tokens → spent only where value>cost (#2/#5/#17). Never does Opus's judgment-work.
- **Shared-findings + trust asymmetry** (`05`): record-once/no-re-walk; Sonnet trusts the blackboard (net = Gate 2 + review), Opus verifies the *premise* (never blind) (#1/#3/#11/#10b).
- **Opus autonomy** (`01`+identity): refuses any step-backward/sub-standard task (#8). Hunting dog also surfaces **new-package need + systemic/design improvements** (`03`, #9/#10a).
- **File-system principles** (`MEMORY.md`): `.claude/`=operational vs `memory/`=durable truth (#15); minimal churn (#14); selective load (#16).
- Token accounting/archive (#12/#13): token-log + SessionEnd rollup hook + rotation policy.

Corrections flagged to owner (3): #6↔#17 contradiction (resolved via authority/orchestration split); one-level delegation limit; parallelism is a real ~7× cost tradeoff, not free. Refinement: "Sonnet trusts blindly" bounded by Gate 2 + review; Opus never blind.

## Architecture hole-closing pass (5)

- **#1 Stale-state** (structural): `session-start.py` now compares the brief's claimed last migration vs the repo's actual max migration → STALE warning on drift. No more confidently-wrong resume.
- **#2 Agent-failure recovery** (doctrine, `01`): detect crash/timeout/garbage → never silent-fill, retry-once-if-underspec, escalate-if-Class-M, log; failed slice fails its dependents.
- **#3 Parallel finding-conflict** (doctrine, `09` §A): contradictory parallel outputs → Sonnet surfaces (Opus arbitrates / user if split), never silently picks one.
- **#4 Hook reliability** (structural+doctrine): `hooks/selftest.py` (8/8 pass) + `08` reliability section — fail-open, fast-disable, never-block-on-hook-failure.
- **#5 Feedback-loop cadence** (doctrine, `02` Gate 3): phase retrospective now reviews token rollup + brief-quality trend → records in `06`/`project_debt`. Closes the half-loop.

Tradeoffs acknowledged (not holes): human-in-the-loop bottleneck (intended — owner wants control); doctrine versioning (minor — UPGRADE-NOTES is the changelog).

## Unified — kit vendored inside the project (DONE)

claude-kit is no longer a separate tree. It now lives at `.claude/kit/` (vendor as a git submodule in real use) — the project references it instead of copying. Generic files (strategy, commands playbooks, hooks, feedback team-laws, B.md, INDEX, schema, templates, KIT.md) moved under `.claude/kit/`; `memory/` is now project-truth only; project slots stay in `.claude/` (project.json, settings.json, context/, session/, strategy/03-A-examples.md, commands/dev.md + laws.md). All path references rewired (settings, INDEX, MEMORY, CLAUDE.md orientation, doctrine cross-refs); selftest 8/8 from the new location; 0 stale paths. One tree, no divergence: edit the kit once, every project gets it.
