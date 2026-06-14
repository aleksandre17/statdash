# Migration 09 — Plugin Taxonomy Refactor

> **Reference** — originated as a migration spec; moved to the corpus 2026-06-02 (migration DONE).
> Authority: live code + `docs/plan/SYSTEM-PIPELINE-TREE.md`. Describes the **implemented** subsystem.


> **მიზანი:** plugins/-ის 5-tier კატეგორიზაცია + engine/react-ის სრული agnosticism.
> **scope:** file organization only — logic, types, rendering pipeline არ იცვლება (11-gap done).
> **dependency order:** packages/ → plugins/ → src/ (არ გადახვიდე თანმიმდევრობას).
> **verification:** ყოველი ნაბიჯის შემდეგ `npx tsc --noEmit` → 0 errors.

---

## 0. სრული სურათი — Current → Target

```
CURRENT                           TARGET
────────────────────────────────────────────────────────────────────
engine/react/                   engine/react/
  components/                       components/
    layout/          ──DELETE──►     feedback/ (only)
      InnerLayout.tsx  ──MOVE──►   [absorbed by engine/react internals + plugins/pages/]
      Sidebar.tsx      ──MOVE──►   plugins/pages/inner-page/default/
      icons.tsx        ──MOVE──►   plugins/pages/inner-page/default/
      page-layout.css  ──MOVE──►   plugins/pages/inner-page/default/
      panel-layout.css ──MOVE──►   engine/react/src/styles/  (platform CSS)
      tabs.css         ──MOVE──►   plugins/pages/tab-page/default/

plugins/                          plugins/
  chrome/            ── ✅ ──►     chrome/           (Tier 1 — unchanged)
  controls/          ── ✅ ──►     controls/         (Tier 5 — already correct)
  landing/           ──MOVE──►     pages/landing/    (Tier 2)
  nodes/                           pages/            (Tier 2 — NEW)
    inner-page/      ──MOVE──►       inner-page/
    container-page/  ──MOVE──►       container-page/
    tab-page/        ──MOVE──►       tab-page/
    chart/           ──MOVE──►     panels/chart/     (Tier 3 — NEW)
    table/           ──MOVE──►     panels/table/
    kpi-strip/       ──MOVE──►     panels/kpi-strip/
    section/         ── ✅ ──►     nodes/section/    (Tier 4 — stays)
    filter-bar/      ── ✅ ──►     nodes/filter-bar/
    page-header/     ── ✅ ──►     nodes/page-header/
    repeat/          ── ✅ ──►     nodes/repeat/
    row/             ── ✅ ──►     nodes/row/
    wrap/            ── ✅ ──►     nodes/wrap/
    links/           ── ✅ ──►     nodes/links/
    mode-bar/        ── ✅ ──►     nodes/mode-bar/
    georgraph/       ── ✅ ──►     nodes/georgraph/
    layout/          ── ✅ ──►     nodes/layout/    (grid/columns primitives — stays)
```

### 5-Tier Taxonomy (საბოლოო)

```
Tier 1  chrome/    — Global App Shell (header/footer/locale-switcher)
Tier 2  pages/     — Page Template Nodes (rootOnly: true — inner/container/tab/landing)
Tier 3  panels/    — Data Visualization Panels (chart/table/kpi-strip)
Tier 4  nodes/     — Structural + Composition Nodes (section/filter-bar/repeat/…)
Tier 5  controls/  — Filter Controls (year-select/cascade/select/range/hidden)
```

---

## 1. Dependency Rules (ახალი სტრუქტურით)

```
engine/core  ←  engine/react  ←  plugins/*  ←  src/
                                          │
                     chrome/ pages/ panels/ nodes/ controls/
                     (ყველა ერთ დონეზეა — cross-plugin import = violation)
```

```
✅  plugins/pages/inner-page/ imports from engine/react/engine
✅  plugins/panels/chart/ imports from engine/react/engine
✅  plugins/pages/inner-page/ imports local files (InnerLayout.tsx in same folder)
❌  plugins/panels/chart/ imports from plugins/nodes/section/
❌  plugins/pages/inner-page/ imports from plugins/chrome/
❌  engine/react/ imports from plugins/          ← NEW RULE (InnerLayout move fixes this)
```

---

## 2. Type Changes (engine/react — Step 1, no file moves)

