# CONCEPT — The Power of the Core: Conservation of Declared Truth

**Author:** the lead (Fable), personal synthesis of the five-discipline deep expedition (owner directive 2026-07-15: "go in with every discipline's skill; come out with the highest-structure, highest-concept plan; see what is not visible").
**Inputs (read them for depth — this is the convergence, not a summary):**
`docs/architecture/audit/DEEP-2026-07-15-platform-concept.md` · `DEEP-2026-07-15-system-architecture.md` · `DEEP-2026-07-15-engine-core.md` · `DEEP-2026-07-15-data-plane.md` · `DEEP-2026-07-15-coherence.md`
**Stands on:** STUDY-authoring-canon-circle-break (AR-52, Law 11) — this document is its conceptual ceiling, not its replacement.

---

## 1. The convergence — five independent lenses found ONE wound

Nobody coordinated these findings; each lens hit the same shape from its own side:

- **Platform lens:** the declaration models an element's *identity* but not its *condition* (state) or *audience* (plane); provenance is fully declared but projected only to export. "Every surface is a projection" is ~55–60% real.
- **System lens:** Parts and Facets are secretly ONE unnamed projection engine; "a published thing" is modelled FIVE ways with no shared identity/version/lineage spine; the unifying law was written three times and never named.
- **Engine lens:** the engine is *stronger than the product can reach* — it computes honesty and lineage, then **discards them at three seams** (`storeVal ?? 0` collapses genuine-0/no-data/unbound/loading into `0`; the reactive graph has no `metric:` edge so editing a definition invalidates nothing; confidential `c` values are never masked).
- **Data lens:** the governance layer is the least-governed object in the DB (catalog = unvalidated, unversioned blob); ZERO foreign keys cross config↔stats (a published page can point at a retired cube, silently); the published pixel is a lineage island.
- **Coherence lens:** there is **no executing verification** — the only CI declares itself never-executed and filters dead package names; 18 DB-gated suites have never run; 12 e2e specs are in no workflow; the dominant disease is *"ship the mechanism, gate-lock it, defer adoption into invisibility"* (corpus `metric-ref` count = **0** while three registries say metric-first is "BUILT/LIVE").

**The one wound, named:**

> **The declaration carries the truth; the system loses it on the way to every consumer.**
> Truth is lost at four gates: the **engine** discards computed truth at interpret seams · the **surfaces** cannot project undeclared axes (state, audience) and never took the reader-facing projection (explain/cite) · the **storage** holds no referential truth between its two planes and no lineage to the pixel · the **process** loses verified truth over time (no executing gate, claim-vs-is drift, adoption deferred into invisibility).

## 2. The core concept at 100% — Conservation of Declared Truth

The platform's maximal form is NOT more power — every lens independently refused new machinery (the engine is already *ahead of its consumers*). It is a **conservation law**:

> **ONE declaration — whose meaning, condition, audience, and lineage are CONSERVED end-to-end: engine → projection → storage → reader → process.**
> A number that reaches a reader can always answer: *what am I* (semantics), *am I real* (state — never a fake 0), *who may see me how* (plane/confidentiality), *where do I come from* (lineage to the release), *and who verified all of that, when* (an executing gate).

That is the un-copyable quadrant made concrete: Looker/Cube-class semantics × Webflow/Figma-class authoring × **ONS/Eurostat-grade truth conservation that neither class ships**. Every rot-item found today — the lying canvas, the leaking inspector, the unbound-zero, the unmasked confidential cell, the retired-cube reference, the phantom CI — is the SAME event: a truth the system already knew, lost at a gate.

## 3. The four conservation axes (the target, per gate)

