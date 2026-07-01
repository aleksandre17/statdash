---
name: perspective-axis-p2
description: Landed state for P2 of the perspective-axis refactor — canonical perspective-is/-in/-not visibility ops (with optional explicit param) + mode-* kept as byte-identical aliases + Constructor authoring registration + alias-equivalence fitness. Builds on P1.
metadata:
  type: project
---

# Perspective-axis refactor, PHASE P2 (landed 2026-06-27, builds on [[perspective-axis-p1]])

Additive, byte-identical. New CANONICAL `perspective-*` visibility ops; legacy `mode-*` retained as behavioural ALIASES (retire P6). Plan: `platform/work/VISION-mode-as-perspective-axis.v3-PLAN.md` §P2.

**How to apply:** when P3/P4+ begins, this is the landed P2 op vocabulary. The `perspective-*` ops + their authoring surfaces exist; build on them, don't re-derive.

## 1. New ops (visibility.ts) — the canonical names
- `{ op:'perspective-is';  perspective:string;   param?:string }`
- `{ op:'perspective-in';  perspectives:string[]; param?:string }`
- `{ op:'perspective-not'; perspective:string;   param?:string }`
- Resolution via NEW helper `activeForExpr(perspectiveState, param)`: explicit `param` → `perspectiveState[param]` (multi-axis, Law 1); param-less → `activePerspective(perspectiveState)` (conventional 'perspective'??'mode'??single-axis). **Param-less perspective-* == mode-* exactly** — that's the alias equivalence.
- `mode-is`/`mode-in`/`mode-not` UNCHANGED (still call `activePerspective`). They are now documented as aliases of param-less perspective-*.

## 2. SSOT tuple + Constructor authoring
- `discriminant-manifest.ts` VISIBILITY_OPS: added the 3 perspective-* ops (the `Exact<VisibilityOp, VisibilityExpr['op']>` guard FORCES this — a new union member without a tuple entry fails typecheck).
- `visibility-schemas.ts`: registered `perspectiveIsSchema`/`perspectiveNotSchema` (single `perspective` field, `enum-ref` source `'modes'`, required) + `perspectiveInSchema` (`perspectives` array). **Mirrors mode-* EXACTLY** — same `'modes'` source because `perspectiveRegistry === modeRegistry` (P0). One field renamed mode→perspective; same generic Inspector, same UX. The `param` field is NOT surfaced in the authoring schema (single-axis Constructor UX == mode-*; explicit param is for hand-written/multi-axis configs).
- **Why coverage gate forced registration:** `coverage.fitness.test.ts` iterates VISIBILITY_OPS requiring each authorable-or-allowlisted. Adding to the tuple without registering a surface fails the gate. No COVERAGE_TODO entry needed (they're surfaced).
- Panel: `visibilityFactory.ts` (VISIBILITY_LEAF_OPS + makeVisibilityExpr seeds), `VisibilityBuilder.tsx` OP_LABELS (Record<VisibilityOpId> is exhaustive → must add or won't compile).

## 3. Fitness (NEW `packages/core/src/config/perspective-p2.fitness.test.ts`)
- perspective-* against perspectiveState: active→visible / inactive→hidden / -not inverts / -in for a set / explicit `param` selects axis (cross-axis no bleed).
- **Alias-equivalence**: for a STATES matrix ({perspective:..}, {mode:..}, {}, undefined) × values, param-less perspective-* ≡ mode-* (identical result). Plus a NON-VACUOUS guard proving both ops flip true AND false.
- Also extended `visibility-schemas.test.ts` (LEAF_OPS list + perspective-* mirror assertion) + `roundtrip.fitness.test.ts` (4 perspective-* round-trip cases incl. +param).

## 4. Gate state (all green)
- geostat typecheck clean; panel `tsc -b --noEmit` clean; lint 0 errors (43 pre-existing react-refresh warnings); check-laws clean; `pnpm build:engine` clean (DTS+ESM all pkgs).
- **Full suite 1719 passed / 66 skipped / 0 failed** (1785; +13 vs P1's 1706).
- Byte-identical proof: geostat config uses `{op:eq,param:mode}` gates (read filterParams, untouched) — ZERO mode-*/perspective-* ops in config; new ops are purely additive vocabulary nothing references yet.

## 5. NOT done in P2 (later phases own these)
- navUtils.getNavMode has a P2-comment stub `{op:'perspective-is', param}` but is NOT yet wired (returns undefined for perspective-* today). The plan §P2 line listed it; it's a partial-match parser, safe. Wire when nav-sort migrates (P4).
- No config authors perspective-* yet (geostat migrates P5).
