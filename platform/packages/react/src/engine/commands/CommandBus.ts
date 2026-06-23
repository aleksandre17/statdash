// ── CommandBus — typed command dispatch (CQS pattern) ────────────────────
//
//  CQS boundary:
//    CommandBus  — "Do this" intent to mutate; exactly ONE handler.
//    EventBus    — "This happened" notification; 0..N subscribers.
//
//  Cardinality is the key distinction: a command requires exactly one handler
//  (throws on missing handler), while an event broadcasts to zero or more
//  subscribers (silence is valid). Commands are imperative; events are
//  declarative past-tense notifications.
//
//  Middleware shape — Chain of Responsibility (Koa/Express pattern):
//    NOT calling next() vetoes the command (short-circuit).
//    This is a deliberate divergence from composeMiddleware (before/after-reduce)
//    in engine/react/engine/middleware/ — before/after-reduce cannot express
//    short-circuit vetoing that command middleware requires.
//    ADR: the platform has two middleware idioms; this is the command-path one.
//

import type { Command, CommandType } from './commands'

export type CommandHandler<K extends CommandType> = (cmd: Command<K>) => void

export interface CommandMiddleware {
  /** Optional name for debugging / identification. */
  name?:     string
  /**
   * Execution order — lower number runs first.
   * Middlewares without priority sort after those with it (treated as Infinity).
   */
  priority?: number
  /**
   * Intercept a command in flight.
   * Call next() to continue the chain; omit to veto (short-circuit).
   */
  intercept(cmd: Command, next: () => void): void
}

export interface CommandBus {
  dispatch<K extends CommandType>(cmd: Command<K>): void
  handle<K extends CommandType>(type: K, handler: CommandHandler<K>): void
  use(mw: CommandMiddleware): void
}

export class DefaultCommandBus implements CommandBus {
  private readonly handlers   = new Map<string, CommandHandler<CommandType>>()
  private readonly middleware: CommandMiddleware[] = []

  handle<K extends CommandType>(type: K, handler: CommandHandler<K>): void {
    if (this.handlers.has(type)) {
      throw new Error(`CommandBus: handler already registered for '${type}'`)
    }
    this.handlers.set(type, handler as CommandHandler<CommandType>)
  }

  use(mw: CommandMiddleware): void {
    this.middleware.push(mw)
    this.middleware.sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))
  }

  dispatch<K extends CommandType>(cmd: Command<K>): void {
    // Widen to the full union at the routing boundary — correct for discriminated
    // union dispatch: the handler is looked up by cmd.type and receives the full
    // command object; TypeScript cannot narrow the Map<string, Handler> lookup
    // back to K without this widening cast.
    const routed = cmd as Command
    const run = (i: number): void => {
      if (i < this.middleware.length) {
        this.middleware[i].intercept(routed, () => run(i + 1))
        return
      }
      const handler = this.handlers.get(routed.type)
      if (!handler) throw new Error(`CommandBus: no handler for '${routed.type}'`)
      handler(routed)
    }
    run(0)
  }
}
