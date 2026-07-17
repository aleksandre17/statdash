---
id: "0076"
title: "HOUSEKEEPING — docs taxonomy consolidation: one audit home, proposals lifecycle-sorted, historical registers marked"
status: REGISTERED (housekeeping, not a stratum — ride a stage boundary; no launch during freeze)
class: S
priority: P2
owner: —
implements: owner 2026-07-15 ("environment organized like a professional team") — the residual after the lead's same-day pass (BOARD projection rewrite + README authority chain)
depends_on: []
---
**Already done (2026-07-15, lead):** `work/BOARD.md` = thin projection of ROADMAP+REGISTRY+cards (the register rule: 3 sources of truth, git = shipped log, board never forks a status) · `docs/architecture/README.md` = correct authority chain (ROADMAP → REGISTRY → decisions → proposals → audit → reference) · `docs/plan/` marked HISTORICAL.

**Remaining (do at a stage boundary, read-informed, never blind):**
1. **Two audit homes** — `docs/audit/` (old) vs `docs/architecture/audit/` (current, DEEP-*): merge to ONE (`docs/architecture/audit/`), superseded files get a `SUPERSEDED-BY:` header, nothing deleted without a pointer.
2. **`docs/architecture/proposals/` (53 files, mixed SPEC/DESIGN/STUDY/CONCEPT/PLAN):** add a lifecycle stamp header to each (`ACTIVE · BUILT (implemented — reference) · SUPERSEDED-BY <x>`) — the registry rows already know most statuses; project them into the files. No renames needed; the stamp is the sort.
3. **`docs/{archive,knowledge,layers,patterns,rules,plan}/` top-level sprawl:** verify each against reality — mark HISTORICAL (like docs/plan) or fold into the architecture corpus; `docs/INDEX.md` updated to the same authority chain as `docs/architecture/README.md`.
4. **`work/board/render-pipeline.md`** — stamp DONE/ARCHIVED header (epic closed 2026-07-02).

**Boundary:** documentation-only; zero code; nothing deleted, only stamped/moved with pointers; one commit.
