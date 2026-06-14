# Geostat — Migration Skill

> **Method = `generic/engineering/refactoring.md`** — the established refactoring discipline (Fowler · Beck · Feathers · Mikado · Strangler Fig · Branch-by-Abstraction · Parallel Change · Continuous Delivery). This file = the *project-specific application* (what to migrate, the M-rules); the *how-to-change-safely* method lives there and we conform to it.

> Migration specs dissolved 2026-06-02 → `docs/` (archive + subsystems). **This file = the timeless migration DOCTRINE (M-rules + step discipline) only.**
> Specs → `docs/archive/migration-specs-gen2/` (history) · `docs/architecture/subsystems/` (current) · live truth = code + `docs/plan/`.

---

## MANDATORY — ყოველ session-ში, ყოველ decision-ზე

### M-1 — knowledge/principles.md პირველია

ნებისმიერი decision-ის წინ — `.claude/individual/knowledge/principles.md` წაკითხული და გამოყენებული უნდა იყოს.
ყველა 8 შეუვალი წესი გადამოწმებული. SOLID + agnosticism + Constructor-readiness. (წინ: `docs/PRINCIPLES.md` — 2026-06-02 stub deleted; canonical = knowledge/principles.md.)

```
❌  decision-ი PRINCIPLES.md-ის გარეშე
✅  8 წესი → platform consensus → opinion → "გავაკეთო?"
```

### M-2 — docs/architecture/examples/ პირველია

ნებისმიერი pattern-ის, type-ის ან implementation approach-ის წინ:
`docs/architecture/examples/` ფოლდერი ჯერ — შემდეგ სხვა. (წინ: `refactor-plane/examples/` — 2026-06-02 consolidated → `docs/`.)

```
❌  pattern-ი memory-ით
✅  Grep examples/ → კონფლიქტი? → report → შემდეგ decision
```

**დამატებით:** examples/-ში ❌-ით მოNIShნული = ANTI-PATTERN. ✅-ით — canonical.
თუ examples/-ში ❌ ნახე — stop. ეს approach არ გამოიყენო.

### M-3 — შეცდომა = პროექტი წავა

```
❌  if/else variant dispatch shell-ში
❌  decision examples/-ის შემოწმების გარეშე
❌  "ვიფიქრე რომ" — memory-ზე დაყრდნობა
❌  partial read — ერთი doc, examples/ გარეშე

✅  Read → Grep examples/ → PRINCIPLES.md → report conflicts → then act
✅  ❌ in examples = stop + report to user before proceeding
```

### M-4 — Migration = Showcase, არა Minimum Patch

```
❌  minimum patch — მხოლოდ ის რაც "ჭირდება" ამ კონკრეტულ შემთხვევაში
❌  "ეს feature ახლა არ გვჭირდება — გამოვტოვებ"
❌  ნახევრად migrated node

✅  ყოველი migrated node — სრული new arch: VarMap · NodeBase.derive · visibleWhen
✅  variant registry სადაც structural variation არსებობს
✅  ChildrenArg.renderChild — lazy render სადაც tab/accordion pattern-ია
✅  DataSpec — declarative, ნებისმიერ node-ს შეუძლია data?
```

**Data placement:** DataSpec declarative-ია — ნებისმიერ node-ს შეუძლია `data?`. Grafana/Builder.io: data follows the consumer. Guidance, not restriction.

### M-5 — Problem → Platform Enhancement, არა მხოლოდ Fix

```
❌  minimum fix — მხოლოდ ის, რაც crashes-ს ხსნის
✅  StoreQuery: 'val'|'obs'|'schema'|'distinct' (Constructor, filter options)
✅  StoreCaps — capability declaration
✅  batchQuery? — N+1 elimination
```

**სამი შეკითხვა solution-ის შემდეგ:**
1. **"რა შეუძლია ახლა, რაც ადრე არ შეეძლო?"**
2. **"Constructor-ი ამას გამოიყენებს Phase 2-ში?"**
3. **"ეს open for extension-ია?"**

**Platform bar:** Grafana DataSourceApi · Cube.dev CubeApi · Builder.io DataSource Plugin

### M-6 — Code Quality, SOLID, Design Patterns, OOP

> ეს წესები ვრცელდება ყველა ახლად დაწერილ კოდზე. Migration = showcase.
>
> **კანონიკური განსაზღვრება (zero duplication) → `.claude/individual/knowledge/principles.md`:**
> `SOLID` (S/O/L/I/D — ❌/✅ per principle) ·
> `Design Patterns` (Registry · Adapter · Repository · Factory · Facade · Observer · Strangler Fig · ...) ·
> `OOP` (class სად / სად არა — DataStore · Registry · pure function patterns) ·
> `Clean Code` (file sizes · naming · named exports · barrel · pure functions · immutable · co-location) ·
> `Clean Architecture` (სად რა კოდი ეკუთვნის — concrete file/function mapping + WRONG PLACE red flags)

---

## Core Direction — ეს არ განიხილება

**ახალი არქიტექტურა არ ეგუება ძველს. ძველი ეგუება ახალს.**

`docs/plan/` + `docs/architecture/` → canonical. კოდი, რომელიც ეწინaağმდეგება — იცვლება.

---

## Phase 1 Constraints

```
CODE_MAP       — fromSDMX hard-wires codes. Phase 2: backend sends correct codes. Now: leave as-is.
isCarryForward — filter in DataStore. Phase 2: DB handles. Now: leave as-is.
```

---

## 7 Implementation Rules

