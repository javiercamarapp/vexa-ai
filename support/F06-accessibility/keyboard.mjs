import assert from 'node:assert/strict';import {assertFocus} from './oracles.mjs';
export async function keyboardScan(page,engine,row){
 const expected=await page.evaluate(()=>{const elements=[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(e=>e.tabIndex>=0&&!e.matches(':disabled')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');window.__f0607KeyboardTargets=elements;return elements.map((e,index)=>({index,tag:e.tagName,name:e.getAttribute('name'),label:e.getAttribute('aria-label')||e.labels?.[0]?.textContent||e.textContent.slice(0,90)}));});
 const start=await page.locator('.workspace-skip').count()?page.locator('.workspace-skip'):page.locator('body > .skip-link');await start.focus();
 row.keyboard=[];row.keyboardCoverage={start:'Explicit programmatic focus on skip link; subsequent traversal uses native keys',expected,missing:expected};
 const read=()=>page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);return{index:window.__f0607KeyboardTargets.indexOf(e),tag:e.tagName,name:e.getAttribute('aria-label')||e.labels?.[0]?.textContent||e.textContent.slice(0,90),body:e===document.body,visible:r.width>0&&r.height>0&&r.top>=-1&&r.left>=-1&&r.top<innerHeight&&r.left<innerWidth,rect:{top:r.top,left:r.left,width:r.width,height:r.height},focusVisible:e.matches(':focus-visible'),outline:{style:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor},indicator:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2&&s.outlineColor!=='transparent'&&s.outlineColor!=='rgba(0, 0, 0, 0)'};});
 const first=await read();assertFocus(first);assert.ok(first.index>=0,'SKIP_LINK_NOT_FOCUSABLE');row.keyboard.push(first);const seen=new Set([first.index]);
 for(let i=0;i<expected.length*8+8&&seen.size<expected.length;i++){
  await page.keyboard.press(engine==='webkit'?'Alt+Tab':'Tab');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const focus=await read();
  if(focus.body){row.keyboardCoverage.browserChromeObserved=true;continue;}
  row.keyboard.push(focus);row.keyboardCoverage.missing=expected.filter(x=>!seen.has(x.index));assertFocus(focus);assert.ok(focus.index>=0,'UNTRACKED_NATIVE_FOCUS');seen.add(focus.index);
 }
 row.keyboardCoverage.missing=expected.filter(x=>!seen.has(x.index));assert.deepEqual(row.keyboardCoverage.missing,[],'KEYBOARD_CONTROLS_NOT_REACHED');
}
