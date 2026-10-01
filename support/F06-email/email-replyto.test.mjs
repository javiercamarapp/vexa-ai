import test from 'node:test';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import path from 'node:path';const {createEmailTransport}=await import(pathToFileURL(path.join(process.env.VEXA_CANDIDATE,'packages/notifications/email.mjs')));
for(const mode of ['mailpit','resend'])test(mode+' validates and delivers configured Reply-To without overriding recipient',async()=>{
 const r={email:'recipient@syn.test',emailVerified:true,channel:'email',tenantId:'SYN_T',userId:'SYN_U'},key='a'.repeat(64);let seen,prepared=0;
 const options={mode,apiKey:'re_SYN',from:'vexa@syn.test',appOrigin:'https://vexa.test',repository:{prepare:async()=>{prepared++;return r},accepted:async()=>{}},resend:{emails:{send:async m=>{seen=m;return{data:{id:'SYN_ID'}}}}},smtp:{sendMail:async m=>{seen=m;return{accepted:[r.email]}}}};
 const transport=createEmailTransport({...options,replyTo:'support@syn.test'});assert.equal((await transport.send({recipient:r,idempotencyKey:key})).kind,'accepted');assert.equal(seen.replyTo,'support@syn.test');assert.ok([seen.to].flat().includes(r.email));
 const before=prepared;const invalid=createEmailTransport({...options,replyTo:'support@syn.test\r\nBcc: other@syn.test'});assert.equal(invalid.configured(),false);assert.equal((await invalid.send({recipient:r,idempotencyKey:key})).kind,'blocked');assert.equal(prepared,before);
 const absent=createEmailTransport(options);await absent.send({recipient:r,idempotencyKey:key});assert.equal(Object.hasOwn(seen,'replyTo'),false);
});
