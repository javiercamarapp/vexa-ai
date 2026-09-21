import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 for(const f of ['packages/connectors/comparability.mjs','apps/web/src/components/migration-comparison.tsx'])assert.ok(candidate&&fs.existsSync(path.join(candidate,f)),'COMPARABILITY_IMPLEMENTATION_MISSING:'+f);
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'f0306-driver-'));let h;const pools=[];
 try{const base=new URL('../F02-durable-final/harness.mjs',import.meta.url);let code=fs.readFileSync(base,'utf8');
 code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original);
 code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
 code=code.replace("['run','build','--workspace','@vexa/web']","['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']");
 for(let n=0;n<6;n++)code=code.replaceAll(String(58160+n),String(58620+n));
 code=code.replace("'packages/jobs','packages/ingestion'","'packages/connectors','packages/economics','packages/jobs','packages/ingestion'");
 code=code.replace('h.built=built;h.common=common;',"h.built=built;h.common=common;for(const name of ['connectors','economics'])fs.cpSync(path.join(tmp,'packages',name),path.join(built,'packages',name),{recursive:true});");
 fs.writeFileSync(path.join(driver,'harness.mjs'),code);h=await(await import(pathToFileURL(path.join(driver,'harness.mjs')))).setup(candidate,evidence);const close=h.close.bind(h);h.close=async()=>{for(const p of pools)await p.end();await close();fs.rmSync(driver,{recursive:true,force:true});};
 const {default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js')));const{createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));h.comparison=await import(pathToFileURL(path.join(h.built,'packages/connectors/comparability.mjs')));h.aliases=await import(pathToFileURL(path.join(h.built,'packages/connectors/aliases.mjs')));h.sync=await import(pathToFileURL(path.join(h.built,'packages/connectors/sync.mjs')));h.ingestion=await import(pathToFileURL(path.join(h.built,'packages/ingestion/index.mjs')));
 h.repository=a=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2});pools.push(pool);const database=createDatabase({identity:{async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role??'owner',status:'active',permissions_version:1}];}},pool,selectedTenant:a.tenant});return {database,comparison:h.comparison.createComparisonRepository({database}),aliases:h.aliases.createAliasRepository({database})};};return h;
 }catch(e){if(h)await h.close();fs.rmSync(driver,{recursive:true,force:true});throw e;}
}