### 2a. SliceType — 'page' + 'panel' (engine/react/src/engine/types.ts)

```ts
// BEFORE:
export interface NodeSliceMeta {
  sliceType: 'node'
  // ...
}
export type SliceMeta = NodeSliceMeta | ChromeSliceMeta | FilterControlMeta

// AFTER: split NodeSliceMeta into three by sliceType
export interface PageSliceMeta {
  sliceType:  'page'       // Tier 2 — rootOnly page templates
  type:       string
  variant?:   string
  label?:     LocaleString
  rootOnly:   true         // enforced
  // ... (schema, defaults, slots, frame? — Phase 2)
}

export interface PanelSliceMeta {
  sliceType:  'panel'      // Tier 3 — data viz (always has DataSpec in Constructor)
  type:       string
  variant?:   string
  label?:     LocaleString
  // ... (schema, defaults, fieldConfig schema — Phase 2)
}

// NodeSliceMeta — sliceType broadened (backward compat: 'node' still works)
export interface NodeSliceMeta {
  sliceType:  'node' | 'page' | 'panel'   // transitional — narrow back after all META updated
  // ...
}

export type SliceMeta = NodeSliceMeta | ChromeSliceMeta | FilterControlMeta
```

> **NOTE:** Phase 1 = broaden `sliceType` to `'node' | 'page' | 'panel'` (zero breaking changes).
> Phase 2 = split into separate interfaces + Constructor palette uses them.

### 2b. RenderContext — navContext (engine/react/src/engine/types.ts)

```ts
// ADD to RenderContext interface:
navContext?: {
  sections:    NavSection[]     // import type { NavSection } from '../engine/navUtils'
  timeModeKey: string
}
```

**Why:** SiteRenderer currently passes navSections to InnerLayout directly.
After the move, InnerPageShell (in plugins/) needs this data.
`navContext` in RenderContext is the bridge — engine/react stays agnostic of InnerLayout.

### 2c. InnerPageNode — frame field (plugins/pages/inner-page/default/InnerPageNode.ts)

```ts
// ADD (optional, Constructor Phase 2 ready):
export interface InnerPageNode extends NodeBase {
  type:     'inner-page'
  frame?:   'sidebar' | 'full-width' | 'centered'  // NEW — default: 'sidebar'
  children: NodeDef[]
}
```

---

## 3. Migration Steps — Ordered by Dependency

### ── Step 1: engine/react — SliceType + navContext ──

**Files touched:**
- `engine/react/src/engine/types.ts`

**Changes:**
1. Broaden `NodeSliceMeta.sliceType` to `'node' | 'page' | 'panel'`
2. Add `navContext?: { sections: NavSection[], timeModeKey: string }` to `RenderContext`

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 2: engine/react — SiteRenderer.tsx ──

**Files touched:**
- `engine/react/src/engine/SiteRenderer.tsx`

**Changes:**
1. Remove: `import InnerLayout from '../components/layout/InnerLayout'`
2. Add `navContext` to `baseCtx`:
   ```ts
   const baseCtx: Omit<RenderContext, 'renderNode'> = {
     // ... existing fields ...
     navContext: { sections: navSections, timeModeKey },  // ADD
   }
   ```
3. Remove the `if (page.type === 'inner-page') { return <InnerLayout ...> }` branch:
   ```ts
   // BEFORE:
   if (page.type === 'inner-page') {
     return (
       <GlobalStateProvider>
         <PageStoreProvider store={pageStore}>
           <ModeProvider value={modeCtx}>
             <InnerLayout section={page.id} navSections={navSections} timeModeKey={timeModeKey}>
               {content}
             </InnerLayout>
           </ModeProvider>
         </PageStoreProvider>
       </GlobalStateProvider>
     )
   }
   return (
     <GlobalStateProvider>
       <PageStoreProvider store={pageStore}>
         <ModeProvider value={modeCtx}>{content}</ModeProvider>
       </PageStoreProvider>
     </GlobalStateProvider>
   )

   // AFTER (unified — InnerPageShell handles its own layout):
   return (
     <GlobalStateProvider>
       <PageStoreProvider store={pageStore}>
         <ModeProvider value={modeCtx}>{content}</ModeProvider>
       </PageStoreProvider>
     </GlobalStateProvider>
   )
   ```

