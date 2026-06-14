import { ExternalStore }                                          from '@geostat/engine'
import { fromAccountsFacts }                                     from './adapter'
import { ACCOUNTS_FACTS, ACCOUNTS_CLASSIFIERS, ACCOUNTS_DISPLAY } from './raw'

export const accountsStore = new ExternalStore(
  fromAccountsFacts(ACCOUNTS_FACTS),
  {
    classifiers: ACCOUNTS_CLASSIFIERS,
    display:     ACCOUNTS_DISPLAY,
  },
)

export { ACCOUNTS_CLASSIFIERS, ACCOUNTS_DISPLAY } from './raw'