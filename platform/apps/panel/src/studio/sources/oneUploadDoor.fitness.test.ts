// ── FF-ONE-UPLOAD-DOOR — exactly one CanonicalUpload mount in the whole studio (0091) ─
//
//  The owner's verdict named "upload repeated in multiple places" as a defect. The Data
//  Home split fixes it: the ONE canonical upload door lives on «წყაროები» (SourcesBody),
//  and every duplicate died. This gate encodes the invariant red-on-regression: a source
//  scan of the whole panel counts `<CanonicalUpload` JSX mounts — there must be exactly
//  ONE. A second mount (a duplicate re-appearing on the Model page, or anywhere else) trips
//  this immediately, so the dedup can never silently return.
//
//  Loaded as raw source (Vite ?raw) so the guard stays browser-graph typed (the panel
//  tsconfig excludes @types/node — no filesystem). Comments are stripped first so a mount
//  mentioned in prose can't false-positive (the CSS-fitness comment-stripping discipline).
//
import { describe, it, expect } from 'vitest'

const PANEL_SOURCES = import.meta.glob('../../**/*.tsx', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Count `<CanonicalUpload` JSX mount tags in a source (comments stripped). */
function countMounts(src: string): number {
  return (stripComments(src).match(/<CanonicalUpload\b/g) ?? []).length
}

describe('FF-ONE-UPLOAD-DOOR — exactly one CanonicalUpload mount (0091)', () => {
  it('scans real panel sources (guard is not vacuous)', () => {
    // The whole app tree is in scope — sanity that the glob resolved a meaningful set.
    expect(Object.keys(PANEL_SOURCES).length).toBeGreaterThan(50)
  })

  it('mounts CanonicalUpload in EXACTLY one place, and it is SourcesBody', () => {
    const mountFiles = Object.entries(PANEL_SOURCES)
      .filter(([path]) => !path.includes('.test.'))
      .map(([path, src]) => [path, countMounts(src)] as const)
      .filter(([, n]) => n > 0)

    const total = mountFiles.reduce((sum, [, n]) => sum + n, 0)
    expect(total).toBe(1)

    const [onlyPath] = mountFiles[0] ?? ['']
    expect(onlyPath).toMatch(/SourcesBody\.tsx$/)
  })
})
