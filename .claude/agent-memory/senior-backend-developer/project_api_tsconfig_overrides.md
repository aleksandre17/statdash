---
name: project-api-tsconfig-overrides
description: A Node-emitting TS package under platform/ must override the root tsconfig's bundler/noEmit settings
metadata:
  type: project
---

The root `platform/tsconfig.json` is tuned for Vite/bundler apps: `noEmit: true`, `moduleResolution: bundler`, `allowImportingTsExtensions: true`, `composite`-style project refs, and a large `paths` map for `@statdash/*`.

Any package that actually emits JS for Node (e.g. `apps/api`, a Fastify/tsx service) and uses `module/moduleResolution: NodeNext` must override, in its own tsconfig: `noEmit: false`, `allowImportingTsExtensions: false`, `composite: false`, reset `paths: {}` and `references: []`, and set `types: ["node"]`. Otherwise `tsc -p tsconfig.build.json` silently emits nothing (noEmit inherited) or errors on `.ts` import extensions vs the required `.js` ESM specifiers.

**Why:** The platform's default TS config assumes no emit (bundler owns it). Node services break that assumption.

**How to apply:** When adding a backend/Node TS package, start from this override set and verify the build actually populates `dist/` with `.js` files that keep `.js` import specifiers. See [[project-toolchain-facts]].
