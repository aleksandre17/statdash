---
name: checklaws-path-coupling
description: check-laws.sh + build-verify.sh hardcode platform/<libdir> paths — a dir rename silently false-greens them
metadata:
  type: project
---

`ops/scripts/check-laws.sh` and `ops/scripts/build-verify.sh` hardcode absolute scan paths to the
platform library dir (now `platform/packages/{core,react,plugins}` after the engine/->packages/ move;
were `platform/engine/*`). The scripts themselves are cwd-INDEPENDENT (each derives ROOT from
`$(dirname "$0")/../..`), so they run correctly from anywhere.

**SEPARATE bug, FIXED 2026-06-25:** `platform/package.json` referenced `ops/scripts/*.sh` and
`ops/compose/*` with a path RELATIVE TO REPO ROOT, but pnpm runs scripts with cwd = the package dir
(`platform/`), and `ops/` is a SIBLING of `platform/`. So `pnpm check-laws` (and validate:local,
layer-status, build-verify, compose:*) failed "No such file" from platform/. Fixed the whole class by
prefixing `../` → `../ops/...` (resolves relative to platform/ regardless of invocation cwd). Verified
`pnpm check-laws` from platform/ now scans real files and prints "All laws clean".

**Why this matters:** if the lib dir is renamed/moved and these vars are NOT updated, the grep targets a
non-existent path, finds zero files, and check-laws prints "✅ All laws clean" — a FALSE GREEN. The fitness
function silently stops enforcing. Always update these path vars in lockstep with any library-dir restructure
and re-run check-laws to confirm it scans REAL files (it should then surface the pre-existing Law 4 hit).

**Baseline UPDATE (2026-06-25):** check-laws is now FULLY GREEN ("All laws clean", 8/8) from both repo
root and platform/. The former Law 4 "no hardcoded Georgian text" red is resolved — the catalog labels are
now exempted via the `LAW4_CATALOG_ALLOW` allowlist in check-laws.sh (spec-catalog|op-schemas|param-schemas|
visibility-schemas|rowspec-schemas) plus the inline `{ka,en}` LocaleString exemption (a line with an `en:`
sibling is a compliant inline LocaleString). So a green check-laws is now the expected state, not a known-red
baseline.

**Retirement-lock seam (added 2026-06-27, MED-2):** check-laws.sh now has TWO grep helpers.
`check_ts` (the i18n/dim laws) EXEMPTS comments + `.test.` files + the catalog allowlist — right for
"don't ship tenant content," wrong for "this surface is deleted forever." So a second helper `check_zero`
scans `*.ts/*.tsx/*.json` with NO comment/test/catalog exclusions — a deleted token cannot creep back in a
comment, a test fixture, or a seed JSON. Use `check_zero` for any future grep-zero RETIREMENT lock; use
`check_ts` for the content laws. The first three `check_zero` users are the System-A `modes` retirement
(ManifestMode/DEFAULT_MODES; `.modes` field; site_config 'modes' seed key) across
contracts/api/geostat tiers + the provisioning artifact. NOTE: `check_zero` paths are hardcoded
(`$ROOT/platform/{packages/contracts/src,apps/api/src,apps/geostat/src,apps/api/provisioning}`) — same
false-green-on-rename coupling as above; update in lockstep with any tier move.

See [[migration-progress]] Phase 4 for the full reference-update inventory.
