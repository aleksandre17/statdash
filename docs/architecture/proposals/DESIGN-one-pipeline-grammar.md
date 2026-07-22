# DESIGN — ONE-PIPE: the one pipeline grammar (the two dialects unified)

**Status:** Proposed (lead-authored, 2026-07-23 night — owner-mandated: «ორი პაიპლაინის გაერთიანება, უმაღლეს არქიტექტურამდე, საერთაშორისო კონცეფციებამდე და გრამატიკებამდე»)
**Author:** the lead (personal pen, per owner directive), on grounding: `RECON-two-dialect-capability-map.md` (facts) · card 0112 §R4 (dialect-provenance forensics) · `DESIGN-0113-canonical-encoding-grammar.md` (encoding) · ADR-046 (the spine + W-P5 strangler) · ADR-051/0104 (the workspace + capability-parity law).
**Supersedes nothing; completes:** ADR-046's expand→contract arc (this IS the contract design). Subsumes DU4 remainder + DU5 on card 0104.

## 1. Thesis

The platform holds ONE data semantics expressed in TWO grammars at rest: the `query`
convenience dialect (ObsQuery + optional tail) and the `pipeline` canonical spine
(`source` head + pure verb tail). The engine already resolves both through one truth
(`desugar()` → `interpretSpec`; consumers dialect-agnostic by construction, recon §4) —
the duality survives only **at rest and at the authoring surface**, where it leaks as
real harm: the R4 incident (stored `query` shown against the lowered assembly with no
dialect marker — the owner correctly saw "the JSON doesn't match the constructor").

The unification: **one grammar at rest — the pipeline spine; every other spec kind
becomes an authoring projection of it.** The query dialect's functionality moves, whole,
into its one home: the ObsQuery becomes (verbatim, byte-identical) the spine's `source`
head; the simple "one-jump" authoring form survives as a VIEW that reads and writes the
spine losslessly. One model, two zooms — the Unification Law applied to data specs.

The international grammar this lands on (Law 4, adopted whole, best form):

| Concept | Source standard | Where it lands |
|---|---|---|
| Source-first applied-steps spine | **Power Query (M)** | `PipelineSpec` — already its named model (`data-spec.ts:289`) |
| Verb canon (7 verbs) | **dplyr / PRQL / Arquero** | step registry categories: get=`from`, filter=`where/filter`, aggregate=`summarize/aggregate`, derive=`mutate/derive`, reshape=`pivot_longer/select/rename`, combine=`join/lookup`, sort=`arrange/sort` — correspondence documented machine-readably on the registry (§4·D2) |
| Head query language | **SDMX (ISO 17369)** | `ObsQuery` verbatim as the steward `source` head — no translation layer, ever |
| Governed head | **dbt-SL / MetricFlow / Cube** | the `source(metrics)` governed variant (already named, `data-spec.ts:315`) |
| Cell-set read | **OLAP/MDX tuple set** | the NEW `cells` head variant (§4·D3) — the Add.5 blocker, designed |
| Encoding | **GoG/ggplot roles × Vega-Lite field-defs** | DESIGN-0113, unchanged; ENC-0 precedes the E2 editor |
| Boundary tolerance | **Postel's law** | sugar dialects accepted at the write boundary forever; normalized on write (§4·D6) |

## 2. Ground truth (from the recon — load-bearing facts)

