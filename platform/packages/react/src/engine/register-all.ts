// ── register-all — new-arch shell registry singleton ────────────────────
//
//  Holds all NodeSlice registrations made via registerSlice().
//  renderNode() reads from this registry for zero-branching dispatch.
//
//  Extension pattern:
//    import { registerSlice } from '@statdash/react/engine'
//    registerSlice(mySlice)   // plugins/nodes/ · plugins/chrome/ · plugins/controls/
//
//  New node type = zero change here. Pure extension via registerSlice.
//

import { NodeRegistry } from './NodeRegistry'

export const nodeRegistry = new NodeRegistry()