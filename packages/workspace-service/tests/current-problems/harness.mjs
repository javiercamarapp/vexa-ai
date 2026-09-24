// Developer-only local runner. Reuses the existing real Auth/PG/Storage/worker harness read-only.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 const base=pathToFileURL(path.join(candidate,'tests/acceptance/support/F02-durable-final/harness.mjs'));
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-history321-driver-'));let h;const pools=[];
 try{
  let code=fs.readFileSync(base,'utf8');
  code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original);
  code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
  for(let n=0;n<6;n++)code=code.replaceAll(String(58160+n),String(63420+n));
  code=code.replace("'packages/jobs','packages/ingestion'","'packages/gateway','packages/intelligence','packages/notifications','packages/briefs','packages/interventions','packages/recommendations','packages/workspace-service','packages/metrics','packages/economics','packages/problems','packages/connectors','packages/jobs','packages/ingestion'");
  // Reuse complete source hashes. Runtime methods use actual product modules, never behavioral replacements.
  code=code.replace('h.built=built;h.common=common;',`h.built=built;h.common=common;for(const name of ['gateway','intelligence','notifications','briefs','interventions','recommendations','workspace-service','metrics','economics','problems','connectors'])fs.cpSync(path.join(tmp,'packages',name),path.join(built,'packages',name),{recursive:true});`);
  // DB outage can terminate Next: stopping an already exited child must not await a second exit event.
  code=code.replace("if(web){const end=once(web,'exit');web.kill('SIGKILL');await end;children.delete(web);web=null;}","if(web){if(web.exitCode===null&&web.signalCode===null){const end=once(web,'exit');web.kill('SIGKILL');await end;}children.delete(web);web=null;}");
  fs.writeFileSync(path.join(driver,'harness.mjs'),code);
  h=await(await import(pathToFileURL(path.join(driver,'harness.mjs')))).setup(candidate,evidence);
  const close=h.close.bind(h);h.close=async()=>{for(const p of pools)await p.end();await close();fs.rmSync(driver,{recursive:true,force:true});};
  const {default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js'))),{createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));
  h.database=(a=h.A)=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2,connectionTimeoutMillis:2000,idleTimeoutMillis:1000});pool.on('error',()=>{});pools.push(pool);const identity={async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role??'owner',status:'active',permissions_version:1}];}};return createDatabase({identity,pool,selectedTenant:a.tenant});};
  h.sync=await import(pathToFileURL(path.join(h.built,'packages/connectors/sync.mjs')));h.health=await import(pathToFileURL(path.join(h.built,'packages/connectors/health.mjs')));h.ingestion=await import(pathToFileURL(path.join(h.built,'packages/ingestion/index.mjs')));
  h.repository=a=>({database:h.database(a)});
  const journal=path.join(evidence,'resources.jsonl');assert.equal(fs.statSync(journal).mode&0o777,0o600,'JOURNAL_MUST_BE_0600');
  const resources=fs.readFileSync(journal,'utf8').trim().split('\n').map(JSON.parse);const db=resources.find(r=>r.kind==='container'&&r.name.endsWith('-db'));assert.ok(db,'OWN_DATABASE_REQUIRED');
  const inspected=spawnSync('docker',['inspect',db.name,'--format','{{.Id}}|{{index .Config.Labels "vexa.ci.broker"}}'],{encoding:'utf8',timeout:10000});assert.equal(inspected.status,0);const [id,broker]=inspected.stdout.trim().split('|');assert.equal(broker,db.broker);assert.match(id,/^[0-9a-f]{64}$/);
  h.databaseFault=async operation=>{assert.ok(['stop','start'].includes(operation));const check=spawnSync('docker',['inspect',id,'--format','{{index .Config.Labels "vexa.ci.broker"}}'],{encoding:'utf8',timeout:10000});assert.equal(check.stdout.trim(),broker,'FAULT_DATABASE_OWNERSHIP');const result=spawnSync('docker',operation==='stop'?['stop','--time','1',id]:['start',id],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,'OWN_DATABASE_'+operation);fs.appendFileSync(path.join(evidence,'database-faults.jsonl'),JSON.stringify({operation,id,at:new Date().toISOString()})+'\n',{mode:0o600});};
  return h;
 }catch(error){if(h)await h.close();fs.rmSync(driver,{recursive:true,force:true});throw error;}
}
