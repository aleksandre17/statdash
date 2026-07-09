// ── Gap B guard — main.tsx MUST initialise i18next before mounting the app ──────
//
//  The live canvas lazily pulls setupCanvasRegistry → registerSlice →
//  registerSliceI18n → i18next.addResources(...), which throws on an un-init'd
//  singleton and white-screens the Page step. The panel's main.tsx originally
//  omitted the init (geostat's has it) — the suite stayed green because
//  vitest.setup.ts independently init'd i18next, masking the running-app defect.
//
//  This asserts main.tsx performs the init ITSELF, at module scope, BEFORE
//  createRoot().render(App) — the exact ordering the lazy canvas split requires. It
//  deliberately reads the SOURCE (not the runtime): the runtime i18next is init'd by
//  the test harness, so only a source assertion can catch "main.tsx forgot to init".
//  Reverting the fix (deleting the initPanelI18n() call) turns this RED.
//
import { describe, it, expect } from 'vitest'
// Read main.tsx as raw text (Vite `?raw` — no node:fs, which the panel tsconfig's
// types do not include). This deliberately inspects the SOURCE, not the runtime.
import mainSrcRaw from '../main.tsx?raw'

// Strip block + line comments first — otherwise prose like "createRoot().render()"
// inside a comment would be matched as code (the CSS-fitness comment-stripping
// lesson: scan CODE, not commentary).
const mainSrc = mainSrcRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

// Index of the app's own i18next init call (either the extracted initPanelI18n()
// SSOT or a direct i18next.init()); -1 when absent.
function initCallIndex(src: string): number {
  const idx = [src.indexOf('initPanelI18n('), src.indexOf('i18next.init(')].filter((i) => i >= 0)
  return idx.length === 0 ? -1 : Math.min(...idx)
}

describe('Gap B guard — main.tsx i18next init', () => {
  it('performs the app i18next init (initPanelI18n or i18next.init) at module scope', () => {
    expect(initCallIndex(mainSrc)).toBeGreaterThanOrEqual(0)
  })

  it('runs the init BEFORE createRoot(...).render — the canvas-registry ordering', () => {
    const initIdx   = initCallIndex(mainSrc)
    const renderIdx = mainSrc.indexOf('.render(')
    expect(initIdx).toBeGreaterThanOrEqual(0)
    expect(renderIdx).toBeGreaterThan(initIdx)
  })
})
