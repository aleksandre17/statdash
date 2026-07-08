---
name: briefing-economy-and-fresh-intel
description: Brief with precise slices not whole fat files; and our intel layer (registry/benchmark) must be CODE-verified, not doc-derived — stale/fat intel makes every agent launch expensive AND wrong
metadata:
  type: feedback
---

**Owner observed (2026-07-08): an Opus architect launch "fired 90k tokens at the start."** Root-caused two ways, both the lead's briefing defect:

**1. Intel shared as WHOLE FAT FILES, not slices.** The brief said "read `ARCHITECTURE-REGISTRY.md`" (12,600 tokens) when the agent needed only the AR-48 entry (~800). Mission-command says *don't fence the thinking* — it does NOT say *dump 50KB*. Precise intel + freedom to roam is the ideal.
- **How to apply:** point at a SLICE or say "grep AR-48 in <file>", never "read <large file>" when a section suffices. Input compounds — the loaded context is re-sent every turn, so a fat file read once is paid ~N times over the agent's turns.

**2. Our intel layer is STALE, so agents burn tokens re-discovering ground truth.** The AR-48 brief (built on the benchmark + registry) claimed "export is a STUB"; the architect found the delivery backend **~80% built to reference grade** in code (export registry, SnapshotStore, V36 migration, `/api/embed` mounted). The benchmark row #14 + `plugins/CLAUDE.md` "stub" note were DOC-DERIVED, not code-verified — so the agent spent its budget disproving our own note.
- **How to apply:** the benchmark/registry "We-today" cells are CLAIMS with an expiry; a Leader's-Scan MUST re-ground the relevant cell against code before briefing on it (the benchmark file's own rule #1). A benchmark that mis-scores a built capability as a gap is worse than no benchmark — it sends expensive agents at phantom work.

**Standing structural fixes (queued):** split `ARCHITECTURE-REGISTRY.md` (50KB god-file, read on every scan/design) into index + per-AR detail, load-on-demand — the same two-layer discipline applied to agent-memory. Until then, always grep the one AR entry, never read the whole registry.
