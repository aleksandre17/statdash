# DESIGN — The Authoring Surface, Finished: three zooms over one artifact

**Status:** Proposed (lead-authored, 2026-07-23 morning — owner-mandated: «საუკეთესო UI, მარტივი და უძლიერესი, ისე რომ არაპროფესიონალმა შეძლოს თავისი ფანტაზიების განხორციელება — საერთაშორისო კონცეფციებით, არქიტექტურით, კანონიკით»).
**Author:** the lead (personal pen), on grounding: authoring-surface recon 2026-07-23 (explorer — surface map, capability-parity enumeration, post-U3 dead-branch audit, live glance) · reference-class authoring-UX brief 2026-07-23 (platform-architect — Power Query / Metabase-notebook / Retool / Grafana / Looker mechanics + 10 ranked moves).
**Completes:** `DESIGN-one-pipeline-grammar.md` §D8+U4 (the authoring half of the contract). **Extends:** `SPEC-worldclass-authoring-ui.md` (Summary Corollary + Stage contract — this design is their data-spec instantiation) · `DESIGN-0113-canonical-encoding-grammar.md` (encoding rides it unchanged) · ADR-052/E0 lifecycle (draft→publish→versions→validated PUT — **already built and live-walked 8/8; this design adds NO new persistence model**).
**Board:** card `work/items/0104` — this subsumes the U4 authoring half, E2a, and UX-backlog items #2/#5 (item #6 draft/publish = E0, shipped).

## 1. Thesis

ONE-PIPE made the grammar one at rest; the authoring surface is its visible payoff — and
today that payoff is unfinished: a native `pipeline` gets raw JSON as its "advanced" story,
an empty Type picker that reads as an unanswered question, a rail whose step-identity is
drowned by an inline metric catalog, and no simple view at all (D8 is green-field in code).

The finish: **three concentric zooms over ONE artifact — escalation changes the lens,
never the artifact.**

| Zoom | Surface | Reference | Audience |
|---|---|---|---|
| **0 — Element popover** | basic ops ON the canvas element (measure · filter · sort · columns), canvas stays visible | Airtable/Notion toolbar chips; the Summary Corollary | every author |
| **1 — Workbench step-builder** | Source-as-step-0 + the 7-verb applied-steps list, per-step preview | Power Query applied steps; Metabase notebook | the ambitious author |
| **2 — Canonical form** | the stored artifact byte-true, editable, round-trip guaranteed | PQ Advanced Editor done honestly | power/steward |

The class-defining mistake we structurally avoid: Metabase's "Convert to SQL" — a one-way
door that destroys the visual artifact. Our spine is reversible (D8 shape-detection is
bidirectional), so **the UI never says "convert" — only "show steps" / "simple view" /
"canonical form"**. This is our better over the whole reference class, and the copy law
of the surface.

## 2. Ground truth (recon, 2026-07-23 — load-bearing)

- ONE surface, three mounts (`/studio/data` Specs floor · URL cube-seed · inspector DATA
  facet) → `DataWorkbench`; admissibility capability-derived, fail-closed (`workbenchCapabilities.ts`).
- **D8 simple view: green-field.** No shape-detection anywhere. `registerStepEditor` is
  prose, not code (`workbenchCapabilities.ts:25,57`) — E2a's seam is named but unbuilt.
- **Parity checklist enumerated** (recon §2): QuerySpecEditor = FieldWells (dnd + arm-then-bind,
  per-chip clear, `wellAccepts`) · FilterBuilder (`literal|$ctx|$d|$cl`) · MeasureSelector ·
  EncodingEditor (`pct` dual-mode incl. `sumOf`); plus PipelineBuilder/StepForm machinery and
  the WorkbenchAdvanced trio. **This list IS the retire-gate checklist — survivor ⊇ removed.**
- **Sugar leaks back into rest** (post-U3 corpus = 26 pipeline + 1 query + 1 row-list):
  `buildSuggestedSpec.ts:44` still emits `type:'query'`; **normalize-on-write is NOT built**;
  Advanced/fallback-lane edits don't flip dialect; provisioning seed is stale (18×query).
  FF-ONE-DIALECT-AT-REST is violable by one ShowMe click today.
- E0 lifecycle (V39 revision · validated PUT incl. `code-resolves` 422 · draft→publish→
  restore→discard walked 8/8) **exists** — the auto-save-corruption class is already killed
  at the persistence layer; authoring-hold is deleted.
- Live frictions: metric catalog dominates the rail (~10× steps content); stored spec opens
  to an honest-but-alarming empty grid when its head's metric isn't in the page store;
  pipeline "Advanced" = JSON-only; empty Type picker placeholder.

## 3. Decisions

**Z1 — Three zooms, one artifact (the organizing law).** Zoom 0/1/2 as tabled above; all
three render projections of the one stored `PipelineSpec`. Escalation is additive lens
change; demotion is automatic when the shape re-qualifies. UI copy never implies
conversion. Zoom 0 lives on the element (Summary-Card grammar: a populated summary +
"open workbench" door), so the canvas never leaves view — the antidote to Power Query's
modal isolation.

