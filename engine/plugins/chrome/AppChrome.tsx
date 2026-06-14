// ── AppChrome — 4-layer chrome orchestrator ─────────────────────────────
//
//  Reads the resolved chrome layout and renders each region declaratively.
//  No slot names hardcoded — all slots registered via registerSlice().
//
//  Layout regions rendered here: top · left · right · bottom · overlay.
//  'inline' region: nested slots (LocaleSwitcher, InnerSidebar) — NOT here;
//  their parent shells render them via <ChromeSlot slot="..." />.
//
//  New slot at top level = new plugin folder + register. Zero changes here. (OCP)
//  New page variant     = pageEntry.chrome override. Zero changes here.    (OCP)
//
//  Frame system (3-layer):
//    1. page config  → frame: 'landing'          (data, Constructor ready)
//    2. FrameContext → usePageFrame() = 'landing'  (React bridge)
//    3. [data-frame] → CSS geometry adaptation    (zero JS in shells)
//
import { useMemo }                               from 'react'
import type { ReactNode }                        from 'react'
import { usePageFrame, useSiteChrome, useChromeOverrides } from '@geostat/react'
import { resolveChrome, ChromeRegion }           from '@geostat/react/engine'

export default function AppChrome({ children }: { children: ReactNode }) {
  const frame     = usePageFrame()
  const site      = useSiteChrome()
  const overrides = useChromeOverrides()
  const layout    = useMemo(() => resolveChrome(site, overrides), [site, overrides])

  return (
    <div className="app-shell" data-frame={frame}>
      <ChromeRegion region="top"    entries={layout.get('top')    ?? []} />
      <div className="app-shell__body">
        <ChromeRegion region="left" entries={layout.get('left')   ?? []} />
        <main className="app-shell__content">{children}</main>
        <ChromeRegion region="right" entries={layout.get('right') ?? []} />
      </div>
      <ChromeRegion region="bottom"  entries={layout.get('bottom')  ?? []} />
      <ChromeRegion region="overlay" entries={layout.get('overlay') ?? []} />
    </div>
  )
}