**Verify:** `npx tsc --noEmit` → 0 errors
(InnerLayout import gone → error unless Step 3 done first; do Step 2+3 together)

---

### ── Step 3: plugins/pages/ — Create + inner-page ──

**Files created/moved:**

```
CREATE: plugins/pages/
CREATE: plugins/pages/index.ts

CREATE: plugins/pages/inner-page/
CREATE: plugins/pages/inner-page/index.ts   (barrel → re-export from default/)

CREATE: plugins/pages/inner-page/default/
MOVE:   plugins/nodes/inner-page/default/InnerPageNode.ts
MOVE:   plugins/nodes/inner-page/default/InnerPageShell.tsx  (update — see below)
MOVE:   plugins/nodes/inner-page/default/index.ts
MOVE:   engine/react/src/components/layout/InnerLayout.tsx
MOVE:   engine/react/src/components/layout/Sidebar.tsx
MOVE:   engine/react/src/components/layout/icons.tsx
MOVE:   engine/react/src/components/layout/page-layout.css
```

**InnerPageShell.tsx — update (was trivial, now uses InnerLayout):**

```tsx
// plugins/pages/inner-page/default/InnerPageShell.tsx
import { defineShell }   from '@geostat/react/engine'
import type { ShellProps } from '@geostat/react/engine'
import type { InnerPageNode } from './InnerPageNode'
import InnerLayout       from './InnerLayout'

export const InnerPageShell = defineShell<InnerPageNode>({
  render({ def, ctx, children }) {
    return <InnerPageControl def={def} ctx={ctx} children={children} />
  },
})

function InnerPageControl({ def, ctx, children }: ShellProps<InnerPageNode>) {
  const nav = ctx.navContext

  if (nav) {
    return (
      <InnerLayout section={def.id} navSections={nav.sections} timeModeKey={nav.timeModeKey}>
        <main className="page-content">{children.rendered}</main>
      </InnerLayout>
    )
  }
  return <main className="page-content">{children.rendered}</main>
}
```

**InnerLayout.tsx — update imports (same content, paths change):**
```ts
// BEFORE: import Sidebar from './Sidebar'  (was: engine/react/components/layout/Sidebar)
// AFTER:  import Sidebar from './Sidebar'  (same file, now co-located in plugins/pages/inner-page/default/)
// BEFORE: import { SectionNavProvider } from '../individual/context/SectionNavContext'
// AFTER:  import { SectionNavProvider } from '@geostat/react/individual/context/SectionNavContext'
//         (or use tsconfig alias @geostat/react if it covers internal paths)
```

**META update (index.ts):**
```ts
export const META: NodeSliceMeta = {
  sliceType: 'page',     // WAS: 'node'
  type:      'inner-page',
  rootOnly:  true,
  label:     { ka: 'შიდა გვერდი', en: 'Inner Page' },
}
```

**plugins/pages/index.ts:**
```ts
export * as innerPage from './inner-page'
```

**plugins/nodes/inner-page/ — DELETE** (barrel + default/ folder)
**plugins/nodes/index.ts — REMOVE** `export * as innerPage from './inner-page'`

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 4: plugins/pages/ — container-page ──

**Files moved:**
```
MOVE: plugins/nodes/container-page/default/ContainerPageNode.ts    → plugins/pages/container-page/default/
MOVE: plugins/nodes/container-page/default/ContainerPageShell.tsx  → plugins/pages/container-page/default/
MOVE: plugins/nodes/container-page/default/index.ts               → plugins/pages/container-page/default/
MOVE: plugins/nodes/container-page/index.ts                       → plugins/pages/container-page/index.ts
DELETE: plugins/nodes/container-page/
```

**META update:**
```ts
export const META: NodeSliceMeta = {
  sliceType: 'page',   // WAS: 'node'
  type:      'container-page',
  rootOnly:  true,
  label:     { ka: 'კონტეინერ გვერდი', en: 'Container Page' },
}
```

**plugins/pages/index.ts — ADD:**
```ts
export * as containerPage from './container-page'
```

