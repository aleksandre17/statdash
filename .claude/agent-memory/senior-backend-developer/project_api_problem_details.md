---
name: api-problem-details
description: api error contract is RFC 9457 problem+json via one registry+handler; the Fastify error-handler-ordering pitfall that gates it
metadata:
  type: project
---

The api error contract is RFC 9457 Problem Details (`application/problem+json`), one canonical mechanism (chief-engineer F6/C-4, Law-4 completeness).

**Shape & registry:**
- The `ProblemDetails` wire shape + `PROBLEM_CONTENT_TYPE` + `PROBLEM_URN_PREFIX` (`urn:statdash:problem:<kind>`) live in `@statdash/contracts` (`packages/contracts/src/problem.ts`) — it crosses the api↔runner/panel boundary the arrow forbids, same rationale as SiteManifest. Pure types + const literals only (passes the zero-dep purity fitness gate).
- The problem catalogue (registry/factory) + `Problem` error class are api-local in `apps/api/src/lib/problem.ts`: `PROBLEM_REGISTRY` maps kind→{urn,title,status}. New error kind = ONE registry entry, no central switch (OCP, open-registry discipline). Helpers: `problem(kind,detail,ext)`, `notFound/unauthorized/forbidden/conflict/gone/badRequest`, `validationProblem(zodErr)`, `toProblem(unknown)`.
- `apps/api/src/lib/http.ts` `HttpError` is now a thin Strangler-Fig adapter that subclasses `Problem` (maps status→kind), so every existing `throw new HttpError(status,msg)` call site converts unchanged. `ValidationError` was removed; `parse*` now throw `validationProblem`.
- Central serializer: `apps/api/src/lib/error-handler.ts` `registerProblemErrorHandler(app, {includeStack})`. Tests register the EXACT production handler (no hand-rolled copy that drifts).

**THE PITFALL (load-bearing, root cause):** a Fastify `setErrorHandler` is inherited by a child encapsulated plugin at THAT plugin's registration time. If you `app.register(routePlugin)` THEN `registerProblemErrorHandler(app)`, the route plugin already captured the inherited (default) handler and your handler never cascades into it → routes fall back to Fastify's default `{statusCode,error,message}` shape (wrong content-type). FIX: register the error handler BEFORE any route plugin. `index.ts` and every test `buildApp` now install it first. This was latent before (old handler + Fastify default both produced `{error,message}`-ish bodies, and status-only tests never caught it).

**409 forward-compat (the cited site):** `apps/api/src/routes/config/pages.ts` GET /:id schema-ahead now throws `new Problem('config-schema-ahead', detail, { code, configSchemaVersion, currentSchemaVersion })` — structured extension members, not stuffed JSON. `currentSchemaVersion` comes from `CURRENT_SCHEMA_VERSION` (`@statdash/engine`).

**Clients today consume errors opaquely** (`packages/plugins/datasources/stats-api.ts`, `packages/core/src/data/store-api.ts` read only `res.status` + body-as-text). RFC 9457 is the contract that makes structured consumption possible later; shape is in contracts ready for it.

**Tests:** `apps/api/src/lib/error-handler.test.ts` (pure, no DB) asserts content-type + the 5 members + extensions for 404/401/403/410/400-validation/409-schema-ahead/500. Green: api typecheck+build+lint(0)+suite 110 passed/35 skipped; platform-wide 1007 passed/35 skipped.
