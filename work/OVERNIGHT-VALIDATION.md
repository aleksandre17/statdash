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
| **api Docker image — FULL STACK IN ONE NETWORK** | ✅ `statdash-api:validate` (407MB) builds + runs on the server, container `statdash-validate-api` on `statdash-net` talking to the cube in `statdash-validate-pg`. `/health` ok, `/api/bootstrap` serves the SDUI config, all 3 datasets serve exact counts, **verify-parity GREEN against the containerized api** (row-for-row value parity). Your recurring question — "does everything start in one network?" — is now answered: **YES.** |

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

### See it live in the morning
Both validation containers are LEFT RUNNING on the server so you can see the stack live:
- On the server: `curl http://localhost:3010/health` → `{"status":"ok",…}`; `curl http://localhost:3010/api/bootstrap` → the SDUI config.
- Containers: `statdash-validate-api` (port 3010→3001) + `statdash-validate-pg` (cube) on `statdash-net`, isolated from the reference-project containers.

### In progress / next
- **api Docker image — DONE** ✅ (see the table above). The Dockerfile now ships the built workspace (api dist + engine packages' dist + resolved node_modules) rather than `pnpm deploy`, which was version-fragile (pinned pnpm@9.15 rejects `--legacy`; new-deploy needs `inject-workspace-packages`). FOLLOW-UP (not blocking): slim the 407MB image via a pinned `pnpm deploy` once the deploy version story is settled — correctness shipped first.
- Deferred per your call: CI (the `.github/workflows/ci.yml` is stale `@geostat`→`@statdash` — refresh when you want CI).
- Cleanup (when you're done inspecting): `docker rm -f statdash-validate-api statdash-validate-pg` and `rm -rf /tmp/statdash-*` on the server.

### The takeaway
The platform was beautifully tested but had never *run*. It has now run, end-to-end: migrations + seed on a real TimescaleDB, 136/136 DB-gated tests, and — the last piece — the **api Docker image built and running on the server, in one isolated network, serving the cube with row-for-row parity**. Hardened by 11 real fixes in the process (10 data-layer + the version-fragile Dockerfile). Your instinct to demand the real run, and your push-back that "we HAVE a Linux server with Docker — what's the problem?", were both exactly right.
