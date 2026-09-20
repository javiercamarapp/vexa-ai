// Reuse the reviewed SQL/Auth/Storage setup; only isolate ports and load alias product.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
export {q,hash} from '../F03-sync/harness.mjs';
export async function setup(candidate,evidence){
 for(const f of ['packages/connectors/aliases.mjs','supabase/migrations/0009_aliases.sql'])assert.ok(fs.existsSync(path.join(candidate??'',f)),'ALIAS_IMPLEMENTATION_MISSING:'+f);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'f0304-harness-'));const base=new URL('../F03-sync/harness.mjs',import.meta.url);
 let code=fs.readFileSync(base,'utf8');
 code=code.replace("from '../../scaffold-copy.mjs'",'from '+JSON.stringify(new URL('../../scaffold-copy.mjs',base).href));
 code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,rel)=>'new URL('+JSON.stringify(new URL(rel,base).href)+')');
 code=code.replaceAll('58300','58430').replaceAll('58301','58431').replaceAll('58302','58432').replaceAll('f0303','f0304');
 const file=path.join(dir,'harness.mjs');fs.writeFileSync(file,code);let h;
 try{h=await(await import(pathToFileURL(file))).setup(candidate,evidence);h.aliases=await import(pathToFileURL(path.join(h.built,'packages/connectors/aliases.mjs')));h.aliasRepository=a=>h.aliases.createAliasRepository({database:h.repository(a).database});return h;}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
