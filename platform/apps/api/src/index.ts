import 'dotenv/config'
import Fastify from 'fastify'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import { env } from './env.js'
import { dbPlugin } from './db.js'
import { ValidationError } from './lib/http.js'
import { configRoutes } from './routes/config/index.js'
import { statsRoutes } from './routes/stats/index.js'
import { authRoutes } from './routes/auth/index.js'

const app = Fastify({
  logger: { level: env.NODE_ENV === 'development' ? 'info' : 'warn' },
})

await app.register(cors, { origin: env.CORS_ORIGIN })
await app.register(dbPlugin)
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(configRoutes, { prefix: '/api/config' })
await app.register(statsRoutes, { prefix: '/api/stats' })

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// ── Global error boundary ─────────────────────────────────────────────────────
// One place maps thrown errors → the { error, message } envelope. Zod failures
// surface as 400 with their issues; everything else keeps its statusCode or 500.
app.setErrorHandler((error: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof ValidationError) {
    return reply.status(400).send({
      error:   error.name,
      message: error.message,
      issues:  error.issues,
    })
  }

  const statusCode = error.statusCode ?? 500
  if (statusCode >= 500) app.log.error(error)
  else app.log.warn(error)

  return reply.status(statusCode).send({
    error:   error.name,
    message: error.message,
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
  })
})

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
