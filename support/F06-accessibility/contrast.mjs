import assert from 'node:assert/strict';
// Resolve only native-control contrast cases, retaining every raw axe finding.
export async function nativeContrast(page,incomplete){
 const records=[];
 for(const finding of incomplete){
  assert.equal(finding.id,'color-contrast','UNRESOLVED_NON_CONTRAST_RULE');
  for(const node of finding.nodes){
   assert.equal(node.target.length,1,'UNSUPPORTED_SHADOW_CONTRAST_TARGET');
   const target=node.target[0],element=page.locator(target);assert.equal(await element.count(),1,'AMBIGUOUS_CONTRAST_TARGET');
   await element.evaluate(e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
   const measured=await element.evaluate(e=>{
    const rgb=s=>{const m=s.match(/^rgba?\(([^)]+)\)$/);if(!m)throw Error('UNSUPPORTED_COLOR:'+s);const v=m[1].split(',').map(Number);return{rgb:v.slice(0,3),alpha:v.length===4?v[3]:1};};
    const style=getComputedStyle(e),rect=e.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,hit=document.elementFromPoint(cx,cy);
    const hitPoints=[.1,.5,.9].flatMap(x=>[.1,.5,.9].map(y=>{const hit=document.elementFromPoint(rect.left+rect.width*x,rect.top+rect.height*y);return hit===e||e.contains(hit);}));
    const options=e.tagName==='SELECT'?[...e.options].map(o=>{const s=getComputedStyle(o);return{text:o.textContent,foreground:rgb(s.color),background:rgb(s.backgroundColor),image:s.backgroundImage,opacity:s.opacity,filter:s.filter,blend:s.mixBlendMode};}):[];
    const chain=[];let background=null;
    for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);chain.push({tag:p.tagName,opacity:s.opacity,background:s.backgroundColor,image:s.backgroundImage,filter:s.filter,blend:s.mixBlendMode});const color=rgb(s.backgroundColor);if(!background&&color.alpha===1)background=color;if(!background&&color.alpha!==0&&color.alpha!==1)throw Error('TRANSLUCENT_BACKGROUND');}
    return{tag:e.tagName,html:e.outerHTML,foreground:rgb(style.color),background,chain,visible:rect.width>0&&rect.height>0&&cx>=0&&cy>=0&&cx<innerWidth&&cy<innerHeight,unoccluded:hitPoints.every(Boolean),hitTest:'nine inset points after scrolling',centerUnoccluded:hit===e||e.contains(hit),options,fontSize:style.fontSize};
   });
   assert.ok(['TEXTAREA','SELECT','OPTION'].includes(measured.tag),'NATIVE_CONTRAST_ONLY');assert.equal(measured.html.replaceAll(' style=""',''),node.html.replaceAll(' style=""',''),'CONTRAST_DOM_CHANGED');assert.ok(measured.visible&&measured.unoccluded,'CONTRAST_NOT_VISIBLE');assert.equal(measured.foreground.alpha,1,'TRANSLUCENT_TEXT');assert.equal(measured.background?.alpha,1,'UNKNOWN_BACKGROUND');
   assert.ok(measured.chain.every(x=>x.opacity==='1'&&x.image==='none'&&x.filter==='none'&&x.blend==='normal'),'COMPOSITED_COLOR_REQUIRES_REVIEW');
   for(const option of measured.options){assert.deepEqual(option.foreground,measured.foreground,'OPTION_TEXT_COLOR_DIFFERS');assert.ok(option.background.alpha===0||(option.background.alpha===1&&JSON.stringify(option.background.rgb)===JSON.stringify(measured.background.rgb)),'OPTION_BACKGROUND_DIFFERS');assert.ok(option.image==='none'&&option.opacity==='1'&&option.filter==='none'&&option.blend==='normal','OPTION_COMPOSITE_REQUIRES_REVIEW');}
   const lum=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   const a=lum(measured.foreground.rgb),b=lum(measured.background.rgb),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,'NATIVE_TEXT_CONTRAST_BELOW_AA:'+ratio);
   records.push({...measured,rule:finding.id,target,html:node.html,measuredHtml:measured.html,ratio,minimum:4.5,status:'resolved_current_native_measurement'});
  }
 }
 return records;
}
