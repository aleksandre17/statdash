// diagnosis probe: capture obs-wire requests on studio canvas vs portal for the regional page
import { chromium } from '@playwright/test'
async function capture(url, needsLogin) {
  const b = await chromium.launch(); const p = await b.newPage()
  const wires = []
  p.on('request', r => { const u = r.url(); if (/observation|\/obs|dataset=/.test(u)) wires.push(u.replace(/^https?:\/\/[^/]+/, '')) })
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  if (needsLogin) {
    const pass = p.locator('input[type="password"]').first()
    if (await pass.count()) {
      await p.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(()=>{})
      await pass.fill('dev_admin_pw_123'); await p.locator('button[type="submit"]').first().click().catch(()=>{})
      await p.waitForTimeout(4000)
      await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    }
  }
  await p.waitForTimeout(5000)
  await b.close(); return wires
}
const portal = await capture('http://192.168.1.199:3012/ka/regional', false)
const canvas = await capture('http://192.168.1.199:3013/studio/insert?page=regional', true)
console.log(JSON.stringify({ portal: portal.slice(0,12), canvas: canvas.slice(0,12) }, null, 1))
