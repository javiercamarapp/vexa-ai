import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
import {resourceBroker} from '../../tests/acceptance/support/ci/resources.mjs';
import {renderEmailPreviews} from './presentation-browser421.mjs';
const image='mcp/playwright@sha256:8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492';
export async function emailPresentation421({templatePath,evidence,capturedHtml,scope}){
 const {renderEmail,catalog}=await import(pathToFileURL(templatePath));
 const templates=(capturedHtml?catalog.filter(x=>x.type==='digest.available'):catalog).map(entry=>({type:entry.type,html:capturedHtml??renderEmail({type:entry.type,appOrigin:'https://syn-vexa.example.test',ctaUrl:'https://syn-vexa.example.test/notifications'}).html}));
 if(process.env.VEXA_PLAYWRIGHT_MODULE)return renderEmailPreviews({playwright:await import(process.env.VEXA_PLAYWRIGHT_MODULE),templates,evidence});
 const input=path.join(evidence,'presentation-input.json');fs.writeFileSync(input,JSON.stringify(templates),{mode:0o600});
 const broker=resourceBroker(),name='vexa-f01-04-'+randomUUID()+'-browser',labels=broker.reserve('container',name);let id,cleaned=false;
 const run=(args,timeout=20000)=>{const result=spawnSync('docker',args,{encoding:'utf8',timeout,maxBuffer:4*1024*1024});assert.equal(result.status,0,'EMAIL_PREVIEW_DOCKER:'+args[0]+':'+result.stderr);return result;};
 const cleanup=()=>{if(cleaned)return;broker.remove('container',name);cleaned=true;fs.writeFileSync(path.join(evidence,'presentation-docker-cleanup.json'),JSON.stringify({id,name,absent:true,network:'none'}));};
 if(scope){const close=scope.close.bind(scope);scope.close=async()=>{try{cleanup();}finally{await close();}};}
 try{
  id=run(['run','--pull','never','-d','--name',name,...labels,'--network','none','--entrypoint','sleep',image,'300']).stdout.trim();
  fs.writeFileSync(path.join(evidence,'presentation-docker-owned.json'),JSON.stringify({id,name,image,network:'none'}));
  run(['exec',id,'mkdir','-p','/tmp/email-preview/out']);run(['cp',input,id+':/tmp/email-preview/input.json']);run(['exec','--user','0',id,'chmod','0644','/tmp/email-preview/input.json']);run(['cp',fileURLToPath(new URL('./presentation-browser421.mjs',import.meta.url)),id+':/tmp/email-preview/driver.mjs']);
  const result=run(['exec','-e','VEXA_EMAIL_PREVIEW_INPUT=/tmp/email-preview/input.json','-e','VEXA_EMAIL_PREVIEW_OUTPUT=/tmp/email-preview/out',id,'node','/tmp/email-preview/driver.mjs'],120000);fs.writeFileSync(path.join(evidence,'presentation-docker.log'),result.stdout+result.stderr);
  run(['cp',id+':/tmp/email-preview/out/.',evidence]);return JSON.parse(fs.readFileSync(path.join(evidence,'presentation421.json'))).results;
 }finally{cleanup();}
}
if(process.env.SYN421_TEMPLATE)await emailPresentation421({templatePath:process.env.SYN421_TEMPLATE,evidence:process.env.SYN421_EVIDENCE,capturedHtml:process.env.SYN421_CAPTURED?fs.readFileSync(process.env.SYN421_CAPTURED,'utf8'):undefined});
