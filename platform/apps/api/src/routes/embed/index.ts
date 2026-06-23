import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, HttpError, notFound, parseBody, parseParams, parseQuery } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import { env } from '../../env.js'
import { mintToken, sign, verify } from '../../lib/embed.js'
import {
  createSnapshotStore,
  type EmbedParams,
  type SnapshotStore,
  type PageDataSnapshot,
} from '../../lib/snapshot-store.js'
import type { AuditLogger } from '../../lib/audit-log.js'

// ── Schemas — validate at the boundary (Postel's Law) ─────────────────────────
// The snapshot is engine output; we don't re-derive its full shape here (that's
// the engine's contract). We assert only the one invariant the delivery boundary
// depends on — a real snapshot always carries generatedAt — and treat the rest as
// an opaque, faithfully-stored blob. Over-validating engine internals here would
// couple the api to engine structure and break on every additive engine change.
const SnapshotShape = z
  .object({ generatedAt: z.string().min(1) })
  .passthrough()

const EmbedParamsSchema = z.object({
  allowedDims: z.record(z.unknown()).optional(),
  expiresAt:   z.number().int().positive().optional(),
})

const CreateSnapshotBody = z.object({
  snapshot: SnapshotShape,
  embed:    EmbedParamsSchema.optional(),
})

const TokenParams = z.object({ token: z.string().min(1) })
const SigQuery    = z.object({ sig: z.string().min(1) })

// The store outlives any single request and is shared by both routes, so it is
// created once at the app layer (index.ts) and injected here — a port, not a
// module global. Swapping to a DB-backed store later is one binding change.

// ── snapshotsRoutes — JWT-guarded write (mounted at /api/snapshots) ───────────
// Minting an embed is a write: only an authenticated Constructor may do it.
// The AuditLogger is injected (port) so every mint is recorded against the JWT
// subject — a governance trail of who created which embeddable snapshot [N41].
export const snapshotsRoutes = (
  store: SnapshotStore,
  audit?: AuditLogger,
): FastifyPluginAsync => async (app) => {
  await app.register(authPlugin)

  // POST / — persist a snapshot, return a signed embed URL.
  app.post('/', async (req, reply) => {
    const body = parseBody(CreateSnapshotBody, req.body)
    const params: EmbedParams = body.embed ?? {}

    const token = mintToken()
    const sig   = sign(token, env.EMBED_SECRET)

    store.set(token, {
      // The boundary schema guaranteed generatedAt + passthrough, which is exactly
      // the PageDataSnapshot DTO this layer stores. No cast: the shapes align.
      snapshot:  body.snapshot satisfies PageDataSnapshot,
      createdAt: Date.now(),
      params,
    })

    // Governance: record the mint. resource = the token (the thing created).
    audit?.log({
      userId:   req.jwtPayload?.sub,
      action:   'snapshot.create',
      resource: token,
      payload:  params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : undefined,
    })

    return reply.status(201).send(
      ok({
        token,
        url: `/embed/${token}?sig=${sig}`,
        ...(params.expiresAt !== undefined && { expiresAt: params.expiresAt }),
      }),
    )
  })
}

// ── embedRoutes — public, HMAC-authorized read (mounted at /api/embed) ────────
// The HMAC signature, not a bearer token, authorizes this read — external
// embedders have no JWT — so this scope is deliberately NOT wrapped by authPlugin.
export const embedRoutes = (store: SnapshotStore): FastifyPluginAsync => async (app) => {
  // GET /:token?sig=:sig — validate signature, then existence, then expiry.
  // Order is deliberate (fail-fast, least information leaked):
  //   403 bad sig  → checked first: never reveal whether a token exists to an
  //                  unsigned caller.
  //   404 not found
  //   410 Gone     → token valid but its embed window has closed.
  app.get('/:token', async (req, reply) => {
    const { token } = parseParams(TokenParams, req.params)
    const { sig }   = parseQuery(SigQuery, req.query)

    if (!verify(token, sig, env.EMBED_SECRET)) {
      throw new HttpError(403, 'Invalid embed signature')
    }

    const stored = store.get(token)
    if (!stored) throw notFound('Snapshot')

    const { expiresAt } = stored.params
    if (expiresAt !== undefined && expiresAt < Date.now()) {
      throw new HttpError(410, 'Embed token has expired')
    }

    // Delivery boundary: return the raw snapshot JSON, NOT the { data } envelope.
    // An external embed consumes the snapshot directly; wrapping it would force
    // every embedder to unwrap. The envelope is the Constructor client's contract,
    // not the public embed's.
    return reply.status(200).send(stored.snapshot)
  })
}

// Factory for the shared store — kept here so index.ts wires one instance into
// both route groups.
export { createSnapshotStore }
