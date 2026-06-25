/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'static' (default) | 'api' | 'stats' — selects the data layer */
  readonly VITE_STORE_MODE?: 'static' | 'api' | 'stats'
  /** Base URL of the real stats API (stats mode). Empty/unset → relative `/api/...` (same-origin). */
  readonly VITE_API_STATS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}