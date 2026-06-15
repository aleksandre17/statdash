import fp from 'fastify-plugin'
import postgres from '@fastify/postgres'
import { env } from './env.js'

// Postgres connection plugin. Connects through pgBouncer (transaction-pooling
// mode): no prepared statements held across the pool, allowExitOnIdle so the
// process can shut down cleanly when the pool drains. fastify-plugin (fp)
// breaks encapsulation so app.pg is visible to sibling route plugins.
export const dbPlugin = fp(async (app) => {
  await app.register(postgres, {
    connectionString: env.DATABASE_URL,
    // pgBouncer transaction-mode safe settings.
    allowExitOnIdle: true,
  })
})
