import assert from 'node:assert/strict';
export const captionTargets=['figcaption > .login-kicker','figcaption > .login-serif'];
const luminance=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
export function captionBound(m){
 assert.equal(m.foreground.alpha,1);assert.deepEqual(m.foreground.rgb,[255,255,255]);
 assert.ok(m.visible&&m.unoccluded&&m.safeLayers,'CAPTION_UNSAFE_LAYERS');
 assert.equal(m.tag,'P');assert.ok(captionTargets.includes(m.target));
 let alpha,minimum,model;
 if(m.target===captionTargets[0]){assert.deepEqual(m.background.rgb,[16,27,20]);assert.ok(m.background.alpha>0&&m.background.alpha<=1);alpha=m.background.alpha;minimum=4.5;model='caption_dark_overlay_bound_0_255';}
 else{
  assert.equal(m.background.alpha,0);assert.equal(m.gradient,'linear-gradient(to top, rgba(16, 27, 20, 0.72) 0%, rgba(16, 27, 20, 0.34) 22%, rgba(0, 0, 0, 0) 46%)','UNREVIEWED_CAPTION_GRADIENT');
  assert.ok(m.fontSize>=24,'CAPTION_SMALL_TEXT_REQUIRES_SEPARATE_MEASUREMENT');
  const r=m.rect,v=m.veilRect;assert.ok(v.height>0&&r.top>=v.top&&r.bottom<=v.bottom&&r.left>=v.left&&r.right<=v.right,'CAPTION_OUTSIDE_VEIL');
  const fraction=(v.bottom-r.top)/v.height;assert.ok(fraction>=0&&fraction<=.22,'CAPTION_OUTSIDE_REVIEWED_GRADIENT_SEGMENT');
  // Gradient alpha decreases upward. The entire rectangle is bounded by its top.
  // Rounded-down CSSOM alphas (0.72/0.34) conservatively admit a lighter background.
  alpha=.72+(.34-.72)*(fraction/.22);minimum=3;model='caption_gradient_large_text_bound_0_255';
 }
 const upper=[16,27,20].map(n=>n*alpha+255*(1-alpha));const ratio=1.05/(luminance(upper)+.05);
 assert.ok(ratio>=minimum,'CAPTION_TEXT_CONTRAST_BELOW_AA:'+ratio);
 return{ratio,minimum,contrastModel:model,boundAlpha:alpha,backgroundBounds:{upper,underlyingChannelRange:[0,255]}};
}
export async function captionContrast(page,node){
 assert.equal(node.target.length,1);const target=node.target[0];assert.ok(captionTargets.includes(target));assert.equal(typeof node.fullHtml,'string');
 const element=page.locator(target);assert.equal(await element.count(),1);await element.evaluate(e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
 const measured=await element.evaluate((e,target)=>{
  const rgb=s=>{const m=s.match(/^rgba?\(([^)]+)\)$/);if(!m)throw Error('CAPTION_COLOR_UNSUPPORTED');const a=m[1].split(',').map(Number);return{rgb:a.slice(0,3),alpha:a.length===4?a[3]:1};};
  const rectangle=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
  const s=getComputedStyle(e),caption=e.parentElement,figure=caption?.parentElement,veil=figure?.querySelector(':scope>.login-velo'),photo=figure?.querySelector(':scope>img.login-foto-marca');
  if(e.tagName!=='P'||caption?.tagName!=='FIGCAPTION'||!figure?.matches('figure.login-lamina')||!veil||!photo)throw Error('CAPTION_STRUCTURE_CHANGED');
  if(figure.children.length!==3||figure.children[0]!==photo||figure.children[1]!==veil||figure.children[2]!==caption)throw Error('CAPTION_STACK_CHANGED');
  const vs=getComputedStyle(veil),cs=getComputedStyle(caption),ps=getComputedStyle(photo),r=rectangle(e),v=rectangle(veil);
  const surface=n=>{const t=getComputedStyle(n);return{visibility:t.visibility,display:t.display,opacity:t.opacity,filter:t.filter,backdrop:t.backdropFilter??'none',blend:t.mixBlendMode,transform:t.transform,clip:t.clipPath,mask:t.maskImage??'none',webkitMask:t.webkitMaskImage??'none',backgroundSize:t.backgroundSize,backgroundClip:t.backgroundClip,backgroundOrigin:t.backgroundOrigin,backgroundPosition:t.backgroundPosition,border:['Top','Right','Bottom','Left'].map(k=>t['border'+k+'Width']),padding:['Top','Right','Bottom','Left'].map(k=>t['padding'+k]),radius:['TopLeft','TopRight','BottomRight','BottomLeft'].map(k=>t['border'+k+'Radius']),pseudos:['::before','::after'].map(p=>getComputedStyle(n,p).content)};};
  const veilSurface=surface(veil),textSurface=surface(e),photoSurface=surface(photo);const range=document.createRange();range.selectNodeContents(e);const tr=range.getBoundingClientRect();const textRect={top:tr.top,bottom:tr.bottom,left:tr.left,right:tr.right};
  const stack={veilPosition:vs.position,captionPosition:cs.position,photoPosition:ps.position,veilZ:vs.zIndex,captionZ:cs.zIndex,photoZ:ps.zIndex,veilBackground:vs.backgroundColor,captionBackground:cs.backgroundColor,textShadow:s.textShadow,textFill:s.webkitTextFillColor??s.color,textColor:s.color};
  const veilPaint=veilSurface.radius.every(x=>x==='0px')&& ['auto','auto auto'].includes(vs.backgroundSize)&&vs.backgroundClip==='border-box'&&vs.backgroundOrigin==='padding-box'&&vs.backgroundPosition==='0% 0%'&&veilSurface.border.every(x=>x==='0px')&&veilSurface.padding.every(x=>x==='0px');
  const kickerPaint=target!=='figcaption > .login-kicker'||(s.backgroundClip==='border-box'&&textSurface.border.every(x=>x==='0px')&&textSurface.radius.every(x=>/^\d+(\.\d+)?px$/.test(x))&&Math.max(...textSurface.radius.map(Number.parseFloat))<=Math.min(...textSurface.padding.map(Number.parseFloat))&&textRect.left>=r.left+Math.max(...textSurface.radius.map(Number.parseFloat))&&textRect.right<=r.right-Math.max(...textSurface.radius.map(Number.parseFloat))&&textRect.top>=r.top+Math.max(...textSurface.radius.map(Number.parseFloat))&&textRect.bottom<=r.bottom-Math.max(...textSurface.radius.map(Number.parseFloat)));
  const layers=[];for(let n=e;n;n=n.parentElement){const t=getComputedStyle(n);layers.push({opacity:t.opacity,filter:t.filter,backdrop:t.backdropFilter??'none',blend:t.mixBlendMode,image:t.backgroundImage,transform:t.transform,visibility:t.visibility,clip:t.clipPath,mask:t.maskImage??t.webkitMaskImage??'none',before:getComputedStyle(n,'::before').content,after:getComputedStyle(n,'::after').content});}
  const plain=t=>t.visibility==='visible'&&t.display!=='none'&&t.clipPath==='none'&&(t.maskImage??t.webkitMaskImage??'none')==='none'&&t.opacity==='1'&&t.filter==='none'&&(t.backdropFilter??'none')==='none'&&t.mixBlendMode==='normal'&&t.transform==='none';
  const safeLayers=veilPaint&&kickerPaint&&layers.every(t=>t.visibility==='visible'&&t.clip==='none'&&t.mask==='none'&&t.opacity==='1'&&t.filter==='none'&&t.backdrop==='none'&&t.blend==='normal'&&t.image==='none'&&t.transform==='none'&&['none','normal'].includes(t.before)&&['none','normal'].includes(t.after))&&plain(vs)&&plain(ps)&&[veil,photo].every(n=>['::before','::after'].every(p=>['none','normal'].includes(getComputedStyle(n,p).content)))&&vs.position==='absolute'&&cs.position==='absolute'&&cs.zIndex==='1'&&vs.zIndex==='auto'&&ps.zIndex==='auto'&&vs.backgroundColor==='rgba(0, 0, 0, 0)'&&cs.backgroundColor==='rgba(0, 0, 0, 0)'&&s.textShadow==='none'&&(!s.webkitTextFillColor||s.webkitTextFillColor===s.color);
  const unoccluded=[.1,.5,.9].every(x=>[.1,.5,.9].every(y=>{const h=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);return h===e||e.contains(h);}));
  return{target,tag:e.tagName,html:e.outerHTML,foreground:rgb(s.color),background:rgb(s.backgroundColor),fontSize:Number.parseFloat(s.fontSize),fontWeight:s.fontWeight,rect:r,veilRect:v,gradient:vs.backgroundImage,stack,layers,veilSurface,textSurface,photoSurface,textRect,veilPaint,kickerPaint,safeLayers,unoccluded,visible:r.width>0&&r.height>0&&r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth};
 },target);
 assert.equal(measured.html.replaceAll(' style=""',''),node.fullHtml.replaceAll(' style=""',''),'CONTRAST_DOM_CHANGED');
 return{...measured,...captionBound(measured),rule:'color-contrast',html:node.html,measuredHtml:measured.html,status:'resolved_current_caption_bound'};
}
