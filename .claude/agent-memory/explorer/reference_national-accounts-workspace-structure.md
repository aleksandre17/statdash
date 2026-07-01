---
name: national-accounts-workspace-structure
description: Current national-accounts repo structure - two-app npm workspace with shared devDeps
metadata:
  type: reference
---

# National-Accounts Workspace Structure

## Current State

**Root:** `C:\Users\Test-User\WebstormProjects\national-accounts`

**package.json** (npm workspace):
```json
{
  "name": "statdash-platform",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "npm run dev --workspace apps/geostat",
    "dev:geostat": "npm run dev --workspace apps/geostat",
    "dev:panel": "npm run dev --workspace apps/panel",
    "build": "npm run build --workspace apps/geostat",
    "build:geostat": "npm run build --workspace apps/geostat",
    "build:panel": "npm run build --workspace apps/panel",
    "lint": "eslint .",
    "compose:up": "docker compose -f ops/compose/docker-compose.yml ...",
    "compose:down": "..."
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@vitejs/plugin-react": "^6.0.1",
    "@types/react": "^19.2.14",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.39.4",
    "typescript": "~5.9.3",
    "vite": "^8.0.1",
    "vitest": "^4.1.6",
    "// ... more shared devDeps"
  ]
}
```

## Modules (2 apps)

### apps/geostat
- **Type**: SPA (Vite + React)
- **package.json** (app-level, workspace member)
  ```json
  {
    "name": "national-accounts",
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "dev:api": "cross-env VITE_STORE_MODE=api vite",
      "build": "tsc -b && vite build",
      "build:mock": "tsc -b && cross-env VITE_STORE_MODE=api vite build"
    },
    "dependencies": { "react": "^19.2.4", "react-dom": "^19.2.4", "react-router-dom": "^6.22.0", ... },
    "devDependencies": {} // Inherits root workspace devDeps
  }
  ```
- **vite.config.ts**: Standard Vite config, resolves paths to `engine/*` packages via tsconfig paths
- **tsconfig.json**: App-level, references root tsconfig via composite project refs

### apps/panel
- **Type**: SPA (Vite + React)
- **package.json**: Similar to geostat, member of workspace
- **vite.config.ts**: Standard Vite
- **tsconfig.json**: App-level

## Shared Config (Root Level)

**tsconfig.json** (root):
```json
{
  "files": [],
  "references": [
    { "path": "./apps/geostat" },
    { "path": "./apps/panel" }
  ],
  "compilerOptions": {
    "target": "ES2020",
    "moduleResolution": "bundler",
    "paths": {
      "@plugins": ["./engine/plugins"],
      "@geostat/expr": ["./engine/expr/index.ts"],
      "@geostat/styles": ["./engine/styles/src/index.ts"],
      "@geostat/engine": ["./engine/core/src/index.ts"],
      "@geostat/react": ["./engine/react/src/index.ts"]
    }
  }
}
```

**Key characteristics:**
- Composite projects (file references) — each app builds independently but shares type definitions
- Shared tsconfig paths pointing to `engine/*` packages (not in apps/)
- All apps resolve "@geostat/*" to shared engine packages

**eslint.config.js** (root): Linter rules shared across all apps

## Engine Packages (Not Apps)

Directory: `engine/`
- Not listed in package.json workspaces (workspaces only "apps/*")
- Imported via tsconfig paths, not npm modules
- Pure TypeScript packages:
  - `engine/core/` → `@geostat/engine`
  - `engine/react/` → `@geostat/react`
  - `engine/expr/` → `@geostat/expr`
  - `engine/styles/` → `@geostat/styles`
  - `engine/plugins/` → `@plugins`
- No separate package.json per package (compiled in-place via tsc -b)
- Used as import paths, not npm modules

## Layout Analysis

```
national-accounts/
├── package.json                    ← Root workspace (defines shared devDeps)
├── tsconfig.json                   ← Root composite config (paths to engine/)
├── eslint.config.js                ← Shared lint rules
├── node_modules/                   ← Single shared node_modules (workspace benefit)
│
├── apps/
│   ├── geostat/
│   │   ├── package.json            ← App-level (inherits workspace devDeps)
│   │   ├── tsconfig.json           ← App composite child
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   └── build/dist/
│   │
│   └── panel/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── src/
│       └── build/dist/
│
├── engine/
│   ├── core/
│   │   ├── src/
│   │   └── (no package.json, compiled via tsc -b)
│   │
│   ├── react/
│   │   ├── src/
│   │   └── (no package.json)
│   │
│   ├── expr/
│   ├── styles/
│   └── plugins/
│
├── ops/
│   ├── compose/
│   ├── scripts/
│   └── ...
│
└── ... (CLAUDE.md, memory files, etc.)
```

## Key Workspace Properties

| Aspect | Behavior |
|--------|----------|
| **npm install** | Single run at root; hoists shared devDeps; all apps use root node_modules |
| **npm run dev** | Must specify workspace: `npm run dev --workspace apps/geostat` |
| **npm run build** | Same; explicit workspace targeting |
| **tsc -b** | Composite; builds all refs (both apps + engine packages) in dependency order |
| **lint** | Root eslint runs across all .js/.ts files in monorepo |
| **Cross-app deps** | Via tsconfig paths (e.g., geostat imports from @geostat/react) |
| **Per-app isolation** | Each app can have its own Vite dev server; separate build outputs |

## Implications for Kit Integration

**If using geostat-kit:**

1. **Per-module package.json:** Each app (geostat, panel) already has its own package.json
   - Kit expects this (modules.{id}.path → package.json in that folder)
   - **Compatible with current structure**

2. **Shared workspace vs independent:** Kit doesn't care
   - If workspace exists, `npm run dev` respects it
   - If apps were independent (no workspace), `npm run dev` would work per-app
   - **Current workspace is fine**

3. **Engine packages:** Kit ignores them
   - Engine packages are not modules in kit's sense
   - They're compiled in-place via `tsc -b`
   - Kit only manages `apps/{geostat,panel}`
   - If you add a 3rd app (e.g., admin), add to apps/ and manifest

4. **TSConfig paths:** Respect the composite structure
   - Root tsconfig with references to app tsconfigs
   - Paths point to engine/ packages
   - Kit doesn't interfere; all pre-existing

5. **Vite config per app:** Each app has its own
   - Not auto-generated by kit
   - Each can set `envDir`, `alias`, etc. independently
   - E.g., geostat can use `../../ops/config/geostat/` for envDir

## Workspace Scaling Notes

**Current (2 apps):**
- Very fast: single npm install, shared node_modules
- Clean separation: each app owns its src/, vite.config, index.html

**If adding a 3rd app:**
1. Create `apps/{id}/` with package.json, vite.config.ts, tsconfig.json, src/, index.html
2. Add workspace member to root package.json: `"apps/*"` already includes it
3. Add app to root tsconfig references if needed
4. Update root scripts: add `dev:{id}`, `build:{id}`, etc.
5. If using kit: add to geostat.ops.json modules with `type: "node-vite"`, `path: "apps/{id}"`, etc.

**Performance consideration:**
- Single npm install for all apps (faster for teams)
- Shared lint config (consistency)
- But: all devDeps installed for every app (even if not used)
- Drawback: circular dependencies between apps can cause issues; lint/build can cross boundaries

**Alternative (fully independent):**
- No root workspace; each app has own package.json + node_modules
- Remove root workspaces, scripts
- Each app installs independently (slower for CI, larger disk)
- More isolation; each app truly independent

**Kit supports both; current workspace is fine.**
