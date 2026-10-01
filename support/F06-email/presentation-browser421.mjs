import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
export async function renderEmailPreviews({playwright,templates,evidence,engines=['chromium','webkit'],launchOptions={}}){
 const results=[];fs.mkdirSync(evidence,{recursive:true});
 for(const engine of engines){
  assert.ok(['chromium','webkit'].includes(engine));const type=playwright[engine];
  const browser=await type.launch({headless:true,...launchOptions[engine]});
  try{for(const entry of templates){for(const width of [320,800])for(const colorScheme of ['light','dark']){
    const page=await browser.newPage({viewport:{width,height:900},colorScheme});await page.route('**/*',route=>route.abort());await page.setContent(entry.html);
    const observed=await page.evaluate(()=>{
     const links=[...document.querySelectorAll('a')],cta=links.find(a=>a.style.background),button=cta.getBoundingClientRect(),card=cta.closest('td[style*="border:1px solid"]')?.getBoundingClientRect();
     return {htmlLanguage:document.documentElement.lang,htmlDirection:document.documentElement.dir,bodyChildren:[...document.body.children].map(n=>({tag:n.tagName,lang:n.lang,dir:n.dir})),tables:[...document.querySelectorAll('table')].map(n=>n.getAttribute('role')),h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth,links:links.map(a=>({href:a.href,text:a.textContent.trim()})),button:{height:button.height,left:button.left,right:button.right},centerDelta:card?Math.abs((button.left+button.right)/2-(card.left+card.right)/2):null,foreground:getComputedStyle(cta).color,background:getComputedStyle(cta).backgroundColor,title:document.title};
    });
    assert.equal(observed.htmlLanguage,'es');assert.equal(observed.htmlDirection,'ltr');assert.ok(observed.bodyChildren.every(n=>n.lang==='es'&&n.dir==='ltr'),'BODY_CHILD_LANGUAGE_DIRECTION');assert.ok(observed.tables.every(x=>x==='presentation'));assert.equal(observed.h1,1);assert.equal(observed.overflow,false,`${engine}/${width}/${entry.type}`);assert.ok(observed.links.every(a=>a.text&&new URL(a.href).origin==='https://syn-vexa.example.test'));assert.ok(observed.button.height>=44);assert.ok(observed.centerDelta!==null&&observed.centerDelta<=2,'CTA_CENTERED');assert.equal(observed.foreground,'rgb(255, 255, 255)');assert.equal(observed.background,'rgb(22, 101, 52)');assert.ok(observed.title.length>0);

    if(entry.type==='digest.available')await page.screenshot({path:path.join(evidence,`email-${engine}-${width}-${colorScheme}.png`),fullPage:true});results.push({engine,width,colorScheme,type:entry.type,observed});await page.close();
   }}}finally{await browser.close();}
 }
 fs.writeFileSync(path.join(evidence,'presentation421.json'),JSON.stringify({checks:results.length,expectedEngines:engines,executedEngines:[...new Set(results.map(x=>x.engine))],results,browserPreviewOnly:true},null,2));return results;
}
if(process.env.VEXA_EMAIL_PREVIEW_INPUT){const require=createRequire(import.meta.url);await renderEmailPreviews({playwright:require('/app/node_modules/playwright-core'),templates:JSON.parse(fs.readFileSync(process.env.VEXA_EMAIL_PREVIEW_INPUT)),evidence:process.env.VEXA_EMAIL_PREVIEW_OUTPUT,engines:['chromium'],launchOptions:{chromium:{executablePath:'/ms-playwright/chromium-1226/chrome-linux/chrome'}}});}
