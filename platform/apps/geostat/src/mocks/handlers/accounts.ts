import { http, HttpResponse } from 'msw'
import { ACCOUNTS_2025 }      from '@/data/accounts/raw'

export const accountsHandlers = [
  http.get('/api/datasets/accounts', async () => {
    await delay(250)
    return HttpResponse.json(ACCOUNTS_2025)
  }),
]

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}