**plugins/nodes/index.ts — REMOVE:**
```ts
export * as containerPage from './container-page'  // DELETE this line
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 5: plugins/pages/ — tab-page ──

**Files moved:**
```
MOVE: plugins/nodes/tab-page/default/TabPageNode.ts    → plugins/pages/tab-page/default/
MOVE: plugins/nodes/tab-page/default/TabPageShell.tsx  → plugins/pages/tab-page/default/
MOVE: plugins/nodes/tab-page/default/TabsNode.ts       → plugins/pages/tab-page/default/
MOVE: plugins/nodes/tab-page/default/index.ts          → plugins/pages/tab-page/default/
MOVE: plugins/nodes/tab-page/index.ts                  → plugins/pages/tab-page/index.ts
DELETE: plugins/nodes/tab-page/
```

**CSS:** `engine/react/src/components/layout/tabs.css`
→ Check if TabPageShell imports it; if yes: MOVE to `plugins/pages/tab-page/default/tabs.css`
→ Update import in TabPageShell.tsx

**META update:**
```ts
sliceType: 'page',   // WAS: 'node'
```

**plugins/pages/index.ts — ADD:**
```ts
export * as tabPage from './tab-page'
```

**plugins/nodes/index.ts — REMOVE:**
```ts
export * as tabPage from './tab-page'  // DELETE
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 6: plugins/pages/ — landing ──

**Current structure:**
```
plugins/landing/
  index.ts
  landing.css
  types.ts
  nodes/
    LandingHeroShell.tsx
    LandingStatsShell.tsx
    hero/index.ts
    stats/index.ts
    container/
      LandingContainerShell.tsx
      index.ts          ← META: { type: 'container-page', variant: 'landing' }
```

**Target:**
```
plugins/pages/landing/
  (identical internal structure — preserve nodes/ subdirectory)
  index.ts        ← updated to export from nodes/
```

**Changes:**
1. Move entire `plugins/landing/` → `plugins/pages/landing/`
2. Update any import of `../individual/context/...` → proper alias
3. `landing.css` stays co-located

**setupRegistrations.ts:**
```ts
// BEFORE:
import * as Landing from '../plugins/landing/nodes'
// AFTER:
import * as Landing from '../plugins/pages/landing/nodes'
```

**plugins/pages/index.ts — ADD:**
```ts
export * as landing from './landing'
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 7: plugins/panels/ — chart ──

**Files moved:**
```
MOVE: plugins/nodes/chart/default/  → plugins/panels/chart/default/
MOVE: plugins/nodes/chart/index.ts  → plugins/panels/chart/index.ts
CREATE: plugins/panels/index.ts
DELETE: plugins/nodes/chart/
```

**META update:**
```ts
export const META: NodeSliceMeta = {
  sliceType: 'panel',   // WAS: 'node'
  type:      'chart',
  label:     { ka: 'გრაფიკი', en: 'Chart' },
}
```

**plugins/panels/index.ts:**
```ts
export * as chart from './chart'
```

**plugins/nodes/index.ts — REMOVE:**
```ts
export * as chart from './chart'  // DELETE
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 8: plugins/panels/ — table ──

**Files moved:**
```
MOVE: plugins/nodes/table/default/  → plugins/panels/table/default/
MOVE: plugins/nodes/table/index.ts  → plugins/panels/table/index.ts
DELETE: plugins/nodes/table/
```

**META update:**
```ts
sliceType: 'panel',   // WAS: 'node'
```

**plugins/panels/index.ts — ADD:**
```ts
export * as table from './table'
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 9: plugins/panels/ — kpi-strip ──

**Files moved:**
```
MOVE: plugins/nodes/kpi-strip/default/  → plugins/panels/kpi-strip/default/
MOVE: plugins/nodes/kpi-strip/index.ts  → plugins/panels/kpi-strip/index.ts
DELETE: plugins/nodes/kpi-strip/
```

**META update:**
```ts
sliceType: 'panel',   // WAS: 'node'
```

**plugins/panels/index.ts — ADD:**
```ts
export * as kpiStrip from './kpi-strip'
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 10: setupRegistrations.ts — full update ──

```ts
// BEFORE:
import * as Nodes    from '../plugins/nodes'
import * as Chrome   from '../plugins/chrome'
import * as Controls from '../plugins/controls'
import * as Landing  from '../plugins/landing/nodes'

// AFTER:
import * as Chrome   from '../plugins/chrome'
import * as Pages    from '../plugins/pages'
import * as Panels   from '../plugins/panels'
import * as Nodes    from '../plugins/nodes'
import * as Controls from '../plugins/controls'

export function setupRegistrations(): void {
  // ... modeRegistry.register(...) unchanged ...

  ;[
    ...Object.values(Chrome),
    ...Object.values(Pages),      // NEW — includes landing nodes too
    ...Object.values(Panels),     // NEW
    ...Object.values(Nodes),
    ...Object.values(Controls),
  ].forEach(s => registerSlice(s as Parameters<typeof registerSlice>[0]))

  // ... middleware unchanged ...
}
```

