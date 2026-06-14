/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'static' (default) | 'api' — selects the data layer */
  readonly VITE_STORE_MODE?: 'static' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
