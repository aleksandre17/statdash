---
name: wire-type-lie-localestring-render
description: Panel hand-mirrored wire types can lie (label:string vs live {en,ka}); a raw {d.label} render throws React #31 and mocks that echo the lie keep CI green
metadata:
  type: project
---

When a panel `lib/*Api.ts` type is hand-mirrored from an api route (the file header
usually admits "the wire is the boundary"), the type can DRIFT from what the route
actually returns. A LocaleString field is the classic trap: the DB column is JSONB
`{en,ka}`, the route SELECTs it verbatim, but the panel type declares `label: string`.
Because the type lies, `{d.label}` in JSX compiles clean and then throws at runtime:
**React error #31 "Objects are not valid as a React child (found: object with keys {en, ka})"** — which unmounts the editor subtree (error boundary), so the surface
just "vanishes"/"doesn't work" with no obvious cause.

**Why CI stays green (the trap that hides it):** the e2e/support mock echoes the LIE
(`label: 'National Accounts'`, a string) instead of the live wire (`{en,ka}`). A
string renders fine; the object crashes. So every suite is green while the running
app is broken — the "green ≠ works" class this team keeps hitting.

**Diagnostic move that pins it fast:** drive the REAL staging bundle (Playwright →
`:3008`, seed `sessionStorage['geostat_panel_token']` from `POST /api/auth`), register
`page.on('pageerror')`, and open the suspect dropdown. React #31 args name the exact
object shape (`{en, ka}`) → trace straight to the raw-child render + the lying type.
Confirm the wire truth with a direct `curl` of the route (it returns the object) and
grep the api SELECT. Note the panel UI defaults to KA locale — enumerate buttons by
`aria-label`, don't assume English names.

**Root-cause fix pattern (apps-only):** fix the CONTRACT type to the real LocaleString,
then resolve at the React boundary with `readLocale(d.label, locale)` (never render the
object). Fixing the type makes the compiler flag EVERY raw-object render site — expect
several (MetricEditor dataset picker + SourceAuthoringPanel cube picker shared one
root). Update the e2e mock to the `{en,ka}` shape so the suite reproduces the class.
See [[project_localestring_boundary]] (resolve {ka,en}→scalar only at/after React) and
[[project_async_store_live_render_patterns]] (mock/live divergence catalog).

**Adjacent gap found alongside:** `PUT /api/config/site` uses `z.record(z.unknown())`
— NO metric-shape validation, so a malformed/partial metric (e.g. a fake `code` that is
not a real SDMX measure) persists and is served by bootstrap unchallenged. That is a
separate, latent "registers + binds but renders empty" defect once authoring is unblocked.