**NOTE:** `plugins/pages/index.ts` must export landing's nodes (hero/stats/container) alongside page templates.
Two options:
- Option A: `plugins/pages/index.ts` exports everything from landing/nodes/
- Option B: keep Landing separate import (simpler — `import * as LandingNodes from '../plugins/pages/landing/nodes'`)

Recommended: **Option B** (explicit, no magic re-export cascade).

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 11: engine/react — Delete layout/ ──

**Precondition:** Steps 2-10 must all be done. No more imports of layout/ anywhere.

**Check before delete:**
```
grep -r "components/layout" engine/react/src/
grep -r "components/layout" plugins/
grep -r "components/layout" src/
```
→ Must return 0 results.

**CSS to handle:**
- `page-layout.css` → moved in Step 3 (with InnerLayout to inner-page/default/)
- `panel-layout.css` → check who imports it:
  - If only InnerLayout: moved in Step 3
  - If platform-wide: move to `engine/react/src/styles/panel-layout.css` + update index.css @import
- `tabs.css` → moved in Step 5 (with TabPageShell to tab-page/default/)

**Delete:**
```
engine/react/src/components/layout/  ← entire directory
```

**Verify:** `npx tsc --noEmit` → 0 errors, `npm test` → 29/29 passing

---

### ── Step 12: plugins/nodes/index.ts — Final Cleanup ──

After all moves, `plugins/nodes/index.ts` should contain ONLY structural nodes:

```ts
export * from './layout'           // grid/columns/wrap primitives (star export)
export * as pageHeader  from './page-header'
export * as repeat      from './repeat'
export * as section     from './section'
export * as filterBar   from './filter-bar'
export * as modeBar     from './mode-bar'
export * as row         from './row'
export * as links       from './links'
export * as georgraph   from './georgraph'
// REMOVED: chart, table, kpiStrip, innerPage, tabPage, containerPage
```

**Verify:** `npx tsc --noEmit` → 0 errors

---

### ── Step 13: plugins/ root barrel (optional) ──

If a `plugins/index.ts` exists or is needed:

```ts
export * from './chrome'
export * from './pages'
export * from './panels'
export * from './nodes'
export * from './controls'
```

---

### ── Step 14: SectionNavContext alias (if needed) ──

`InnerLayout.tsx` imports `SectionNavProvider` from `@geostat/react`. Check if the tsconfig alias covers this:
- If `@geostat/react` → `engine/react/src/index.ts` and `SectionNavProvider` is exported there → ✅ no change
- If not exported from main barrel → add to `engine/react/src/context/index.ts` or similar

**Verify path resolution:** `npx tsc --noEmit` → 0 errors

---

## 4. Innovation Implementation (Phase 2 Ready — add types now, behavior later)

### Innovation 2: InnerPageNode.frame (type only — no shell logic change yet)

After Step 3, add to `InnerPageNode.ts`:

```ts
export interface InnerPageNode extends NodeBase {
  type:     'inner-page'
  frame?:   'sidebar' | 'full-width' | 'centered'  // default: 'sidebar'
  children: NodeDef[]
}
```

`InnerPageShell` can check `def.frame` to pick layout variant.
When `frame === 'full-width'`: skip InnerLayout, render `<main>` directly.
When `frame === 'centered'`: render `<main className="page-centered">`.

### Innovation 3: Named slots on page templates (metadata only — Constructor Phase 2)

After Step 3, add to `plugins/pages/inner-page/default/index.ts`:

```ts
import type { SlotDef } from '@geostat/react/engine'

export const InnerPageSlots: Record<string, SlotDef> = {
  sticky: {
    field:   'sticky',
    label:   { ka: 'Sticky ზოლი', en: 'Sticky Bar' },
    accepts: ['filter-bar', 'mode-bar'],
    multi:   false,
  },
  main: {
    field:   'children',
    label:   { ka: 'შიგთავსი', en: 'Content' },
    accepts: ['section', 'repeat', 'page-header'],
    multi:   true,
  },
}

export const META: NodeSliceMeta = {
  sliceType: 'page',
  type:      'inner-page',
  rootOnly:  true,
  slots:     InnerPageSlots,   // ADD
  label:     { ka: 'შიდა გვერდი', en: 'Inner Page' },
}
```