### Rule 1 — Architecture leads, code follows
`docs/plan/` + `docs/architecture/` (+ live code) = canonical. Code that contradicts the plan = wrong.

### Rule 2 — Phase 1 = static JSON + Phase 2 ready. Simultaneously.
`manifest.ts` = THE SINGLE SEAM. One line change → Phase 2:
```ts
// Phase 1: return { datasources: DATASOURCE_CONFIGS, pages: pagesRecord(), ... }
// Phase 2: return fetch('/api/site').then(r => r.json())
```

### Rule 3 — Full implementation. Nothing deferred. Ever.
```
❌  "ეს feature ახლა არ გვჭირდება — მოგვიანებით"
✅  განსაზღვრული → implement → register → done.
```

Must implement fully: `interpretSpec` (all 8 DataSpec types) · `NodeRegistry` (all node types) · `FilterControls` (all control types) · `GeoRegistry` · `DatasourcePlugin` (all 3) · `Chrome` (all slots)

### Rule 4 — Strangler Fig. Every step.
```
① ახალი კოდი → tsc → 0 → visual check → ✅
② გადართვა (import swap / registration change)
③ ძველი კოდი → DELETE (same session)
```

### Rule 5 — tsc → 0 at every step
`npx tsc --noEmit` = 0 errors required before next step.

### Rule 6 — Quality gates per step
```
□ tsc --noEmit → 0 errors
□ Landing page renders
□ GDP: filter bar sticky · chart/table toggle · KPI strip
□ Accounts: tab navigation · section content
□ Regional: map/chart · filter bar
□ URL state: change → URL updates → reload → same state
```

### Rule 7 — Agnostic and growth-oriented
```
ctx.dims['time'] as number   ✅    ctx.year / ctx.regionId      ❌
data: DataSpec               ✅    getRows: (ctx) => DataRow[]  ❌
JSON-serializable config     ✅    JSX / functions in config    ❌
open NodeTypeMap             ✅    closed union                 ❌
packages/ = zero app content ✅    Geostat brand in packages/   ❌
```

---

## Before Starting Each Step

> ეს sequence სავალდებულოა ყოველ implementation step-ზე — migration-ის დროს, ახალი node-ის დამატებისას, ნებისმიერ სტრუქტურულ ცვლილებაზე.

```
1. Read current state   — git status · tsc output · which files touched
2. Read the target      — docs/plan/ + docs/architecture/ (examples · architecture · types/all-types.md)
3. Write new code       — do NOT modify old code yet
4. tsc → 0              — 0 errors required
5. Visual check         — all pages render, no console errors
6. Switch               — import swap / registration update (old → new)
7. DELETE old code      — same session, no coexistence
8. tsc → 0 again        — confirm no orphan references
9. Visual check again   — regression check after deletion
```

NEVER: step 6 before step 4. NEVER: skip step 7 ("later"). NEVER: step 2 from memory — read files.

---

## Definition of Done

### Node type "implemented" means:

```
□ Type defined: NodeTypeMap augmentation or all-types.ts
□ NodeSlice in plugins/nodes/{type}/
   □ Shell.tsx      — renders the node
   □ Skeleton.tsx   — loading state (same dimensions as Shell)
   □ META           — { type, label, icon, category, schema }
   □ index.ts       — exports { Shell, Skeleton, META }
□ Registered in plugins/nodes/index.ts barrel
□ setupRegistrations.ts dispatches via registerSlice()
□ tsc --noEmit → 0 errors
```

### Filter control "implemented" means:

```
□ FilterControlSlice in plugins/controls/{type}/
   □ Shell.tsx      — renders the control UI
   □ META           — { controlType, label, category }
   □ codec          — encode/decode URL state
   □ defaultValue   — resolves DefaultSpec
   □ validate       — validates current value
□ Registered in plugins/controls/index.ts barrel
□ setupRegistrations.ts dispatches via registerSlice()
□ tsc --noEmit → 0 errors
```

### DataSpec type "implemented" means:

```
□ Discriminated union member in engine types (or DataSpec extension)
□ SpecResolver in engine/core/src/data/spec.ts (or registered resolver)
□ Registered in defaultRegistry
□ Unit test: interpretSpec({ type: '...', ... }, ctx, store) → DataRow[]
□ tsc --noEmit → 0 errors
```

**"ახლა არ გვჭირდება" — invalid reason to skip. Unregistered = Constructor palette-ში არ ჩანს Phase 2-ში.**

---

## Full Spec Reference

| Topic | File |
|-------|------|
| BLOCKER 1–4 full designs | `docs/archive/migration-specs-gen2/01-blockers.md` |
| Key types, NodeRegistry, plugin anatomy | `docs/architecture/subsystems/02-node-system.md` |
| resolveNodeRows + renderNode 8-step pipeline | `docs/plan/SYSTEM-PIPELINE-TREE.md` |
| SiteContext + all hooks | `docs/architecture/subsystems/08-site-manifest.md` |
| I18n architecture (all 4 layers) | `docs/architecture/subsystems/29-i18n-architecture.md` |
| Shell patterns + registerSlice | `docs/architecture/subsystems/02-node-system.md` |
| Bootstrap, App.tsx, plugin structure | `docs/archive/migration-specs-gen2/07-bootstrap.md` |
| Track A page configs + verification checklist | `docs/archive/migration-specs-gen2/08-pages.md` |
| Migration status + completed tiers | `.claude/individual/context/phase-status.md` |
| Open/closed blockers | `.claude/individual/context/blockers.md` |