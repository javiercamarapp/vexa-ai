/** Reuse the existing F03-06 harness, isolated to the demo's six ports. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createServer} from 'node:net';
export async function setup(root,evidence){
 for(let port=61620;port<=61625;port++)await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'portability353-driver-'));
 const base=pathToFileURL(path.join(root,'tests/acceptance/support/F03-comparison/harness.mjs'));
 let code=fs.readFileSync(base,'utf8').replace(/new URL\('([^']+)',import.meta.url\)/g,(_,p)=>'new URL('+JSON.stringify(new URL(p,base).href)+')').replaceAll('58620','61620');
 fs.writeFileSync(path.join(driver,'harness.mjs'),code);
 try{const h=await(await import(pathToFileURL(path.join(driver,'harness.mjs')))).setup(root,evidence);const close=h.close.bind(h);h.close=async()=>{try{await close();}finally{fs.rmSync(driver,{recursive:true,force:true});}};return h;}catch(e){fs.rmSync(driver,{recursive:true,force:true});throw e;}
}
