import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 for(const f of ['packages/metrics/priority.mjs','supabase/migrations/0022_priority.sql','apps/web/src/components/economic-priority-panel.tsx'])assert.ok(candidate&&fs.existsSync(path.join(candidate,f)),'IMPLEMENTATION_MISSING:'+f);
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'f03-runtime-driver-'));let h;const pools=[];
 try{let code=fs.readFileSync(new URL('../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url),'utf8');
 const base=new URL('../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url);
 code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original);
 code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
 code=code.replace("['run','build','--workspace','@vexa/web']", "['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']");
 for(let n=0;n<6;n++)code=code.replaceAll(String(58160+n),String(60520+n));
 code=code.replace("'packages/jobs','packages/ingestion'","'packages/metrics','packages/economics','packages/problems','packages/gateway','packages/intelligence','packages/connectors','packages/jobs','packages/ingestion'");
 code=code.replace('h.built=built;h.common=common;','h.built=built;h.common=common;fs.cpSync(path.join(tmp,\'packages/connectors\'),path.join(built,\'packages/connectors\'),{recursive:true});for(const module of [\'metrics\',\'economics\',\'problems\',\'gateway\',\'intelligence\'])fs.cpSync(path.join(tmp,\'packages/\'+module),path.join(built,\'packages/\'+module),{recursive:true});');
 fs.writeFileSync(path.join(driver,'harness.mjs'),code);const mod=await import(pathToFileURL(path.join(driver,'harness.mjs')));h=await mod.setup(candidate,evidence);const close=h.close.bind(h);h.close=async()=>{for(const p of pools)await p.end();await close();fs.rmSync(driver,{recursive:true,force:true});};
 const{default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js')));const{createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));h.sync=await import(pathToFileURL(path.join(h.built,'packages/connectors/sync.mjs')));h.health=await import(pathToFileURL(path.join(h.built,'packages/connectors/health.mjs')));h.ingestion=await import(pathToFileURL(path.join(h.built,'packages/ingestion/index.mjs')));
 for(const a of [h.A,h.B]){a.role='owner';a.source='zendesk';a.account='SYN-account-'+randomUUID();h.sql(`UPDATE connections SET source='zendesk',account_id=${q(a.account)},credential_ref='SYN-SECRET-REFERENCE' WHERE id=${q(a.connection)}`);}
 h.repository=a=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2});pools.push(pool);const identity={async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role??'owner',status:'active',permissions_version:1}];}};const database=createDatabase({identity,pool,selectedTenant:a.tenant});return {database,repository:h.sync.createSyncRepository({database}),health:h.health.createHealthRepository({database})};};
 return h;
 }catch(e){if(h)await h.close();fs.rmSync(driver,{recursive:true,force:true});throw e;}
}