9 public kinds + internal `point-series`. Fold status: `query`/`transform`/`pivot`
folded + **live-switched**; `timeseries`/single-code `growth` folded + proven + **not
live-switched** (deliberate, `desugar.ts:154-161`); `ratio-list`/`row-list`/multi-code
`growth` **blocked** on the unspecified Add.5 head extension; `metric` already head-shaped;
`pipeline` is the target. 20 ops / 7 verbs, zero uncategorized (FF-VERB-COVERAGE). The
live corpus is monomorphic **18/18 `query`** — fold proofs for the other kinds ride
synthetic fixtures (recon flag #2). Two desugar scopes exist (live `desugar()` narrower
than `desugarToPipeline` — flag #3). `registerStepEditor` is aspirational prose, not a
registry (flag #1). Consumers: all render targets funnel through `interpretSpec`; the
one dialect-literal is `blend`'s secondary read (react layer, Law-3 boundary).

## 3. The disease, named

Not missing capability — **plurality at rest**. Seven sugar kinds are stored as if they
were seven grammars; the strangler's mid-state (stored `query`, assembled `pipeline`)
reaches the author unlabeled (R4); the fold scope differs by call site; the corpus can
prove `query` equivalence only. Every future feature (lineage, diffing, versioning,
export provenance, the E2 editor) pays the N-dialect tax at rest — or we contract now.

## 4. The design — named decisions

**D1 — One grammar at rest.** Post-migration (§5·U3), every stored DataSpec is
`type:'pipeline'`. The eight other public kinds cease to be storage forms and become
**authoring projections**: accepted at the write boundary forever (Postel), lowered by
the validator on write (normalize-on-write; the API's V-schema gains the lowering step),
served always as spine. The discriminant manifest keeps them as *input* grammar; the
*rest* grammar is one. GET serves spine; PUT accepts anything the manifest names.

**D2 — The verb canon, documented on the registry.** The 7-verb palette is already a
projection of `StepCategory`. Add the international correspondence (dplyr/PRQL/Arquero
names per op) as a machine-readable field on the registry entry (the 0113 §6 pattern —
teachable, exportable to the E2 editor's help plane). Kill recon flag #1 by re-scoping
the `registerStepEditor` comment to name `specEditorRegistry` (the real seam) and the
E2a plan explicitly — no phantom registry referenced in prose.

**D3 — The `cells` head variant (Add.5, now designed at decision level).** The blocker
for `ratio-list`/`row-list`/multi-code `growth` is that a value-cell head enumerates ONE
coordinate axis; those kinds read a **set of heterogeneous cells** (per-row code, denom,
negate/pctOf/isTotal, store-meta enrichment). International shape: an **OLAP/MDX tuple
set** — a declared list of point-reads. The head variant:
`{ op:'source', cells: [{ code, denom?, coords?, meta? }...], dataSource?, clamp? }` —
each cell a declared tuple; per-cell arithmetic (`negate`, `pctOf`, ratio×100) and
label/color enrichment express as ORDINARY tail verbs (`derive`, `lookup`) emitted by
the fold — never head magic. The fold of all three kinds becomes mechanical; the
FF-ALL-KINDS-SHAPED allowlist EMPTIES. (Byte-level schema + fold fitness = the U2
slice's contract; corpus: synthetic per-kind + the live pages after U3.)

**D4 — One desugar scope.** After each fold is live-proven, the live `desugar()` switch
widens to it (W-P5b: `timeseries` + single-code `growth` first — the fold already exists
and is byte-proven; the flip is gated on FF-PIPELINE-EQUIV + the render suite + a live
walk). End state: `desugar()` ≡ `desugarToPipeline` for every folded kind; the bespoke
resolvers (`TimeseriesResolver`, `GrowthResolver`, `RatioListResolver`, `RowListResolver`)
retire under the capability-parity gate (survivor ⊇ removed, enumerated per resolver —
honest-null semantics, warm-requirement identity, store-meta enrichment all named in the
parity list). Strangler-Fig: nothing retires before its FF corpus is green AND live-walked.

**D5 — Dialect honesty during the transition (R4's kill-design, adopted whole).**
`storedType` threaded through `toWorkbenchModel`; the steward pane shows the stored
artifact byte-true FIRST, the assembly as a labeled «lowered — engine desugarToPipeline»
projection; `FF-ROUNDTRIP-CANONICAL` (open→no-edit→emit ≡ identity for canonical specs)
and `FF-DIALECT-DECLARED` pin it. This ships FIRST (§5·U0) — the surface must stop lying
before the migration makes the marker vestigial.

**D6 — The migration (the ⛔ DU5 arc, made concrete).** Expand (done: the spine + folds)
→ **emission flip** (the workbench + editors already emit spine on edit; the validator
lowers on write — new writes are monomorphic) → **one-time governed corpus rewrite**:
the 18 stored `query` specs (+ any DB-resident authored specs — the recon's flagged
access wall MUST be closed by reading the live `/api/config/data-specs` first) rewritten
via `desugarToPipeline`, with (a) full backup (the `work/data-spec-backups/` pattern),
(b) `pipeline-equiv.baseline.json` requirements byte-parity re-derived and identical,
(c) FF-PIPELINE-EQUIV full corpus green, (d) a live J-walk of every affected page.
**This rewrite is the one genuine one-way door → owner-door, fired only authorized** —
everything before and after it is reversible. → **Contract**: bespoke resolvers retire
(D4), the simple forms live on as views (D8).

**D7 — Encoding rides 0113 unchanged.** ENC-0 (types + registry + normalize + byte-fence)
precedes the E2 `encoding.edit` editor; this design adds no encoding decision and defers
entirely to the accepted grammar. Sequencing interleaves (§5).

**D8 — The simple view is guaranteed (the owner's «query-ს ფუნქციონალი სად წავა?»).**
Shape-detection projects a spine spec back to its simple form when it matches a sugar
shape (a `source(query)` head + empty tail IS the one-jump query form; the timeseries/
growth shapes are recognizable folds — Power Query's applied-steps vs advanced-editor
duality; VL's shorthand↔long-form). The simple editor opens the simple view; adding a
step escalates zoom, never converts or forks the artifact. `FF-SIMPLE-VIEW-ROUNDTRIP`:
simple-view edit → emit → reopen ≡ same simple view (lossless two-zoom). This also
dissolves the surfaced "one-way pipeline convert" elevation finding — there is nothing
to convert when both zooms read one artifact.

## 5. Sequencing (WIP=1; each slice gated + live-walked)

| Slice | Content | Gate |
|---|---|---|
| **U0** (tonight, lead's hands) | D5 dialect honesty: `storedType` thread + stored-pane byte-true + labeled assembly + FF-ROUNDTRIP-CANONICAL + FF-DIALECT-DECLARED | panel suite + live pane check |
| **ENC-0** (queued [3], unchanged) | 0113 first slice — before any E2 editor work | its own FFs |
| **U1** | W-P5b live-switch: `timeseries` + single-code `growth` into the live `desugar()` | FF-PIPELINE-EQUIV + FULL render suites + live walk of value-cell pages |
| **U2** | D3 `cells` head + the three remaining folds; FF-ALL-KINDS-SHAPED allowlist → ∅ | new fold corpus + parity |
| **U3 ⛔** | D6 governed corpus rewrite (owner-door) + validator normalize-on-write | backup + baseline byte-parity + full corpus + J-walk every page |
| **U4** | D4 contract: bespoke resolvers retire (capability-parity enumerations) + D8 simple views + D2 registry docs | parity gates + FF-SIMPLE-VIEW-ROUNDTRIP |

Board mapping: U1≈DU4-remainder(e), U2≈Add.5+DU4c/d, U3+U4≈DU5 — card 0104's queue
renames to these; E2a (step-contract editor machinery) builds on the post-U1 world.

## 6. Rejected alternatives

1. **Two dialects at rest forever** (maximal Postel): permanent N-grammar tax on every
   future consumer; the R4 lie class survives structurally. Rejected — the strangler was
   always meant to contract.
2. **Kill the sugar kinds at the boundary too** (pipeline-only PUT): hostile to authoring
   and to config hand-writers; violates Postel and the simple-first canon (P-OFFER).
   Rejected — input dialects are free; REST dialects are what cost.
3. **Adopt Vega-Lite's transform array verbatim as the spine**: loses the store-aware
   typed head (governed/steward/inline/cells — our Law-3/Law-5 boundary) and SDMX-verbatim
   queries; VL transforms assume the data is already loaded. Rejected (same reasoning as
   0113's VL-verbatim rejection — adopt the grammar's best form, not its dependency).
4. **Migrate now, design `cells` later** (partial contract): leaves ratio/row-list stored
   in sugar → two grammars at rest indefinitely = the disease kept. Rejected; U2 precedes U3.

## 7. Fitness functions (machine-held invariants)

Existing, retained: FF-PIPELINE-EQUIV (rows + requirements/corpus) · FF-DESUGAR-EQUIV ·
FF-BIND-PARITY · FF-VERB-COVERAGE · FF-ROLE-COVERAGE · FF-PROMOTE-ROUNDTRIP ·
FF-ALL-KINDS-SHAPED (its allowlist must EMPTY by U2 and is then forbidden to regrow).
New: **FF-ROUNDTRIP-CANONICAL** · **FF-DIALECT-DECLARED** (both U0) ·
**FF-SIMPLE-VIEW-ROUNDTRIP** (U4) · **FF-ONE-DIALECT-AT-REST** (post-U3: every spec at
rest — provisioning + live config — is `type:'pipeline'`; a sugar type at rest = red).

## 8. Owner paragraph (ქართულად)

*ორი პაიპლაინი ერთი ხდება — ისე, რომ არაფერი იკარგება. query-ის ფუნქციონალი მთლიანად
გადადის ერთ სახლში: შენახვისას ის ხდება პაიპლაინის პირველი საფეხური («წყარო» —
ბაიტ-ბაიტ იგივე მოთხოვნა), ხოლო ინტერფეისში რჩება იგივე მარტივი ფორმა, რომელიც
ქვემოთ კანონიკურ ჩანაწერს წერს. მარტივი ავტორისთვის არაფერი რთულდება; ძლიერი
ავტორი იმავე ობიექტზე საფეხურებს აშენებს — გადაკეთების გარეშე. ეს აშენებულია იმ
გრამატიკებზე, რომლებზეც მსოფლიო დგას: Power Query-ის «წყარო → ნაბიჯები», dplyr/PRQL-ის
შვიდი ზმნა, SDMX-ის მოთხოვნა, dbt/Cube-ის მართული მეტრიკა, Vega-Lite-ის კოდირება.
გადამწყვეტი ერთი შეუქცევადი ნაბიჯი — შენახული სპეცების ერთჯერადი გადაწერა — მხოლოდ
შენი ნებართვით მოხდება, სრული backup-ით და ყველა გვერდის ცოცხალი შემოწმებით.*
