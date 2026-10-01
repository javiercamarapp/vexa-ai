import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
test('built durable worker includes shared email branding dependency',async()=>{
 const root=path.resolve(process.env.VEXA_CANDIDATE);const dir=mkdtempSync(path.join(os.tmpdir(),'vexa-email-brand-build-'));
 try{execFileSync(process.execPath,[path.join(root,'packages/jobs/durable/build.mjs'),dir],{cwd:root,stdio:'pipe'});const {renderEmail}=await import(pathToFileURL(path.join(dir,'packages/notifications/email-template.mjs')));const result=renderEmail({type:'digest.available',appOrigin:'https://vexa.test',ctaUrl:'https://vexa.test/notifications'});assert.match(result.html,/VEXA/);assert.match(result.text,/https:\/\/vexa.test\/notifications/);}finally{rmSync(dir,{recursive:true,force:true});}
});
