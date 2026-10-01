import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {assertReady} from './ready.mjs';
import {nativeContrast} from './contrast.mjs';
import {assertAudit} from './oracles.mjs';
import {keyboardScan} from './keyboard.mjs';
export async function scan({page,url,viewport,axePath,out,engine,label}){
 const pageErrors=[],consoleErrors=[],requests=[];
 const onError=e=>pageErrors.push(e.message),onConsole=m=>{if(m.type()==='error')consoleErrors.push(m.text());};
 const onResponse=r=>requests.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});
 page.on('pageerror',onError);page.on('console',onConsole);page.on('response',onResponse);
 const stem=engine+'-'+label.replace(/[^a-z0-9]/gi,'_')+'-'+viewport.width;
 let row={label,engine,viewport,status:'running'};
 try{
  await page.setViewportSize(viewport);const response=await page.goto(url);row.http=response?.status();
  await page.waitForLoadState('networkidle');row.dataState=await assertReady(page,url,requests);await page.addScriptTag({path:axePath});
  const axe=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});const map=xs=>xs.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>({target:n.target,html:n.html,failureSummary:n.failureSummary}))}));return{violations:map(r.violations),incomplete:map(r.incomplete)};});
  const dom=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,animations:document.getAnimations().filter(a=>a.playState==='running'&&Number(a.effect?.getTiming().duration)>1).length,unnamed:[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href]')].filter(e=>e.getClientRects().length&&!e.disabled&&!((e.labels&&[...e.labels].some(l=>l.textContent.trim()))||e.getAttribute('aria-label')?.trim()||e.getAttribute('aria-labelledby')?.split(/\s+/).some(id=>document.getElementById(id)?.textContent.trim())||e.textContent.trim()||e.querySelector('img[alt]')?.getAttribute('alt'))).map(e=>e.outerHTML)}));
  Object.assign(row,axe,dom,{pageErrors,consoleErrors});
  await page.screenshot({path:path.join(out,stem+'.png'),fullPage:true});
  fs.writeFileSync(path.join(out,stem+'.html'),await page.content());
  row.incompleteResolved=await nativeContrast(page,row.incomplete);
  await page.evaluate(()=>scrollTo(0,0));
  assertAudit(row);
  await keyboardScan(page,engine,row);assertAudit(row);row.status='pass';return row;
 }catch(error){row.status='fail';row.error=error.message;throw error;}
 finally{row.pageErrors=pageErrors;row.consoleErrors=consoleErrors;row.requests=requests;fs.writeFileSync(path.join(out,stem+'.json'),JSON.stringify(row,null,2));page.off('pageerror',onError);page.off('console',onConsole);page.off('response',onResponse);}
}
