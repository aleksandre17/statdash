---
RECONNAISSANCE: Geostat-Kit & Workspace Compatibility
Agent: Explorer (Haiku) | Date: 2026-06-14
---

# Kit + Workspace Compatibility

Geostat-kit works equally well with **npm workspaces** (current national-accounts) or **fully independent modules** (geostat-chat-ai). Kit doesn't care about the npm resolution tree.

## Two Approaches: Workspace vs Independent

### geostat-chat-ai (No Workspace)

- **No root package.json**
- Each app (backend, frontend, ingestion, retrieval):
  - Own package.json
  - Own node_modules/
  - Fully independent npm resolution
- Kit manifests each as separate module

**Tradeoff:**
- ✓ True isolation, zero coupling
- ✗ Each app installs full devDeps (no dedup)
- ✗ Harder to enforce consistent lint/build rules

### national-accounts (Workspace)

```json
{
  "workspaces": ["apps/*"],
  "devDependencies": {
    "eslint": "^9.39.4",
    "typescript": "~5.9.3",
    "vite": "^8.0.1",
    "@vitejs/plugin-react": "^6.0.1"
  }
}
```

- Root workspaces declaration
- Shared devDependencies at root
- Single node_modules (hoisted)
- 2 apps (geostat, panel)
- Shared engine/* packages (via tsconfig paths)

**Tradeoff:**
- ✓ Single npm install (faster)
- ✓ Shared devDeps (smaller disk, DRY)
- ✓ Consistent linting/build tools
- ✗ Cross-app lint/build can have unintended side effects

## How Kit Treats Each

Kit doesn't care about npm structure. It:

1. **Reads manifest** → gets module path (e.g., `apps/geostat`)
2. **Sets CWD** to that path
3. **Calls npm scripts** in that CWD

### Workspace Case
```bash
cd apps/geostat
npm run dev
# npm respects workspace; uses root devDeps, runs scripts in app context
```

### Independent Case
```bash
cd apps/geostat
npm run dev
# npm finds apps/geostat/package.json, uses local node_modules
```

Both work. Kit doesn't care which.

## National-Accounts Structure

```
national-accounts/
├── package.json              ← Root workspace (shared devDeps)
├── tsconfig.json             ← Root composite (paths to engine/)
├── eslint.config.js          ← Shared lint config
├── node_modules/             ← Single, hoisted
│
├── apps/
│   ├── geostat/
│   │   ├── package.json      ← App-level (workspace member)
│   │   ├── tsconfig.json     ← Child of composite
│   │   ├── vite.config.ts    ← Owns its build
│   │   └── src/
│   │
│   └── panel/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│
├── engine/
│   ├── core/          ← No package.json (compiled via tsc -b)
│   ├── react/         ← Shared packages imported via tsconfig paths
│   ├── expr/
│   ├── styles/
│   └── plugins/
│
└── ops/
    ├── compose/
    └── scripts/
```

**Key:** Engine packages are NOT npm modules, just folders. They're imported via tsconfig paths. Apps can only import from engine/ and each other (within same workspace).

## If Using Kit: Per-Module Requirements

**Each app still needs:**
- own package.json (even in workspace; it's a workspace member)
- own vite.config.ts / tsconfig.json / eslint.config.js
- own src/, public/, etc.

**Kit expects:**
- Module path has package.json + scripts (dev, build, etc.)
- Scripts are defined in root package.json (for workspace) or app package.json

### Example Kit Manifest (if adopting kit)

```json
{
  "modules": {
    "geostat": {
      "path": "apps/geostat",
      "type": "node-vite",
      "role": "ui",
      "secretsModule": "geostat",
      "debug": {
        "npmScript": "dev"
      }
    },
    "panel": {
      "path": "apps/panel",
      "type": "node-vite",
      "role": "ui",
      "secretsModule": "panel",
      "debug": {
        "npmScript": "dev"
      }
    }
  }
}
```

Kit would:
1. `geostat dev bootstrap` → dispatch to apps/geostat
2. Call `npm run dev` (or kit's compose/rsync wrapper)
3. Use `ops/config/geostat/.env.dev`, `.env.deploy`, etc.

Workspace means `npm run dev --workspace apps/geostat` OR just `npm run dev` (if root scripts are set up that way).

## Scaling: Adding a 3rd App

**To add another app (e.g., admin):**

1. Create `apps/admin/` with own package.json, vite.config.ts, tsconfig.json, src/, index.html
2. Root package.json already covers it (workspaces: ["apps/*"])
3. Update root scripts: add `dev:admin`, `build:admin`, etc. (optional)
4. Update root tsconfig if needed (if admin uses engine/* imports)
5. If using kit: add to manifest.modules

**No workspace changes needed; npm automatically includes it.**

## Workspace Hygiene

**Potential issues (both workspaces and independent modules can have):**

1. **Circular dependencies:** App A imports from App B, B imports from A → build fails
   - Workspace doesn't prevent this; linting does
   - Kit doesn't care; it's a dev team problem

2. **Version conflicts:** Two apps depend on react@19 vs react@18 → npm hoists one, one app breaks
   - Workspace enforces single version
   - Independent modules allow divergence (intentional isolation)

3. **Shared devDeps version skew:** Root has eslint@9, app expects eslint@8 → lint breaks
   - Workspace enforces single version
   - Independent modules don't have this risk

**For national-accounts:** Workspace is fine if apps stay aligned on versions. Monitor root package.json for conflicts.

## Verdict

**Current workspace is optimal for national-accounts.** Kit will work seamlessly:
- No changes to workspace structure needed
- Each app still owns its build config
- Kit manifests each app independently
- Shared devDeps / engine packages remain a win

**If you ever want to split into fully independent modules,** kit will still work; just means each app gets its own package.json with all devDeps (larger disk, slower install, but true isolation).