---

## 5. Final State Verification

After all steps done:

```bash
npx tsc --noEmit          # must → 0 errors
npm test                  # must → 29/29 (or current count) passing
grep -r "components/layout" packages/ plugins/ src/   # must → 0 results
grep -r "plugins/landing" src/    # must → 0 (or only pages/landing refs)
grep -r "plugins/nodes/chart"  src/  # must → 0
grep -r "plugins/nodes/table"  src/  # must → 0
grep -r "plugins/nodes/inner"  src/  # must → 0
```

**Directory structure check:**
```
plugins/chrome/       ← exists, unchanged
plugins/pages/        ← exists, new
plugins/panels/       ← exists, new
plugins/nodes/        ← exists, reduced
plugins/controls/     ← exists, unchanged
plugins/landing/      ← DELETED (merged into pages/landing/)
engine/react/src/components/layout/  ← DELETED
```

---

## 6. Anti-Patterns — ნუ გააკეთებ

```
❌ plugins/panels/chart/ imports from plugins/nodes/section/
   → ISP violation: same tier, different plugin

❌ engine/react/ imports InnerLayout from plugins/pages/
   → dependency direction violation: packages ← plugins is wrong direction

❌ SiteRenderer.tsx conditionals on page.type to apply layout
   → BEFORE pattern — after Step 2, SiteRenderer is type-agnostic

❌ Moving geo-map, stat-card or other future visualizations to nodes/
   → data viz = panels/; structural = nodes/

❌ Skipping tsc after each step
   → cascade errors become impossible to debug; verify after each move

❌ Moving logic along with files
   → this is file organization only; rendering pipeline, types, behavior = unchanged
```

---

## 7. Step Order Summary (one-glance)

```
Step 1   engine/react/engine/types.ts          SliceType + navContext
Step 2   engine/react/engine/SiteRenderer.tsx  populate navContext, remove InnerLayout import
Step 3   plugins/pages/inner-page/               create + move + InnerPageShell update
Step 4   plugins/pages/container-page/           move + META update
Step 5   plugins/pages/tab-page/                 move + META update + tabs.css
Step 6   plugins/pages/landing/                  move from plugins/landing/
Step 7   plugins/panels/chart/                   move + META update
Step 8   plugins/panels/table/                   move + META update
Step 9   plugins/panels/kpi-strip/               move + META update
Step 10  src/setupRegistrations.ts               update all imports
Step 11  engine/react/components/layout/       DELETE directory
Step 12  plugins/nodes/index.ts                  final cleanup (remove moved items)
── optional ──
Step 13  InnerPageNode.frame                     Innovation 2 type field
Step 14  InnerPageSlots                          Innovation 3 named slots
```

**Total files moved:** ~35 files
**Total files deleted:** ~5 files (layout/ directory + merged landing/)
**Logic changes:** 2 files (SiteRenderer + InnerPageShell)
**Type changes:** 1 file (types.ts)
**tsc checkpoints:** 12 (one per step)

---

## 8. კავშირი არსებულ არქიტექტურასთან

**Rendering Pipeline v2 (11 gaps) — არ იცვლება:**
- RepeatShell, EventBus, GlobalState, DataLinks, Middleware — ყველა nodes/-ში რჩება
- renderNode.ts pipeline — ხელუხლებელი
- RenderContext — მხოლოდ `navContext?` ემატება (additive)

**defineShell, NodeRegistry — არ იცვლება:**
- `registerSlice(slice)` — იგივე API
- shell lookup: `nodeRegistry.get(type, variant)` — იგივე
- sliceType `'page'` | `'panel'` — NodeRegistry-ი მათ 'node'-ივით სამუშაოდ ინახავს
  (Constructor Phase 2 = palette categorization by sliceType)

**packages/ dependency order — იგივე:**
```
engine/expr ← engine/core ← engine/react ← engine/styles
```
engine/react-ს ახლა plugins/-ზე დამოკიდებულება **ნულია** (InnerLayout გადასვლის შემდეგ).