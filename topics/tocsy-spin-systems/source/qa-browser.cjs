/* Actual Chromium checks. Run with Node and an installed playwright package. */
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const out=path.resolve(__dirname,'..'),pageFile=path.join(out,fs.existsSync(path.join(out,'tocsy.html'))?'tocsy.html':'index.html');
const check=(x,message)=>{if(!x)throw new Error(message);};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results=[],errors=[],external=[];
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push({width,error:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({width,error:m.text()});});
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push({width,url:r.url()});});
  await page.addInitScript(()=>{window.__caughtErrors=[];window.onerror=(m,u,l)=>{window.__caughtErrors.push({m,u,l});const b=document.createElement('div');b.id='QA_ERROR_BANNER';b.textContent='JS ERROR: '+m;document.body.prepend(b);};});
  await page.goto('file://'+pageFile);await page.evaluate(()=>document.fonts.ready);
  check(await page.locator('.katex').count()===5,'Five formula blocks should render');
  check(await page.locator('.katex-error').count()===0,'Formula error');
  check((await page.evaluate(()=>window.__selftest())).ok,'Model tests');
  const initial=+(await page.locator('#weight').innerText()).split(' ')[0];check(initial>0,'Initial B–D relay must be visible');
  await page.locator('#cosyMode').click();check(await page.locator('#mix').isDisabled(),'COSY slider should disable');check((await page.locator('#weight').innerText()).startsWith('0.0000'),'COSY hides relay');
  await page.locator('#tocsyMode').click();await page.locator('#mix').focus();await page.locator('#mix').press('Home');check((await page.locator('#weight').innerText()).startsWith('0.0000'),'Zero mixing must remove cross weight');
  await page.locator('#mix').press('End');check(await page.locator('#mixValue').innerText()==='120 ms','Range End');
  const end=+(await page.locator('#weight').innerText()).split(' ')[0];check(end>initial,'Relay growth in this model');
  await page.locator('#nh').uncheck();check((await page.locator('#weight').innerText()).startsWith('0.0000'),'NH path removal');
  await page.locator('#nh').check();
  for(let i=0;i<4;i++){await page.locator(`#nodeButtons button[data-source="${i}"]`).click();check((await page.evaluate(()=>window.__teachingState())).source===i,'Slide source sync');}
  await page.locator('#target').selectOption('2');check((await page.evaluate(()=>window.__teachingState())).target===2,'Target select sync');
  await page.locator('#matrix [data-i="1"][data-j="3"]').click();check(await page.locator('#pairName').innerText()==='B ↔ D','Matrix click sync');
  await page.locator('#matrix [tabindex="0"]').focus();await page.keyboard.press('ArrowRight');check((await page.evaluate(()=>window.__teachingState())).target!==3,'Matrix keyboard');
  await page.locator('#example').selectOption('alkene');check((await page.locator('#groups').innerText()).includes('{G10}'),'Baseline separate branch');
  for(let i=0;i<9;i++){await page.locator(`#nodeButtons button[data-source="${i}"]`).click();check((await page.evaluate(()=>window.__teachingState())).source===i,'Alkene source sync');}
  await page.locator('#nodeButtons button[data-source="0"]').click();await page.locator('#target').selectOption('7');check((await page.locator('#weight').innerText()).startsWith('0.0000'),'Two separate chains');
  await page.locator('#weak').check();check((await page.locator('#groups').innerText()).split(' / ').length===1,'Weak edges connect graph');check(+(await page.locator('#weight').innerText()).split(' ')[0]>0,'Weak relay crosses graph');
  await page.locator('#structure .node-grid button').nth(3).click();check((await page.evaluate(()=>window.__teachingState())).source===3,'Structure position selection');
  await page.locator('#slice button').nth(8).click();check((await page.evaluate(()=>window.__teachingState())).target===8,'Slice selection');
  await page.locator('#runTest').click();check((await page.locator('#testResult').innerText()).includes('通过 · 15 项'),'Run selftest');
  await page.locator('.original-details summary').click();check(await page.locator('.original-details img').isVisible(),'Source expand');
  await page.locator('#openOriginal').click();check(await page.locator('#sourceDialog').isVisible(),'Original dialog');await page.locator('#closeOriginal').click();
  const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('h1,h2,h3,p,.panel,select,button,nav,svg')].filter(e=>{if(!e.getClientRects().length||e.closest('dialog')||e.closest('.table-wrap'))return false;const b=e.getBoundingClientRect();return b.right>innerWidth+1||b.left<-1;}).map(e=>e.id||e.className.baseVal||e.tagName)}));
  check(!overflow.document&&overflow.clipped.length===0,'Page viewport overflow '+JSON.stringify(overflow));
  const fontErrors=await page.evaluate(()=>({errors:window.__caughtErrors,fonts:document.fonts.status,sourceImages:[...document.querySelectorAll('img')].map(x=>({complete:x.complete,width:x.naturalWidth})),math:[...document.querySelectorAll('[data-math]')].map(x=>x.scrollWidth>x.clientWidth+1)}));
  check(fontErrors.errors.length===0,'Injected errors');check(fontErrors.fonts==='loaded','Embedded fonts');check(fontErrors.sourceImages.every(x=>x.complete&&x.width===1808),'Original loaded');check(fontErrors.math.every(x=>!x),'Formula horizontal clipping');
  await page.screenshot({path:path.join(out,width===1440?'qa-alkene-desktop.png':`qa-alkene-${width}.png`),fullPage:true});
  await page.locator('#reset').click();check(await page.locator('#pairName').innerText()==='B ↔ D','Reset');
  await page.locator('.original-details summary').click(); // collapse again for consistent preview
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(out,width===1440?'preview.png':`qa-slide-${width}.png`),fullPage:true});
  results.push({width,interactions:'all primary controls and all 13 source choices passed',overflow,formulaBlocks:5,sourceImagesLoaded:true,selftest:await page.evaluate(()=>window.__selftest()),height:await page.evaluate(()=>document.documentElement.scrollHeight)});
  await context.close();
 }
 await browser.close();check(errors.length===0,'Browser errors: '+JSON.stringify(errors));check(external.length===0,'External requests: '+JSON.stringify(external));
 const report={testedAt:new Date().toISOString(),browser:'Installed Google Chrome via Playwright, actual file:// navigation',errors,externalRequests:external,results,ok:true};
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
