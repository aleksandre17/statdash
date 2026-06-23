# 🌙 Overnight Validation Report — 2026-06-23 → morning

## Headline: the #1 risk is CLOSED — the entire data layer is validated against a REAL TimescaleDB.

You pushed for the first real run. It happened — on your Linux server (192.168.1.199, Docker), an **isolated** `statdash-validate-pg` (timescaledb-ha:pg16) on its own `statdash-net`, untouched reference-project containers. Everything below ran against that real DB.

### What's now GREEN against a real database
| Layer | Result |
|-------|--------|
| **Migrations V1→V30** | ✅ apply clean from scratch ("Successfully applied 31 migrations, now at v30") |
| **Seed (R__ gold)** | ✅ loads clean — cube populated: **2131 obs** (367+279+1485), 99 current classifiers, 3 datasets, 11 units, **7 concepts** |
| **136 DB-gated tests** | ✅ **136/136 pass** vs the live cube (bootstrap-parity, SCD-2 vintage/as-of, ContentConstraint, concept-scheme, dataset-lifecycle FSM, category-scheme, cube-profile+classify, seed-parity) |
| **verify-parity** | ✅ bundle ↔ live API row-for-row (GDP 367, ACCOUNTS 279, REGIONAL 1485) — the api booted, provisioned, served the cube correctly |

### Real bugs the live run caught + fixed (every one invisible to mocks/unit tests)
1. **V4 hypertable** — `time_period_date` GENERATED → can't be a TimescaleDB partition dim; then trigger-populate also fails (partition NOT-NULL checked before BEFORE-triggers) → **writers provide it** via `parse_time_period`.
2. **V17** — transition-table trigger illegal on multi-event → split INSERT/UPDATE.
3. **V19/flyway** — `${from}` in a comment tripped Flyway placeholders → `placeholderReplacement=false`.
4. **Seed cross-dim parent_code** — 22 measure `parent_code`s pointed at approach values (V23 code-path is same-dim) → stripped (grouping preserved in `metadata.approach`); 20 real geo/sector hierarchies kept.
5. **time_period_date** — writers (seed + publishFacts + upsertObservation) now provide it.
6. **GDP_DEFLATOR** — referenced by obs but missing from classifiers (DSD-completeness) → added.
7. **REAL PRODUCT BUG — cube classify** — `ordinality` (bigint) → JS-string coercion broke the order-join → every combo mis-classified `missing` (would have silently broken the Constructor's capability discovery) → `(ordinality-1)::int`.
8. **Data gaps** — dimensions lacked `concept_role` (concepts 0→7); provisioning page titles `ka`-only → `{ka,en}`.
9. **Product gap** — V29 category lacked re-parent cycle prevention → `trg_category_no_cycle`.
10. **verify-parity** — cross-platform direct-invocation guard never ran `main()` (false-green) → `pathToFileURL`.

Each is committed + pushed to `aleksandre17/statdash` main (54 commits). Fitness functions lock the data invariants (DSD-completeness, no-cross-dim-parent, no-obs-INSERT-without-time_period_date).

### How to re-run the validation yourself
- Local (needs Docker): `pnpm validate:local` (one shot: migrate→seed→DB-gated tests→verify-parity).
- On the server: the isolated `statdash-validate-pg` is still up; `ops/RUNBOOK.md` has the flow.

### In progress / next
- **api Docker image build on the server** (proving the full stack — api container + cube on one network, your recurring question). Status at handoff: see below / the board.
- Deferred per your call: CI (the `.github/workflows/ci.yml` is stale `@geostat`→`@statdash` — refresh when you want CI).
- Cleanup: the throwaway `statdash-validate-pg` + `/tmp/statdash-*` on the server can be removed anytime (`docker rm -f statdash-validate-pg`).

### The takeaway
The platform was beautifully tested but had never *run*. It has now run, end-to-end, against a real database — and was hardened by 10 real fixes in the process. Your instinct to demand the real run was exactly right.
