---
name: escalated-type-decisions
description: Two typecheck error clusters that are architectural decisions (not mechanical fixes) — control category taxonomy and the 'custom' DataSpec union gap
metadata:
  type: project
---

Two `tsc` error clusters in the geostat typecheck are genuine architectural decisions, deliberately left unfixed (escalated) rather than guessed.

**1. Control `category` vs `SliceCategory` (6 errors, TS2322)**
Files: `engine/plugins/controls/{cascade,hidden,multi-select,range,select,year-select}/default/index.ts` line ~11.
Each control's META sets `category` to a *filter-domain* value (`'geo'`, `'time'`, `'indicator'`, `'internal'`) but `FilterControlMeta.category` is typed `SliceCategory` (`'page'|'data'|'layout'|'content'|'filter'` — a *structural-palette* taxonomy in `engine/react/src/engine/slice-meta.ts`).
**Why unresolved:** No consumer reads control `category` (grep-confirmed). Three valid fixes, each a taxonomy decision: (a) all controls are structurally `'filter'` and the domain label moves to a new field e.g. `dimension`; (b) widen `FilterControlMeta.category` to an open string; (c) set all to `'filter'` and drop the domain info. Choosing loses/relocates semantic info → needs team intent.
**How to apply:** If asked to resolve, recommend option (a) — add a separate `dimension?: string` field to FilterControlMeta and set `category: 'filter'` — it preserves both taxonomies (structural for palette, domain for filtering).

**2. `custom` DataSpec type (2 errors, TS2678)**
Files: `engine/core/src/data/spec.ts:163` and `engine/core/src/validation/pipeline.ts:120` — both have `case 'custom':` but the `DataSpec` union (`engine/core/src/config/section.ts:74`) has NO `custom` member.
**Why unresolved:** Contradiction between SSOT and docs/code. The union (SSOT) lacks `custom`; yet root `CLAUDE.md` + `engine/CLAUDE.md` list `custom` as a DataSpec type, and `pipeline.ts:120` actively *warns* that custom specs use a function (non-serializable, violates Law 2). No config produces `type:'custom'`, no `CustomSpec` type exists. Either (a) `custom` was removed and the two `case` clauses are dead branches to delete, or (b) it is a planned/deprecated type to re-add. Deleting the validation warning could silently drop a Law-2 guard.
**How to apply:** If asked to resolve, the validation warning at pipeline.ts:120 is the clue — it intentionally flags custom-fn specs as deprecated. Likely correct resolution: delete both dead `case 'custom':` branches (the registry `registerSpec()` is the sanctioned extension path per section.ts:72), and remove `custom` from the CLAUDE.md DataSpec lists. Confirm with team first.
