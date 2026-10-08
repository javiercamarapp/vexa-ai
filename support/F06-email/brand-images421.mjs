import assert from 'node:assert/strict';
/** Branding is a declared same-origin asset; it does not authorize other image requests. */
export function emailImages(html,{appOrigin,asset}){
 assert.doesNotMatch(html,/<script|<iframe|<form|@import/i);
 const images=[...html.matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]);
 assert.equal(images.length,asset.logoPath?1:0,'ONLY_DECLARED_BRAND_IMAGE');
 if(!asset.logoPath)return;
 const expected=new URL(asset.logoPath,appOrigin);assert.equal(expected.protocol,'https:');assert.equal(expected.origin,new URL(appOrigin).origin);
 const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'="([^"]*)"','i'))?.[1];const image=images[0];
 assert.equal(attr(image,'src'),expected.href,'EXACT_SAME_ORIGIN_BRAND_ASSET');assert.equal(attr(image,'alt'),'Rovaq AI');
 assert.equal(attr(image,'width'),String(asset.width));assert.equal(attr(image,'height'),String(asset.height));assert.ok(asset.width>=16&&asset.height>=16);
 assert.doesNotMatch(image,/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:;|\s|["'])/i);
}
