# SYNTHESIS — Framework + Platform Verdict (two-lens deep review, 2026-07-15)

**Commissioned by:** owner ("look deeply at docs/architecture + ROADMAP; I don't want another circle; I want to SEE we're really building a framework-level AND platform-level system — its own UI, its own concepts, core to user").
**Method:** two independent deep reviews, different lenses, neither knew the other's answer. `architect` = framework/core (code-verified). `platform-architect` = platform/authoring-UI/concepts (benchmarked vs Builder.io / Form.io / JSON-Forms / Looker / Figma). Synthesis owned by the lead.

---

## THE VERDICT — both lenses, independently: **PARTIAL, converging — NOT circling**

Two minds, two lenses, one conclusion. That agreement is the strongest single signal in this document.

- The core **is a framework, not "an app with good structure"** — and it is reference-class at the substrate: the dependency arrow is a machine-enforced build gate (`eslint no-restricted-imports`), the engine has **zero structural Geostat leakage** (only comments), one containment grammar (ADR-041: ~9 parts → 4), and the honest `Cell{value,state,status}` seam **surpasses** Grafana (per-frame) and SDMX (OBS_STATUS) by carrying state per-cell and withholding confidential values before the sum.
- The authoring layer **is a genuine platform, not a Geostat app with a builder bolted on** — a registry-projected, special-case-free surface with **46 fitness tests machine-enforcing the canon**, which is *above* the Builder.io/Puck standard (they trust the schema author; this proves completeness).

## WHY IT IS NOT CIRCLING — evidence, not reassurance

**The object-model re-conception loop has genuinely ended.** That loop is what churned M0→M1→M2→M3→M4, `worldclass-authoring`, `deep-authorability`, `experience-architecture` (~13 specs). Every 2026-07-15 document (STUDY, CONCEPT, ROADMAP) **stands ON ADR-041/042 and refuses to re-open it.** Refusing to re-fork the substrate is the single most important correct decision in these docs.

**And the convergence is EXECUTING in code, not re-planned in prose:**
- PM-1 (honest-state `Cell` seam) **landed AND is adopted** — real consumers (`KpiStateCard`, `kpi.ts`, `kpi-preliminary.ts`), closes engine F1/F2/F7.
- Corpus migration **started** — 13 governed `metric` handles now in provisioning.

A re-conception loop produces new specs; this produced a landed engine seam *plus its consumers* on the real tenant.

## THE RESIDUAL "CIRCLE" — no longer concept; two concrete things

### 1. The proving machine is OFF (ROADMAP Stage 0) — **both lenses named this as the #1 structural hole, independently.**
`ci.yml` was stale (`@geostat/*` filters vs renamed `@statdash/*`) and self-admittedly never run; 18 DB-gated suites + 12 e2e + J1–J6 journey walks have **never executed in any gate**. Consequence: **"journey = unit of done" (Law 11 C4) — the entire circle-breaker — is unenforceable.** H1–H7 DoD ("each machine-verified") is circular against an un-running machine; `FF-CANVAS-NEVER-LIES` "bites" only when an agent runs it by hand.
> This is the mechanical cause of the owner's felt "we start architectures and they don't finish." Nothing holds the line while attention moves on.
- **Blocker = an owner door:** `gh` unauthenticated + no local Docker → the gate cannot be proven green from inside the repo. **Turn-key state:** config-correctness (card 0077) + the fresh-migrate **V33 hazard** (ADR-035) are the true remaining work; the door is a single `gh auth login` (or a Docker runner) away. **Reframe for the owner: CI is not "a lot of work to grind" — it is one key to turn, and it is the literal mechanism that ends the circle.**

### 2. Two un-named meta-laws — the concept forking ONE LEVEL ABOVE wherever it was just unified (the intellectual residue of the circle).
- **The Projector Law** — `everySurface(decl) = fold(applicable projectors)`. Written three times (Part port ADR-041 · Triprojection ADR-042 · Facet registry), named zero times. A new inspectable axis is today a fourth hand-written fold term, not a registration.
- **The Publishable Identity** — the "published thing" modelled ~5 ways (`SiteConfig`, `SiteManifest`, `ViewSnapshot`, `SnapshotEnvelope`, `page_version`) with no shared spine, on the axis (provenance) that most differentiates a national-statistics platform. AR-43/47/48 + W5/H3 would otherwise be three re-derivations of one identity.
- **Action taken:** both are being named NOW as `Proposed` ADRs (architect) — ADR-now / build-after-Stage-1, never opened as a new stratum before the gate runs.

## GENUINELY DIFFERENTIATED & PLATFORM-GRADE ALREADY

1. Executable dependency arrow + framework-agnostic engine (zero tenant leakage).
2. One containment grammar, residence-on-the-field (ahead of Builder.io/Sanity/Grafana).
3. Honest `Cell` value-envelope incl. confidential masking — no reference builder or BI tool ships cell-level suppression as a render state.
4. Registry-projected, special-case-free authoring surface, machine-enforced (above Builder.io/Puck).
5. Governed-noun binding + Bounded-Element contextual selection + the Placement port (Figma's contextual discipline brought to governed data).

## ASPIRATIONAL-IN-DOCS-ONLY (the honest incompleteness)

1. **EXPLAIN projection (H3)** — cite/methodology/lineage/JSON-LD/a11y narration. **Zero code.** The crown differentiator for an NSO, the market's empty cell.
2. **PLANE axis** (author/steward/system) — 3 doc files, 0 code files.
3. **Corpus unevenly migrated** — 13 KPI handles governed, but **18 chart/table DataSpecs still raw `type:query`**. "W1 ~60%" counts seams built, not surface made true; the KPI slice is honest, charts/tables still resolve through the lying path.
4. **Lineage metric-edge** missing in `compilePage.ts` `SRC` — "why is this number" is a scan, not a graph read.

## WHERE THE ROADMAP FOOLS ITSELF (stated for the owner)

- Stage-0 is on the critical path but drawn as a footnote — nothing in Stage 1 is *evidence* until Stage 0 executes; the hero-checklist is unfalsifiable until then. Should be said at the top, not in a footnote.
- "Data first, always" (Law 11 C1) has **no machine floor** — `FF-DATA-BOUNDED` is referenced as if it exists (it does not) and there are **zero config↔stats foreign keys**; a published page can silently point at a retired cube. The strongest-worded canon is the least-enforced.

---

## THE RECOMMENDATION (owner's call)

**You ARE building a real framework + platform, core to user, and you are no longer circling.** The substrate is reference-class. The residual circle is two concrete, bounded things — not architecture.

1. **Turn the CI key** (owner door — `gh auth` or Docker). One action; it ends the circle by making "done" machine-held, not testimony. *(Prepared turn-key; V33 hazard flagged.)*
2. **Name the two meta-laws as ADRs** — done now (Proposed), so they are never re-conceived.
3. **Finish the corpus migration** — 18 chart/table specs onto governed handles (the heart of W2).

Everything else on the ROADMAP is sound and sequenced. Hold WIP=1; close each wave on a journey walked live; keep the gate on once lit.
