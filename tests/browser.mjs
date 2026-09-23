import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const port=Number(process.env.TEST_PORT||4188),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.mjs','dist'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
await once(server.stdout,'data');
const browser=await chromium.launch({headless:true});
await mkdir('test-results',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Never contact the public collector. Test the same built game with a private config.
  await page.route('**/config.json',route=>route.fulfill({json:{collectorUrl:'',repositoryUrl:'',operatorName:'',contactUrl:''}}));
  await page.route('https://**',route=>route.abort());
  await page.goto(base+'/legacy.html?private=1');
  await page.locator('[data-choice]').first().waitFor();
  assert.match(await page.locator('#case-title').innerText(),/coffees/);
  await page.screenshot({path:'test-results/opening.png'});
  for(let i=0;i<45;i++){
    if(i===14){assert.match(await page.locator('#case-title').innerText(),/Too bad/);await page.screenshot({path:'test-results/stop-15.png'});}
    if(i===38)await page.screenshot({path:'test-results/late-stage.png'});
    await page.locator('[data-choice]').nth(i%2).click();
    await page.locator('#next').waitFor();
    if(i===2){await page.locator('#reflect').click();await page.locator('[data-reason="harm"]').click();await page.locator('.close-reflection').click();}
    else await page.locator('#next').click();
  }
  await page.locator('#game-report').click();
  assert.equal(await page.locator('.chart-card').count()>=4,true);
  assert.match(await page.locator('.stats').innerText(),/45/);
  await page.screenshot({path:'test-results/report.png',fullPage:true});
  await page.getByRole('button',{name:'The experiment',exact:true}).click();
  await page.locator('#pause').click();assert.match(await page.locator('main').innerText(),/It can wait/);
  await page.locator('#resume').click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('trolley-department-v1')).runId);
  await page.locator('#game-menu').click();await page.locator('#restart').click();
  assert.match(await page.locator('#case-title').innerText(),/coffees/);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('trolley-department-v1')).runId);assert.notEqual(before,after);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/mobile.png'});
  const bounds=await page.locator('[data-choice]').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(const b of bounds){assert.ok(b.x>=0&&b.right<=390&&b.bottom<=844&&b.y>0);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'/legacy.html?v=1.0.0&case=absurd-soup&seed=shared-test&private=1');
  assert.match(await page.locator('#case-title').innerText(),/soup/);
  assert.equal(await page.locator('[data-choice]').count(),2);
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: 45-stop journey, rebuke, reports, reflection, pause, independent restart, phone layout, and deterministic shared link.');
}finally{await browser.close();server.kill();}