**Z2 — Source-as-step-0; the rail is the steps list.** The head renders as the pinned,
non-deletable first step row ("წყარო: …" with its variant badge — governed metric / SDMX
query / inline / cells). Steps 1..n = verb rows: `[icon][verb][arg summary][⚙][⋯][on/off]`,
rename cosmetic (`label?` on the step node), drag-reorder dependency-checked with a
localized refusal, per-step `enabled:false` persisted (Grafana precedent — an authored
state, declarative). **The metric catalog leaves the rail**: GetHead's picker becomes a
popover/dialog opened from the Source row (UX-backlog #5; Placement Law — a catalog is
workspace-weight, not rail-weight). The rail's identity returns to "the applied steps".

**Z3 — Shape-detection is engine truth (`packages/core`).** A pure function
`detectSimpleShape(spec)` → declared simple-view models (`one-jump` = `source(query)`+trivial
tail; the recognized folds: timeseries, growth, …) with `project()`/`absorb()` — read the
spine into the simple form, write edits back losslessly. Panel consumes it for Zoom 0 and
the workbench "simple band"; **FF-SIMPLE-VIEW-ROUNDTRIP** (edit→emit→reopen ≡ same view)
pins it. A shape is a *declaration in a registry* — a new simple form is a new entry,
never a new surface (Law 10 discipline on the view axis).

**Z4 — E2a made real: the step-editor contract is registry-driven.** Formalize the seam the
prose promises: each of the 20 ops' authorable contract (already PropSchema-carried) drives
the generic role-projecting form (`TransformStepEditor` — exists); `registerStepEditor` +
head-editor registration + per-entry `provides` union become the ONE line that widens pane
admissibility. The ⚙ reopens the same form prefilled (the form is the projection, both
ways). Zero bespoke per-op UI beyond the three already-bespoke forms (lookup/sort/filter —
grandfathered until their schemas subsume them). Verb-form headers carry the D2
correspondence as inline help ("ფილტრი — dplyr `filter` / SQL `WHERE`") — the formula-cliff
softener, teachable and googleable.

**Z5 — The Advanced panel re-mapped, honestly named.** Rename: **«გაფართოებული /
კანონიკური ჩანაწერი» (Advanced / canonical)** — "raw" undersells what it now is. Content:
(a) the canonical JSON, editable, boundary-normalized on write (sugar accepted → lowered,
D6/Postel), round-trip guaranteed (FF-ROUNDTRIP-CANONICAL), with the trust affordance
*"ეს ზუსტად ისაა, რაც ინახება"* — the R4-distrust cure, advertised; (b) `SpecTypePicker`
re-cast as a **seed chooser** (a kind is an authoring projection that lowers on write —
never a storage form; `pipeline` no longer renders as an empty placeholder but as the
named current form); (c) the query-branch (SpecBody→QuerySpecEditor incl. the `fieldwells/*`
subtree) **retires under the capability-parity gate** — every enumerated capability
reattaches: FieldWells + MeasureSelector + EncodingEditor → the Encoding pane (Z6);
FilterBuilder → the `filter` verb form + head grain editor; raw-JSON.write → (a).

