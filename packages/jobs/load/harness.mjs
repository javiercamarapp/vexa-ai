// Author benchmark adapter. Existing accepted local infrastructure is read-only.
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
export function basePort(value=process.env.VEXA_LOAD_BASE_PORT??'62820'){const port=Number(value);assert.ok(Number.isInteger(port)&&port>=1024&&port<=65530,'LOAD_PORT_RANGE');return port;}
export async function setup(candidate,evidence){
 const port=basePort();
 const parent=new URL('../../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url),directory=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-public-load-driver-'));let h;
 try{let code=fs.readFileSync(parent,'utf8');
 code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,parent).href):original);
 code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,parent).href)+')');
 for(let i=0;i<6;i++)code=code.replaceAll(String(58160+i),String(port+i));
 code=code.replace("['run','build','--workspace','@vexa/web']","['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']");
 for(const [before,after] of [["assert.equal(r.status,0,'BUILD_'+args[0]);","assert.equal(r.error,undefined,'BUILD_ERROR');assert.equal(r.signal,null,'BUILD_SIGNAL');assert.equal(r.status,0,'BUILD_'+args[0]);"],["assert.equal(build.status,0,'REAL_CLI_BUILD');","assert.equal(build.error,undefined,'CLI_BUILD_ERROR');assert.equal(build.signal,null,'CLI_BUILD_SIGNAL');assert.equal(build.status,0,'REAL_CLI_BUILD');"],["cwd:tmp,env,encoding:'utf8'});","cwd:tmp,env,encoding:'utf8',timeout:150000});"]]){assert.ok(code.includes(before),'LOAD_HARNESS_ADAPTER_DRIFT');code=code.replace(before,after);}
 fs.writeFileSync(path.join(directory,'harness.mjs'),code);const module=await import(pathToFileURL(path.join(directory,'harness.mjs')));h=await module.setup(candidate,evidence);const close=h.close.bind(h);h.close=async()=>{try{await close();}finally{fs.rmSync(directory,{recursive:true,force:true});}};return h;
 }catch(error){if(h)await h.close();fs.rmSync(directory,{recursive:true,force:true});throw error;}
}
