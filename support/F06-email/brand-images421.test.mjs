import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';import {emailImages} from './brand-images421.mjs';
const fixture=process.env.SYN421_LOGO_FIXTURE,{renderEmail}=await import(pathToFileURL(path.join(fixture,'packages/notifications/email-template.mjs'))),{brand}=await import(pathToFileURL(path.join(fixture,'apps/web/src/lib/brand.mjs'))),asset=brand(),appOrigin='https://syn-vexa.example.test';
const html=renderEmail({type:'digest.available',appOrigin,ctaUrl:appOrigin+'/notifications'}).html;
test('declared same-origin PNG brand is allowed without permitting tracking',()=>{
 if(process.env.SYN421_OLD_IMAGE_ORACLE==='1'){assert.doesNotMatch(html,/<script|<iframe|<form|<img|@import|https?:\/\/[^"'\s<>]*(?:tracking|pixel)/i);return;}
 emailImages(html,{appOrigin,asset});
 assert.throws(()=>emailImages(html.replace(appOrigin+'/brand/SYN-logo.png','https://external.example.test/pixel'),{appOrigin,asset}),/EXACT_SAME_ORIGIN_BRAND_ASSET/);
 assert.throws(()=>emailImages(html.replace('</body>','<img src="https://external.example.test/pixel" width="1" height="1"></body>'),{appOrigin,asset}),/ONLY_DECLARED_BRAND_IMAGE/);
 assert.throws(()=>emailImages(html,{appOrigin,asset:{...asset,logoPath:null}}),/ONLY_DECLARED_BRAND_IMAGE/);
 for(const logoPath of ['https://external.example.test/logo.png','data:image/png;base64,SYN','/brand/logo.svg','/other/logo.png'])assert.throws(()=>brand({...asset,logoPath}));
});
