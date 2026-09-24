// Developer-only local runner. Reuses the existing real Auth/PG/Storage/worker harness read-only.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import {replaceRequired} from './guards.mjs';import {spawnSync} from 'node:child_process';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export function adaptHarness(original,base){
 let code=original;const change=(pattern,replacement,label,all=false)=>{code=replaceRequired(code,pattern,replacement,label,all);};
  change(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original,'replacement1');
  change(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')','replacement2');
  for(let n=0;n<6;n++)change(String(58160+n),String(61620+n),'replacement3',true);
  change("'packages/jobs','packages/ingestion'","'packages/recovery','packages/gateway','packages/intelligence','packages/briefs','packages/interventions','packages/recommendations','packages/workspace-service','packages/metrics','packages/economics','packages/problems','packages/connectors','packages/jobs','packages/ingestion'",'replacement4');
  change("const common={...env,","const common={...env,VEXA_RETENTION_LEDGER_KEY:'SYN-local-chaos359-ledger-key-not-for-production',",'replacement5');
  change("['run','build','--workspace','@vexa/web']","['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']",'replacement6');
  change("assert.equal(r.status,0,'BUILD_'+args[0]);","validateProcess(r,'BUILD_'+args[0]);",'replacement7');
  change("assert.equal(build.status,0,'REAL_CLI_BUILD');","validateProcess(build,'REAL_CLI_BUILD');",'replacement8');
  change("args[0]+'.log'","args.join('-').replaceAll('/','_')+'.log'",'replacement9');
  // Reuse complete source hashes. Runtime methods use actual product modules, never behavioral replacements.
  change('h.built=built;h.common=common;',`h.built=built;h.common=common;for(const name of ['recovery','gateway','intelligence','briefs','interventions','recommendations','workspace-service','metrics','economics','problems','connectors'])fs.cpSync(path.join(tmp,'packages',name),path.join(built,'packages',name),{recursive:true});`,'replacement10');
  // DB outage can terminate Next: stopping an already exited child must not await a second exit event.
  change("if(web){const end=once(web,'exit');web.kill('SIGKILL');await end;children.delete(web);web=null;}","if(web){if(web.exitCode===null&&web.signalCode===null){const end=once(web,'exit');web.kill('SIGKILL');await end;}children.delete(web);web=null;}",'replacement11');
 change("{cwd:tmp,env,encoding:'utf8'});","{cwd:tmp,env,encoding:'utf8',timeout:150000});",'cli_timeout');
 return 'import {validateProcess} from '+JSON.stringify(new URL('./guards.mjs',import.meta.url).href)+';\n'+code;
}
export async function setup(candidate,evidence){
 const base=pathToFileURL(path.join(candidate,'tests/acceptance/support/F02-durable-final/harness.mjs'));
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-chaos359-driver-'));let h;const pools=[];
 try{
  const code=adaptHarness(fs.readFileSync(base,'utf8'),base);
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
