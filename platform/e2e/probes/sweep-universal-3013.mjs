// Universal-authorability sweep: prove EVERY node is selectable (canvas OR Layers) and
// opens a non-trivial inspector (Style + Visibility at minimum). Reaches hidden views
// (the inactive table) via the Layers/Outline tree — the robust, visibility-independent path.
import { chromium } from '@playwright/test'
const URL = 'http://192.168.1.199:3013/'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
try {
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 45000 }); await p.waitForTimeout(1200)
  const ins = p.locator('input')
  if (await ins.count() >= 2) {
    await ins.nth(0).fill('admin')
    await p.locator('input[type=password]').first().fill('dev_admin_pw_123')
    await p.getByRole('button').first().click(); await p.waitForTimeout(1500)
  }
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(5000)

  const rightPanel = p.locator('aside[aria-label="ინსპექტორი"], aside[aria-label="Inspector"]').first()
  const countControls = async () =>
    rightPanel.locator('input,select,textarea,[role="combobox"],[role="slider"]').count().catch(() => 0)
  // Does the inspector currently show a Style and/or Visibility facet section? (facet
  // sections carry a heading; we detect by the localized section labels.)
  const facetFlags = async () => {
    const txt = (await rightPanel.innerText().catch(() => '')) || ''
    return {
      style: /სტილი|Style/.test(txt),
      visibility: /ხილვადობა|Visibility/.test(txt),
    }
  }

  // 1) Enumerate the canvas node anchors (id + type).
  const anchors = p.locator('[data-part-node-id]')
  const n = await anchors.count()
  const nodes = []
  for (let i = 0; i < n; i++) {
    const el = anchors.nth(i)
    nodes.push({
      i,
      id: await el.getAttribute('data-part-node-id').catch(() => null),
      type: await el.getAttribute('data-part-node-type').catch(() => null),
    })
  }

  // 2) Canvas-select each (does clicking the canvas anchor open its inspector?).
  const canvasSel = {}, canvasMetrics = {}
  for (const node of nodes) {
    const el = p.locator(`[data-part-node-id="${node.id}"]`).first()
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 1200 }).catch(() => {})
      await el.click({ timeout: 2000, force: true }); await p.waitForTimeout(250)
      const c = await countControls()
      canvasSel[node.id] = c > 0
      canvasMetrics[node.id] = { controls: c, ...(await facetFlags()) }
    } catch { canvasSel[node.id] = false; canvasMetrics[node.id] = { controls: 0, style: false, visibility: false } }
  }

  // 3) Open the Layers pane (the outline tree — visibility-independent reach).
  const layersBtn = p.getByRole('button', { name: /Layers|შრეები/ }).first()
  if (await layersBtn.count()) { await layersBtn.click().catch(() => {}); await p.waitForTimeout(800) }
  const outlineRows = await p.locator('[data-outline-id]').count()

  // 4) Reach EVERY node via its Layers row; read inspector richness + facet presence.
  const out = []
  for (const node of nodes) {
    // deselect first (Escape) so a stale selection can't mask a failed Layers select.
    await p.keyboard.press('Escape').catch(() => {})
    const row = p.locator(`[data-outline-id="${node.id}"]`).first()
    let layersOk = false, controls = 0, flags = { style: false, visibility: false }
    if (await row.count()) {
      try {
        await row.scrollIntoViewIfNeeded({ timeout: 1200 }).catch(() => {})
        await row.click({ timeout: 2000 }); await p.waitForTimeout(300)
        controls = await countControls()
        flags = await facetFlags()
        layersOk = controls > 0
      } catch { /* stays false */ }
    }
    // Reachability = canvas OR layers. RICHNESS is read from the Layers WHOLE-NODE
    // selection where a row exists (the robust path — a canvas click can land on a nested
    // sub-part like a kpi tile / the page background, narrowing the inspector); the page
    // ROOT has no outline row (the tree lists its children, Webflow-style) → canvas.
    const canvasOk = canvasSel[node.id] === true
    const richVia = layersOk ? 'layers' : 'canvas'
    const m = layersOk ? { controls, style: flags.style, visibility: flags.visibility } : canvasMetrics[node.id]
    out.push({
      i: node.i, type: node.type,
      canvas: canvasOk, layers: layersOk, select: canvasOk || layersOk,
      via: canvasOk ? 'canvas' : (layersOk ? 'layers' : 'NONE'),
      richVia, controls: m.controls, style: m.style, visibility: m.visibility,
    })
  }
  console.log(JSON.stringify({ totalNodes: n, outlineRows, sweep: out }, null, 2))
} catch (e) { console.log(JSON.stringify({ fatal: String(e) })) } finally { await b.close() }
