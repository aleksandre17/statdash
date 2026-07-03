import pw from 'file:///C:/Users/Test-User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js'
const BASE='http://192.168.1.199:3002'
const SHOTS='C:/Users/Test-User/WebstormProjects/national-accounts/platform/work/verify-shots/ui-batch'
const b=await pw.chromium.launch();const c=await b.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:2});const p=await c.newPage()
await p.goto(BASE+'/ka/regional',{waitUntil:'networkidle',timeout:45000});await p.waitForTimeout(2000)
const g=await p.$('.perspective-tab-group')
if(g){await g.scrollIntoViewIfNeeded();await p.waitForTimeout(400)
  const box=await g.boundingBox();console.log('box',JSON.stringify({x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.width)}))
  const txt=await g.evaluate(e=>[...e.querySelectorAll('button,[role]')].map(t=>(t.textContent||'').trim()).filter(Boolean))
  console.log('tabs',JSON.stringify(txt))
  // full-width strip at the bar's y to prove LEFT anchoring
  await p.screenshot({path:SHOTS+'/03-perspective-row-context.png',clip:{x:0,y:Math.max(0,box.y-12),width:1500,height:box.height+24}})
  console.log('SHOT 03-perspective-row-context.png')
}else console.log('NO perspective-tab-group')
await b.close()
