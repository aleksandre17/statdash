
# Architecture Mandate — "Architecture Leads, Codebase Follows"

> This is the foundational operating principle of this refactor.
> It overrides comfort, convention, and the path of least resistance.

---

## The Mandate

> **ახალი არქიტექტურა — სტანდარტია. კოდი ეგუება, არა პირიქით.**
> New architecture is the standard. Code adapts to it — not the reverse.

This means:

- "ახლა ასეა კოდში" — **is not an argument.**
- "ეს ძველი კოდი გაართულებს" — **is not a blocker. Fix the old code.**
- "ეს pattern-ი ჩვენს კოდბეიზთან უკეთ ჯდება" — **evaluate whether your codebase is wrong.**

---

## Why This Principle Exists

Refactors fail in one of two ways:

1. **They stop.** Old code is too entangled, the new design is never fully applied.
2. **They dilute.** New design compromises to fit old code, becoming neither old nor new — just broken.

Both failures stem from the same cause: **architecture yields to the existing codebase.**

The Strangler Fig pattern works because it never yields:
1. Build new code correctly (new architecture)
2. Switch the boundary
3. Delete old code

**There is no step 1.5: "adapt new architecture to old code."**

---

## What This Looks Like in Practice

### ✅ Correct: architecture leads

```ts
// Old code had: ctx.year, ctx.regionId (direct property access)
// New architecture requires: ctx.dims['time'], ctx.dims['geo']

// ✅ Migrate all call sites. Update old code.
interpretSpec(spec, { dims: { time: 2023, geo: 'GE' } }, store)
// NOT:
interpretSpec(spec, { year: 2023, ...ctx }, store) // ❌ accommodating old naming
```

```ts
// Old code had: pageConfig.nav = NavItemDef[]
// New architecture: nav is independent (nav.config.ts)

// ✅ Remove nav from PageConfig. Migrate all configs.
// NOT: keep nav field as optional for "backwards compat" ❌
```

```ts
// Old code had: engine.extend(nodeRegistry, slotRegistry)
// New architecture: slotRegistry removed, one arg

// ✅ Remove slotRegistry everywhere. engine.extend(nodeRegistry)
// NOT: keep second arg optional ❌
```

### ❌ Wrong: architecture accommodates

```ts
// ❌ "We'll keep both patterns for now"
type PageConfig = { nav?: NavItemDef[] } // optional = never fully migrated

// ❌ "This one page needs the old ctx shape"
if (ctx.year) { ... } // mixing old and new

// ❌ "The new registry doesn't support this yet, so we'll inline"
if (def.type === 'landing-hero') return <LandingHero /> // bypass registry
```

---

## The Strangler Fig in 5 Steps

```
① New code      → write it correctly per new architecture
② Place it      → wire it into routing/registry/provider (behind old code)
③ Verify        → new path works independently
④ Switch        → flip the boundary (route, registry entry, provider)
⑤ Delete        → remove old code completely (no dead code, no toggles)
```

**There is no Step 0: "adapt new to old."**
**Step ⑤ is mandatory.** Dead code is technical debt that obscures architecture.

---

## Permission to Be Bold

This project has explicit permission to:

- **Remove fields from PageConfig** if they don't belong there
- **Change function signatures** (ctx shape, engine API, renderer signature)
- **Delete files** when their responsibility moves
- **Break existing imports** and fix them, rather than add compatibility shims

The test is not "does old code still compile?"
The test is "does the new architecture express our intent correctly?"

---

## Architecture Authority Hierarchy

```
Reference Standards (Eurostat, ONS, IMF, Grafana patterns)
         ↓
Architectural decisions (this folder, agreements)
         ↓
Type definitions (types/all-types.md)
         ↓
Migration plan (migration/ folder)
         ↓
Current codebase
```

When there is a conflict: **higher level wins, lower level changes.**

---

## Checkpoints

Before accepting any implementation, ask:

1. **Does this implement the architecture as designed — or does it adapt the architecture to the code?**
2. **If old code conflicts with this, does the PR fix old code — or does the PR work around it?**
3. **Is there any feature flag, optional field, or shim that exists only to avoid touching old code?**

If the answer to 3 is yes — the architecture is not leading. Stop and redesign.
