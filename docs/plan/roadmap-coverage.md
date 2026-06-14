# Roadmap — Coverage Check (all 34 gaps + N-moves mapped)

> Full layer details: see individual phase files in `docs/plan/`.

---

## Coverage check — all 34 gaps mapped

| Gap | Layer | Gap | Layer | Gap | Layer |
|-----|-------|-----|-------|-----|-------|
| 1  | 1.1 | 13 | 4.4 | 25 | 3.4 |
| 2  | 0.1 | 14 | 4.4 | 26 | 2.2 |
| 3  | 3.3 | 15 | 0.3 | 27 | 0.4 |
| 4  | 3.3 | 16 | 0.1 | 28 | 2.1 |
| 5  | 3.2 | 17 | 0.5 | 29 | 0.1 |
| 6  | 4.2 | 18 | 3.1 | 30 | 2.3 |
| 7  | 4.1 | 19 | 4.5 | 31 | 6.1 / 6.2 |
| 8  | 1.2 | 20 | 5.1 | 32 | 6.4 |
| 9  | 1.2 | 21 | 5.2 | 33 | 0.2 |
| 10 | 4.3 | 22 | 5.3 | 34 | 1.1 |
| 11 | 2.1 | 23 | 0.3 |    |     |
| 12 | 6.3 | 24 | 1.2 |    |     |

All 34 gaps assigned across 8 phases (0–7), 27 layers. No layer exceeds M. Every layer is independently deployable under the Operating Rules.

---

## Root-cause → phase map

| Root cause | Eliminated by |
|------------|---------------|
| A — Open registry, closed mirrors | Phase 0 (0.1, 0.2) |
| B — Datasources not first-class JSON | Phase 3 (3.1–3.4) + Phase 7.1 |
| C — Validation/observability disconnected | Phase 0 (0.4) + Phase 5 (5.3) + 0.1/0.2 diagnostics |
| D — Duplicated seams break one structure | Phase 2 (2.1–2.3) |

---

## N-move coverage (Tier 1 / 2 / 3)

| N | Layer | N | Layer | N | Layer |
|---|---|---|---|---|---|
| N1 | 8.1 | N11 | 9.1 | N21 | 9.11 |
| N2 | 7.2 + 9.1 | N12 | 9.6 | N22 | 9.12 |
| N3 | 8.2 | N13 | (gated) | N23 | 9.13 |
| N4 | 7.1-adjacent | N14 | 9.2 | N24 | 9.5 |
| N5 | 8.3 | N15 | 9.3 | N25 | 9.14 |
| N6 | 1.1 | N16 | 9.7 | N26 | 10.1 |
| N7 | 8.4 | N17 | 9.4 | N27 | 10.2 |
| N8 | — | N18 | 9.8 | N28 | 10.5 |
| N9 | 3.1 + 7.1 | N19 | 9.9 | N29 | 10.6 |
| N10 | 9.1 | N20 | 9.10 | N30 | 10.3 |
|  |  |  |  | N31 | 10.4 |
|  |  |  |  | N32 | 0.6 |
|  |  |  |  | N33 | 0.7 |

Every gap (1–34) and every architecture move (N1–N31) is assigned a layer. 11 phases (0–10). No layer exceeds M; L items are explicitly split or evidence-gated.

---

## Suggested sequencing

Phase 0 first (breaking/lying — highest value, smallest effort). Then Phase 1 (purity unblocks multi-site) and Phase 2 (coupling/DRY) can proceed in parallel by different engineers — they touch different files. Phase 3 is the largest investment (the Constructor gate) and depends on 0.2/0.4. Phases 4–6 are hardening and readability — low-risk, parallelizable. Phase 7 is the ceiling-raiser, gated on Phase 3.
