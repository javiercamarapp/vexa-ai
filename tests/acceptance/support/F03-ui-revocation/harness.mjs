import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'f03-ui-revocation-driver-'));const base=new URL('../F03-comparison/harness.mjs',import.meta.url);let h;
 try {let code=fs.readFileSync(base,'utf8').replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
 const port=Number(process.env.VEXA_UI_REVIEW_PORT_BASE??59340);if(!Number.isInteger(port)||port<1024||port>65529)throw Error('INVALID_PORT_BASE');code=code.replace('58620+n',String(port)+'+n');
 fs.writeFileSync(path.join(driver,'harness.mjs'),code);h=await(await import(pathToFileURL(path.join(driver,'harness.mjs')))).setup(candidate,evidence);const close=h.close.bind(h);h.close=async()=>{try{await close();}finally{fs.rmSync(driver,{recursive:true,force:true});}};return h;
 } catch(error){if(h)await h.close();fs.rmSync(driver,{recursive:true,force:true});throw error;}
}
