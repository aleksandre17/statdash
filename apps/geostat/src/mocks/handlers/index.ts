import { gdpHandlers }      from './gdp'
import { accountsHandlers } from './accounts'
import { regionalHandlers } from './regional'

export const handlers = [
  ...gdpHandlers,
  ...accountsHandlers,
  ...regionalHandlers,
]