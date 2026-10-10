const {chromium}=require(process.env.NMR_NODE_MODULES+'/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
const root=path.resolve(__dirname,'..');const scratch=process.env.NMR_QA_DIR||path.join(root,'source','qa');fs.mkdirSync(scratch,{recursive:true});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[],external=[];const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
await page.addInitScript(()=>{window.onerror=(message)=>{let x=document.createElement('div');x.id='qa-error';x.textContent='JS ERROR: '+message;x.style='background:#900;color:white';document.body.prepend(x)}});
await page.goto('file://'+root+'/index.html');await page.evaluate(()=>document.fonts.ready);
const assert=(b,m)=>{if(!b)throw Error(m)};
assert((await page.evaluate(()=>__selftest())).ok,'model selftest');
const checks=[];
for(const id of await page.evaluate(()=>NMR.DATA.map(n=>n.id))){await page.selectOption('#proton',id);assert(await page.evaluate(id=>document.getElementById('selection').textContent===NMR.DATA.find(n=>n.id===id).label,id),'selection '+id);assert(await page.locator('tr.selected').getAttribute('data-row')===id,'table sync '+id);checks.push('selection '+id)}
await page.click('#reset');
for(const s of [0,1,2,3,4,5]){await page.locator('#depth').fill(String(s));assert((await page.locator('#depthvalue').textContent())===s+' 步','depth '+s)}
const pathBefore=await page.locator('#spectrum path').last().getAttribute('d');
await page.locator('#width').fill('50');const pathAfter=await page.locator('#spectrum path').last().getAttribute('d');assert(pathBefore!==pathAfter,'width changes actual projection');
await page.selectOption('#mode','cosy');assert(await page.locator('#depth').isDisabled(),'COSY disables depth');await page.selectOption('#mode','tocsy');assert(await page.locator('#depth').isEnabled(),'TOCSY enables depth');
await page.click('#contrast');assert(await page.locator('#selection').textContent()==='H1′a / H1′b','contrast');
await page.locator('#all').uncheck();const sparse=await page.locator('#spectrum circle').count();await page.locator('#all').check();assert(await page.locator('#spectrum circle').count()>sparse,'all toggles points');
await page.locator('[data-node=G2]').focus();await page.keyboard.press('Enter');assert(await page.locator('#selection').textContent()==='H2','keyboard Enter');await page.locator('[data-node=F3]').focus();await page.keyboard.press('Space');assert(await page.locator('#selection').textContent()==='H3′','keyboard Space');
await page.locator('[data-select=G4]').click();assert(await page.locator('#selection').textContent()==='H4','table click');await page.locator('[data-node=G5]').click();assert(await page.locator('#selection').textContent()==='H5','structure click');
await page.locator('[data-answer=right]').click();assert((await page.locator('#quizfeedback').textContent()).startsWith('正确'),'quiz');await page.locator('[data-answer=wrong]').first().click();assert((await page.locator('#quizfeedback').textContent()).startsWith('再想'),'wrong quiz');
await page.click('#reset');assert((await page.locator('#depthvalue').textContent())==='5 步','reset');await page.evaluate(()=>document.getElementById('quizfeedback').textContent='选择一个答案，查看理由。');
assert(await page.locator('.katex').count()===3,'formula render count');assert(await page.locator('.katex-error').count()===0,'formula errors');
for(const img of await page.locator('img').all())assert(await img.evaluate(n=>n.complete&&n.naturalWidth>0),'embedded image load');
const layouts=[];
for(const width of [1440,1180,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);let layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,height:document.documentElement.scrollHeight}));assert(layout.scroll<=width&&layout.body<=width,'overflow '+width);layouts.push(layout);if(width<=390){await page.locator('[data-node=F1]').click();assert((await page.locator('#selection').textContent()).startsWith('H1′'),'mobile selection '+width);await page.click('#reset');}if(width===1440)await page.screenshot({path:root+'/preview.png',fullPage:true});if(width===390||width===320)await page.screenshot({path:path.join(scratch,'mobile-'+width+'.png'),fullPage:true});}
await page.setViewportSize({width:1440,height:1000});await page.locator('details').first().locator('summary').click();assert(await page.locator('details').first().getAttribute('open')!==null,'original expands');
assert(!errors.length,'browser errors '+errors.join(';'));assert(!external.length,'external requests '+external.join(';'));
const report={ok:true,model:await page.evaluate(()=>__selftest()),selections:checks,controls:['depth 0–5','width changes projection','COSY/TOCSY','show all','H1′ shortcut','reset','Enter and Space','structure click','assignment click','quiz','original expand'],math_count:3,browser_errors:errors,external_requests:external,layouts};fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
