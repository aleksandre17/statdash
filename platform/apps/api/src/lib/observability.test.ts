import { describe, it, expect, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

async function buildApp(): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { registerProblemErrorHandler } = await import('./error-handler.js')
  const { registerObservability, REQUEST_ID_OPTIONS } = await import('./observability.js')
  const { createMetricsRegistry, registerHttpMetrics } = await import('./metrics.js')
  const { notFound } = await import('./problem.js')

  const app = Fastify({ ...REQUEST_ID_OPTIONS })
  registerProblemErrorHandler(app)
  const metrics = createMetricsRegistry()
  registerHttpMetrics(metrics)
  registerObservability(app, { metrics })
  app.get('/ping', async () => ({ ok: true }))
  app.get('/boom', async () => { throw notFound('Thing') })
  await app.ready()
  return app
}

describe('observability (API-10 fitness)', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildApp() })

  it('stamps x-request-id on the response (minted when absent)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ping' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-request-id']).toBeDefined()
    expect(String(res.headers['x-request-id']).length).toBeGreaterThan(0)
  })

  it('propagates an inbound x-request-id (distributed correlation)', async () => {
    const id = 'trace-abc-123'
    const res = await app.inject({ method: 'GET', url: '/ping', headers: { 'x-request-id': id } })
    expect(res.headers['x-request-id']).toBe(id)
  })

  it('correlates the error body with the response request id', async () => {
    const id = 'err-trace-9'
    const res = await app.inject({ method: 'GET', url: '/boom', headers: { 'x-request-id': id } })
    expect(res.statusCode).toBe(404)
    expect(res.headers['x-request-id']).toBe(id)
    expect(res.json().requestId).toBe(id)
  })

  it('exposes Prometheus metrics reflecting served requests', async () => {
    await app.inject({ method: 'GET', url: '/ping' })
    const res = await app.inject({ method: 'GET', url: '/metrics' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.body).toContain('http_requests_total')
    expect(res.body).toContain('http_request_duration_seconds_bucket')
  })
})
