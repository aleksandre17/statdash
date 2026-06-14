import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Panel (Constructor platform) — engine layers resolved via aliases.
// After `pnpm install`, @geostat/* aliases can be dropped — workspace:* protocol
// resolves them through node_modules.  @plugins keeps its alias during the gradual
// migration to @geostat/plugins sub-paths (catalog / registry).
//
// ESLint enforces: no src-relative reach-ins to engine/ (use @geostat/* or @plugins).

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // @geostat/plugins must come before @plugins (more specific prefix wins).
      { find: '@geostat/plugins', replacement: resolve(__dirname, '../../engine/plugins')   },
      { find: '@plugins',         replacement: resolve(__dirname, '../../engine/plugins')   },
      { find: '@geostat/expr',    replacement: resolve(__dirname, '../../engine/expr')       },
      { find: '@geostat/styles',  replacement: resolve(__dirname, '../../engine/styles/src') },
      { find: '@geostat/engine',  replacement: resolve(__dirname, '../../engine/core/src')   },
      { find: '@geostat/react',   replacement: resolve(__dirname, '../../engine/react/src')  },
      { find: '@',                replacement: resolve(__dirname, 'src')                      },
    ],
  },
})
