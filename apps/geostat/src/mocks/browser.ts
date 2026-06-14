// ── MSW browser worker — Layer 2 mock HTTP server ─────────────────────
//
//  Intercepts fetch('/api/datasets/*') at the Service Worker level.
//  Handlers return raw dataset JSON → site-manifest adapts to Observation[].
//
//  Only started when VITE_STORE_MODE=api (see main.tsx).
//  In static mode this file is never imported — zero overhead.
//
import { setupWorker } from 'msw/browser'
import { handlers }    from './handlers'

export const worker = setupWorker(...handlers)