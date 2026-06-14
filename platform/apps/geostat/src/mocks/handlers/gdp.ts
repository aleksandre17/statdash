import { http, HttpResponse } from 'msw'
import { GDP_FACTS }          from '@/data/gdp/raw'

export const gdpHandlers = [
  http.get('/api/datasets/gdp', async () => {
    await delay(250)
    return HttpResponse.json(GDP_FACTS)
  }),
]

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}