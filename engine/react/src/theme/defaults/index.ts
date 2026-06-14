// ── theme/defaults — platform default shells ──────────────────────────
//
//  Minimal NodeRenderer implementations for built-in node types.
//  These are registered by setupRegistrations() in ⑤ bootstrap.
//  Plugin shells override per type+variant — zero change here.
//
//  NOT auto-registered here: registration happens in ⑤ (setupRegistrations.ts)
//  after renderNode() fully replaces the old RenderEngine.renderSlots() pipeline.
//

export { DefaultSectionShell    } from './DefaultSectionShell'
export { DefaultChartShell      } from './DefaultChartShell'
export { DefaultTableShell      } from './DefaultTableShell'
export { DefaultFilterBarShell  } from './DefaultFilterBarShell'
export { DefaultKpiStripShell   } from './DefaultKpiStripShell'
export { DefaultInnerPageShell  } from './DefaultInnerPageShell'
export { DefaultTabPageShell    } from './DefaultTabPageShell'