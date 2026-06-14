import { http, HttpResponse } from 'msw'
import { REGIONAL_FACTS }     from '@/data/regional/raw'

export const regionalHandlers = [
  http.get('/api/datasets/regional', async () => {
    await delay(250)
    // Wire format: facts-only (semantic layer loaded separately, see Phase 2 /api/semantic/regional)
    return HttpResponse.json({ facts: REGIONAL_FACTS })
  }),
]

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}