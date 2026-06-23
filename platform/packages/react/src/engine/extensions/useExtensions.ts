import { useMemo }               from 'react'
import type { ExtensionPoint }   from './ExtensionPoint'
import type { ExtensionRegistry } from './ExtensionRegistry'

export function useExtensions<T, Ctx>(
  registry: ExtensionRegistry,
  point:    ExtensionPoint<T>,
  host:     Ctx,
): T[] {
  return useMemo(
    () => registry.resolve(point, host),
    // host is an object — in practice shells create it inline, so JSON-stringify
    // would be too expensive. Accept that extensions re-resolve on every render
    // when host is created inline; shells that care can useMemo the host object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, point],
  )
}