| Gate | Conserved by | Grounding (study PMs) |
|---|---|---|
| **G1 Engine** | the honest-cell seam: `Cell{value, state}` (`ok·no-data·unbound·loading·error·masked`), decided BEFORE formatting; one `metric:` edge in the reactive graph → lineage & invalidation become reads; masking enforced at the cell, not the badge | engine PM-1/PM-2 + F7 |
| **G2 Projection** | two new declared axes on the ONE contract — **STATE** and **PLANE** — projected generically by every surface; the reader-facing **EXPLAIN projection** (cite · methodology · narrative · JSON-LD) as the crown consumer of conserved provenance | platform PM-B/PM-A; system "Projector" meta-model named as doctrine |
| **G3 Storage** | write-time catalog validation now; ONE `Publishable` identity (page/version/snapshot/embed/release) with `release_id` stamped to the pixel; a config↔stats integrity sweep until the relational catalog door is genuinely needed | data PM-1/PM-3/PM-4 + system PM2 (design-now, build-on-W5) |
| **G4 Process** | **Tier-0: the gate RUNS** — resurrect CI (fix dead `@geostat/*` filters, execute DB-gated + e2e suites on push); adoption meta-gates that make "mechanism without corpus consumer" a RED build (`FF-DATA-BOUNDED` + corpus-adoption FF); one truth-register (the five status vocabularies collapse into a projected SSOT) | coherence PM-1/PM-2/PM-3 |

## 4. How it lands WITHOUT becoming the 13th stratum (binding sequence)

The conservation law does not add waves — it **hardens the existing ones** and sets the horizon after W5. WIP=1 stands.

- **Tier-0 (immediate, hours, not a stratum — the floor under everything): resurrect the executing gate.** Fix `ci.yml` package filters, make unit+lint+tsc run on push, then wire `DATABASE_URL` so the 18 dark suites and the e2e specs execute. Until this lands, every future "green" is testimony, not evidence. *(The one item that must not wait for its wave.)*
- **W1 (in flight)** consumes engine PM-1 (the `Cell` honest-state seam — designed, additive, reversible) instead of a render-side workaround; confidential **masking (F7)** rides the same seam (it is the same cell-state family). No scope change — this is W1's root done at the true root.
- **W2** gains its missing floor: `FF-DATA-BOUNDED` + the corpus-adoption meta-FF (the build is RED until the shipped corpus actually references metrics — kills "BUILT with zero consumers" for good) + the write-time catalog validator + catalog-mutation audit events (data PM-1/PM-5) + the one `metric:` graph edge (engine PM-2 — makes steward edits live-correct).
- **W3** projects the **PLANE axis from the declaration** (not per-surface logic) — platform PM-B is the contract W3 builds from, as designed.
- **W5** builds publish on the **`Publishable` unified identity** (design the artifact spine now — system PM2 + data PM-3; build it as W5's substrate; stamp `release_id` to snapshots there).
- **Doctrine now (free, no build):** name the **Projector meta-model** ("the Declaration and its Projectors") as the platform's stated law-of-form; fence meta-circularity (the Studio shell is deliberately NOT dogfooded — a fence, not an accident); BOARD/registry truth-registers collapse into one projected status SSOT during normal curation.
- **Horizon (post-W5, one at a time, each with a real consumer):** the **EXPLAIN projection** (platform PM-A — the reader-facing crown) → catalog blob→relational (expand-contract, on first real governance need) → `@statdash/declare` SDK (on a real second consumer) → templates as semantic projections → dialect collapse (⛔ gate as specced).

## 5. Refused (with all five lenses' authority)

New engine power before consumers catch up (the disease is *ahead-of-consumers*) · a separate narrative/citation subsystem (EXPLAIN must be a projection) · a parallel lineage store (keep derivable-view discipline) · another object-model reform · a 6th concurrent stratum · treating any existing "BUILT/VERIFIED" as evidence until Tier-0 runs · big-bang catalog migration · dissolving the governance lens.

## 6. Triage ledger (surfaced findings → owner-visible, none lost)

**P0 (folded into Tier-0/W1/W2 above):** phantom CI · unbound-zero seam · confidential values unmasked (F7 — live integrity hole) · catalog blind-write · corpus metric adoption = 0.
**P1 (designed-now/build-on-wave):** Publishable identity (W5) · plane axis (W3) · config↔stats sweep (W2/W5) · self-sealing dead-code class (reachability meta-FF, W4 rides the delete).
**P2 (horizon, registered):** EXPLAIN projection · Projector meta-model build · SDK · templates-as-projections · relational catalog · `PropFieldType` de-fork (trigger: 5th rich field) · AR-47 pulled one notch before non-dev authors arrive.

**Owner doors in this document:** (1) bless the conservation law as the platform's stated core concept (registry AR-53); (2) GO for Tier-0 CI resurrection immediately (hours, not a stratum); (3) everything else rides the already-blessed W1–W5 + horizon discipline.
