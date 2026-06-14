// ── EventBus — typed publish/subscribe (Grafana EventBus pattern) ──────────
//
//  Cross-node communication without direct coupling.
//  Shells publish events (row hover, legend toggle, drill-down).
//  Other shells subscribe — zero direct imports between shells (ISP).
//
//  Grafana equivalent: EventBus / PanelEventBus used across panels.
//  Builder.io equivalent: (none — Builder.io is layout-only, not data-reactive).
//
//  Usage:
//    // Publish (e.g. in ChartShell inner component):
//    ctx.eventBus.publish('row:hover', { rowKey: 'GE', type: 'chart' })
//
//    // Subscribe (e.g. in another ChartShell inner component):
//    useEffect(() => ctx.eventBus.subscribe('row:hover', ({ rowKey }) => {
//      setHighlighted(rowKey)
//    }), [ctx.eventBus])
//
//  Module augmentation — open for extension:
//    declare module '@geostat/react/events' {
//      interface GeostatEventMap {
//        'custom:event': { payload: string }
//      }
//    }
//

type Handler<T> = (event: T) => void
type Unsub      = () => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventBus<TMap = Record<string, any>> {
  private readonly handlers = new Map<string, Set<Handler<unknown>>>()

  publish<K extends keyof TMap>(type: K, event: TMap[K]): void {
    this.handlers.get(type as string)?.forEach(h => h(event))
  }

  subscribe<K extends keyof TMap>(type: K, handler: Handler<TMap[K]>): Unsub {
    const key = type as string
    if (!this.handlers.has(key)) this.handlers.set(key, new Set())
    this.handlers.get(key)!.add(handler as Handler<unknown>)
    return () => this.handlers.get(key)?.delete(handler as Handler<unknown>)
  }

  /** Remove all handlers — call on component unmount to prevent leaks. */
  clear(): void {
    this.handlers.clear()
  }
}