# Embedded backend worker disabled

Use when the **worker role** is a separate manifest module (e.g. `ingestion`), not `apps/backend/worker`.

1. `ops/compose/catalog.json`: `"features": { "worker": false }`
2. `geostat compose-gen`
3. Declare worker deployables in `geostat.ops.json` `modules` + `stack.composeModules`.
