// ── Dev logger middleware — logs all commands before execution ────────────
//
//  Registered only when import.meta.env.DEV is true (SiteRenderer).
//  Name follows the existing 'dev:node-debug' convention from middlewareRegistry.
//

import type { CommandMiddleware } from '../CommandBus'

/**
 * Logs every dispatched command (including vetoed ones — logger runs first at
 * priority 0, before any domain middleware that might short-circuit).
 */
export const devLoggerMiddleware: CommandMiddleware = {
  name:     'dev:command-log',
  priority: 0,
  intercept(cmd, next) {
    console.debug(`[command] ${cmd.type}`, cmd)
    next()
  },
}
