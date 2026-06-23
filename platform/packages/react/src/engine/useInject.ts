import { useMemo }             from 'react'
import type { Container }       from './di/Container'
import type { InjectionToken }  from './di/InjectionToken'

/**
 * useInject — stable DI hook. Type is inferred from the token; no generic
 * at the call site. useMemo ensures React sees a stable reference across
 * renders (react-hooks/static-components compliance).
 */
export function useInject<T>(container: Container, token: InjectionToken<T>): T {
  return useMemo(() => container.inject(token), [container, token])
}
