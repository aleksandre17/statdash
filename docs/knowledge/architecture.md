# Geostat — Architecture Reference

> წაიკითხე სანამ: ახალი extension point, Phase 2 compatibility check, layer separation decision.
> (Platform Mindset + 8 Rules → `principles.md`)

---

## JSON Platform Vision — გაფართოება ნულოვანი friction-ით

> **ეს არის ჩვენი არქიტექტურის ერთი წინადადება:**
> ახალი ელემენტი (Shell · Chrome · Control · DataSpec · Node type) =
> **ერთი ფაილი + ერთი `registerSlice()` ხაზი. სხვა არაფერი.**

### რას ნიშნავს ეს პრაქტიკულად

**Grafana:** panel plugin install → registers itself → palette-ში ჩნდება. Core = 0 ცვლილება.
**Form.io:** component → registers → form builder-ში ჩნდება. Core = 0 ცვლილება.
**Builder.io:** block → registers → visual editor-ში ჩნდება. Core = 0 ცვლილება.
**ჩვენ:**

```
ახალი Shell (node / chrome / control):

  1. plugins/{type}/MyShell.tsx    ← შექმნა
  2. plugins/{type}/index.ts       ← META + export
  3. plugins/index.ts barrel       ← ერთი ხაზი

  → registerSlice() ავტომატურად setupRegistrations.ts-ში
  → nodeRegistry.get(type, variant) → renders
  → Constructor palette-ში ჩნდება nodeRegistry.list()-ით
  → JSON config → render

  packages/  = 0 ცვლილება
  engine/    = 0 ცვლილება
  routes.tsx = 0 ცვლილება
  CLAUDE.md  = 0 ცვლილება
```

### "ნულოვანი friction" ტესტი — ყოველ ახალ ელემენტზე

```
❌  ახალი node type → packages/react/ შეიცვალა        = OCP დარღვევა
❌  ახალი chrome variant → AppChrome.tsx შეიცვალა     = OCP დარღვევა
❌  ახალი filter control → FilterBarShell შეიცვალა   = OCP დარღვევა
❌  ახალი DataSpec type → interpretSpec() შეიცვალა   = OCP დარღვევა
❌  ახალი shell → if/switch-ი ემატება render code-ში  = OCP + LSP დარღვევა

✅  ახალი node type → registerSlice() → done
✅  ახალი chrome → chromeRegistry → done
✅  ახალი control → filterControlRegistry → done
✅  ახალი DataSpec → SpecResolver → defaultRegistry.register() → done
```

**თუ core-ი იცვლება — design არასწორია. Registry extension point-ები ამისთვის არსებობს.**

### JSON → Registry → Render — ჩვენი pipeline

```
JSON config (NodeDef)
    ↓
nodeRegistry.get(node.type, node.variant ?? 'default')
    ↓
NodeRenderer(def, ctx, children) → ReactNode
    ↓
render

ამ pipeline-ში:
  engine = type string → lookup. სხვა არაფერი.
  shell  = def + ctx + children → ReactNode. სხვა არაფერი.
  registry = pure table. if/switch = ❌.
  config = plain JSON. functions/JSX = ❌.
```

**Constructor Phase 2-ში:** ეს JSON DB-ში ინახება. API გასცემს. Zero code change. ეს pipeline-ი ამის გარანტიაა.

### Extension Points — სად ემატება ახალი ელემენტი

| ახალი ელემენტი | სად | mechanism |
|---|---|---|
| Node type | `plugins/nodes/{type}/` | `nodeRegistry.register(type, variant, Shell)` |
| Chrome variant | `plugins/chrome/{Slot}/{variant}/` | `chromeRegistry.register(slot, key, Shell)` |
| Filter control | `plugins/controls/{type}/` | `filterControlRegistry.register(slice)` |
| DataSpec type | `packages/engine/src/data/` | `defaultRegistry.register(type, resolver)` |
| Datasource | `packages/engine/src/` | `engine.registerDatasource({id, create})` |

**ყოველ შემთხვევაში: core = closed. extension = open.**

---

## Agnosticism — ფენების სუფთაობა

```
@geostat/expr    → zero deps. არ იცის DataStore. არ იცის React. არ იცის Geostat.
@geostat/engine  → არ იცის React. არ იცის Geostat. DataSpec ტიპები = generic.
@geostat/react   → არ იცის Geostat. zero app content. zero src/ imports.
plugins/         → token-driven shells. zero brand in code. generic names.
src/             → ყველაფერი იცის. მხოლოდ ის ერევა app-specifics-ში.
```

დარღვევა = ქვემოთ მყოფი package-ი "ხედავს" ზემოთ მყოფს.
მაგ: `transform: 'fromSDMX' | 'raw'` engine-ში = engine-ი იცის Geostat-ის format. ❌

> სრული კანონიკური განსაზღვრება (dependency arrow · per-layer ❌/✅ · module augmentation pattern) →
> `packages/CLAUDE.md` — "Agnosticism — Dependency Rule" section

---

## Phase 2 = ყოველ decision-ის ფონი

Constructor-ი ყოველ page-ს JSON-ად ინახავს DB-ში.
ეს არ არის "მომავლის" concern — ეს ახლავე ყოველ decision-ს განსაზღვრავს.

- function config-ში → Constructor ვერ ინახავს → redesign
- closed union → Constructor ვერ გააფართოვებს → open instead
- named store registration → Constructor ვერ ამატებს → href pattern instead
- hardcoded dimension → Constructor ვერ შეცვლის → generic dims instead

> Phase 2 readiness checklist (7 items) + per-layer table → `.claude/individual/context/identity.md`

---

## Separation of Concerns

```
data:    DataSpec (WHAT)              — JSON, pure declaration, no logic
context: RenderContext (WHERE)        — dims, derived, stores
source:  DataStore (SOURCE)           — query() sync, store-agnostic
logic:   renderer (HOW)              — pure function, no side effects
shell:   React component (INTERACTIVE)— useState, animations, user events
config:  NodeDef (WHAT TO RENDER)    — JSON, Constructor-ready
nav:     NavItem[] (HOW TO NAVIGATE) — independent of PageConfig
```

ეს შვიდი არასდროს ერევა ერთმანეთს.