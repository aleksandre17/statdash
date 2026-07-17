# GUARDRAILS — the insurance architecture (what protects the platform from collapse, overload, and damage — and repairs it when hit)

**Owner mandate (2026-07-15):** "something must INSURE the whole architecture — against collapse, against overload, against damage; and when damaged, it gets repaired."
**The model:** defense-in-depth in four rings — **Prevention** (damage can't enter) → **Detection** (damage that enters is caught) → **Containment** (caught or not, blast radius is bounded) → **Recovery** (anything that lands is reversible). Every guard below is MACHINE-held; vigilance is never the mechanism (Law: "held by machines, not by hope").

---

## Ring 1 — PREVENTION (it can't get in)

| Guard | Holds | Home |
|---|---|---|
| The 11 laws + module laws | privileged types/dims, logic-in-config, arrow violations, canon breaches | `CLAUDE.md`, `packages/CLAUDE.md`, enforced by `kit/hooks/{pre-edit-gate,post-edit-laws}.py` |
| Dependency-arrow build gate | a layer can never import against the arrow | `eslint no-restricted-imports` (`platform/eslint.config.js`) — build-failing |
| Type system + contracts package | wire/shape drift caught at compile | `tsc -b`, `@statdash/contracts` innermost |
| Bloat ceilings | god-files can't grow (400-line hard ceiling class) | post-edit hook |
| Class-M risk gate | irreversible moves (migrations, public-API, one-way flips) get the risk protocol FIRST | `kit/strategy/09-risk.md` + agent Duty Orders |
| Work-protection discipline | parallel agents can't clobber each other; `git add -A` forbidden (owner deletions in tree) | kit doctrine + worktree isolation |
| WIP=1 + stage gates | portfolio collapse (12 open strata) structurally can't recur | ROADMAP + BOARD register rule |
| Governance lens | ungoverned data definitions can't enter the semantic layer | role-lens + `FF-AUTHOR-NO-QUERY` (write-time catalog validator lands in W2) |

## Ring 2 — DETECTION (if it gets in, it's caught)

| Guard | Holds | Home |
|---|---|---|
| The fitness ecology (~223 FFs) | every accepted invariant is an executable test: ADR-041/042 suites (`FF-ONE-PART-GRAMMAR`, `FF-RESIDENCE-AT-FIELD`, `FF-NO-EXTERNAL-SPECIAL-CASE`…), canon gates (`FF-CANVAS-NEVER-LIES`…), parity/leak/a11y gates | `*.fitness.test.ts` across packages/apps |
| Bite-proof discipline | a gate ships only after being seen RED on the real defect (no vacuous greens) | DoD rule (kit + Law 11 practice) |
| Guard-of-guards | the hooks themselves are self-tested (32/32); a broken guard is itself caught | `kit/hooks/selftest.py` |
| Working-tree loss sentinel | mass deletions/phantom wipes flagged at session boundary + pre-bash | `_worktree.py` hooks (proven: 451-file wipe recovered) |
| Memory-home guard | the knowledge base can't silently rot/scatter (hardened 2026-07-15: root from `__file__`, phantom-home class killed) | `kit/hooks/memory-home-guard.py` |
| Perf regression guards | overload/pathology in hot paths caught as a failing test (e.g. Part-port enumeration linearity) | perf fitness tests; G3.x request-volume hardening rides W1 |
| Journey walks J1–J6 | the FELT product is verified as a user, live, per wave — the class jsdom can't see | `FF-JOURNEY-*` (born with each wave) |
| **⚠️ THE KEYSTONE — executing CI (Stage-0)** | **all of the above runs CONTINUOUSLY on every push** — today every gate is manual; a red commit is caught by an agent's memory, not by a machine. Until Stage-0 lands, this table is armor that must be put on by hand | `ci.yml` — resurrect (dead `@geostat/*` filters), wire `DATABASE_URL` (18 dark suites) + e2e + journey walks. **First item of the ROADMAP, owner GO pending** |

## Ring 3 — CONTAINMENT (blast radius is bounded by construction)

- **The arrow** — a fault in an outer layer cannot corrupt an inner one (contracts←expr←core←charts←react←plugins←apps).
- **Bounded elements** — a broken element breaks itself; the generic mechanism (renderer/inspector/port) reads declarations and survives (`NodeErrorBoundary` fail-soft per node; fail-soft chrome AR-24).
- **Expand-contract everywhere** — the old world keeps running until the new one is proven (live parity gates before any CONTRACT step); one-way doors carry a git-tag revert-net + on-record notice.
- **Three isolated environments** — dev (:3013) / staging / prod on separate networks; agents touch dev; prod moves only through the deploy runbook.
- **Registry-first knowledge** — a lost idea/finding is a containment failure too: registry + triage ledger guarantee nothing surfaced evaporates.

## Ring 4 — RECOVERY (when damage lands anyway, it is repaired)

- **Git is the time machine:** one commit per increment; every wave reversible until its flagged flip; recovery PROVEN twice in production of this repo (the 451-file phantom wipe; the memory-tree phantom relocation — both fully restored same-session).
- **The data plane re-derives:** bronze blobs are immutable + content-hashed → silver/gold are RE-COMPUTABLE; SCD-2 + vintage-as-release mean history is never overwritten; append-only `audit_log` with an immutability trigger; provisioning is idempotent (re-run = converge).
- **Deploy rollback:** per-service image rollback in the kit driver + server-side clone reset; DB backup discipline per the live-deploy runbook (backup before irreversible server ops).
- **Repair is root-cause by law:** a recovered symptom always gets its class-killing guard added to Ring 1/2 (this file grows with every incident — an incident that doesn't leave a new guard behind is only half-repaired).

---

## The honest gaps (named, owned — insurance is never "done")
1. **Stage-0 CI** — the keystone; without it Rings 1–2 are manual armor. *(Owner GO pending; hours.)*
2. **Scheduled live sentinel** — after Stage-1, journey walks run on a schedule against dev (catches environment rot, not just commit rot). *(Fold into Stage-0's pipeline as a nightly job.)*
3. **Config↔stats referential sweep** — a published page pointing at a retired cube is currently undetectable at runtime (data-plane study I-2). *(W2/W5 per CONCEPT-power-of-the-core.)*
4. **Reachability meta-FF** — the self-sealing dead-code class (a fitness keeping its own orphan alive). *(Rides W4's sweep.)*
5. **Adoption meta-gates** — "mechanism without a consumer" becomes a RED build (`FF-DATA-BOUNDED` + corpus gates). *(W2.)*

**Maintenance law:** every new invariant → a Ring-2 gate; every incident → a post-mortem line here + a new guard; every one-way door → a Ring-4 revert-net BEFORE the flip. The lead audits this file at every stage close.