**Z6 — Encoding is a sibling pane, never a tail verb.** The workbench gains the
**Data | Encoding** split (Metabase notebook vs visualization; 0113's plane): wells =
the simple encoding zoom, the full per-channel field-def editor = the power zoom, both
projections of the 0113 channel registry. ENC-0 (types+registry+normalize+byte-fence)
precedes the pane build — sequencing unchanged from ONE-PIPE.

**Z7 — Per-step preview, made web-affordable.** (a) **Row-count deltas on every step row**
("1,240 → 87") — cheap, always on, answers "სად წავიდა რიგები" structurally; ship first.
(b) Sampled grid (top-N, labeled "პირველი N რიგი") for the **selected step only**,
prefix-hash cached (steps are pure ⇒ result-after-k keyed on `hash(head+steps[0..k])`,
edit at j invalidates j..end). (c) **Schema-at-step propagation** — the named engine
plumbing both the column pickers and the preview lean on: lightweight forward column
inference for offline pickers + sample execution for the grid. Funded deliberately, not
incidentally. The empty-grid-on-open friction becomes an honest state WITH a door
("ეს მეტრიკა ამ გვერდის მარაგში არ არის — გახსენი საიტის ჭრილში?").

**Z8 — One-dialect hygiene precedes the glamour (W0).** Close every sugar re-entry before
building views on the one-grammar assumption: api normalize-on-write (the queued PUT seam —
FF-ONE-DIALECT-AT-REST becomes machine-enforced, not aspirational); `buildSuggestedSpec`
emits spine; Advanced/fallback lanes route through the same emission flip as the panes;
provisioning seed re-emitted. Root-cause order: the invariant first, then the UI that
assumes it.

**Z9 — Lifecycle rides E0; no new persistence design.** Draft/publish/versions/validated-PUT
exist and are walked. This surface only *projects* that state where the author acts:
dirty/draft chips in Zoom 0 and the workbench chrome, publish door unchanged. The two
remaining incident guards (version history on `config.data_source`; DSD-subset PUT check)
stay on the card queue as backend items — not blockers here.

## 4. Sequencing (WIP=1; each wave gated + live-J-walked)

| Wave | Content | Gate |
|---|---|---|
| **W0** | Z8 hygiene: normalize-on-write · ShowMe emits spine · lane emission flip · provisioning re-emission | FF-ONE-DIALECT-AT-REST red-on-sugar · corpus re-check 28/28 |
| **W1** | Z3 shape-detection registry (core) + Z1 Zoom-0 element popover (first shape: one-jump) | FF-SIMPLE-VIEW-ROUNDTRIP · live walk: popover edit on a real element |
| **W2** | Z2 rail redesign (source-as-step-0, catalog→popover, rename/disable/reorder) + Z7a row-count deltas | panel suite · live walk: author narrates the steps list |
| **W3** | Z4 E2a registry + Z5 Advanced re-map/rename + query-branch retirement | **capability-parity checklist (recon §2) closed line-by-line** · FF-ROUNDTRIP-CANONICAL |
| **W4** | ENC-0 → Z6 Encoding pane (wells migrate in) | 0113 byte-fence · parity for wells/encoding capabilities |
| **W5** | Z7b/c sampled selected-step grid + prefix cache + schema-at-step plumbing | preview-correctness fitness · load sanity on :3013 |

ONE-PIPE's U2 (`cells` head) and U4 resolver retirement proceed as engine work alongside —
W3's parity discipline and U4's are the same gate. Board: card 0104 queue renames to W0–W5.

## 5. Fitness functions

Retained: FF-ROUNDTRIP-CANONICAL · FF-ONE-DIALECT-AT-REST (W0 makes it enforced) ·
FF-PIPELINE-EQUIV · FF-VERB-COVERAGE. New: **FF-SIMPLE-VIEW-ROUNDTRIP** (W1) ·
**FF-STEP-EDITOR-DECLARED** (W3: every op's form derives from its declared contract; a
bespoke per-op component outside the registry = red) · **FF-PREVIEW-PREFIX-COHERENT**
(W5: cached preview after step k ≡ fresh interpret up to k, on the sample).

## 6. Rejected alternatives

1. **Fold encoding into the verb tail** — recreates the shadow-encoding confusion 0113
   diagnoses; rejected (Z6).
2. **Grow the Zoom-0 popover toward a mini-workbench** — the Airtable chip-soup path;
   rejected: the popover's ceiling is the declared simple shapes; past it, one door.
3. **Destructive "convert to advanced"** — the Metabase mistake; structurally unnecessary
   for us; forbidden as copy and as code.
4. **Eager full-table preview at every step** — the latency trap; rejected for sampled,
   selected-step-only, prefix-cached (Z7).
5. **A new draft/publish model for specs** — E0 already shipped it; building a second one
   would be the DU3-class duplication this program exists to kill (Z9).

## 7. Owner paragraph (ქართულად)

*ერთი ნამუშევარი — სამი მასშტაბი. ელემენტზევე პატარა ფანჯარა მარტივი მოქმედებებისთვის
(მაჩვენებელი, ფილტრი, დალაგება) — ტილო თვალწინ რჩება. მეტი რომ გინდა — «ნაბიჯების»
სამუშაო მაგიდა: მონაცემი იწყება წყაროდან და ყოველი მოქმედება სახელიანი ნაბიჯია;
დააწკაპუნებ ნებისმიერზე და ხედავ ცხრილს ზუსტად იმ მომენტში, ყოველ ნაბიჯზე კი წერია
რამდენი რიგი შევიდა და გამოვიდა. და ბოლოს «კანონიკური ჩანაწერი» — ზუსტად ის, რაც
ინახება, არასდროს ტყუის. სამივე ერთი და იმავე ობიექტის ლინზაა: «გადაკეთება» აქ არ
არსებობს — მხოლოდ მიახლოება და დაშორება. შენახვა ისევ შენი ცხადი ღილაკია, ვერსიების
ისტორიით — ის უკვე აშენდა და ცოცხლად შემოწმდა. ეს ყველაფერი იმ გრამატიკებზე დგას,
რომლებსაც მილიონობით არაპროგრამისტი ყოველდღე ხმარობს: Excel-ის Power Query-ის ნაბიჯები,
Metabase-ის ამწყობი, Grafana-ს ვერსიები — და ერთ რამეში ყველას ვჯობივართ: მათთან
«გაძლიერება» ხშირად ცალმხრივი კარია, ჩვენთან — უბრალოდ ლინზის შეცვლა.*
