// Developer-only local runner. Reuses the existing real Auth/PG/Storage/worker harness read-only.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 const base=pathToFileURL(path.join(candidate,'tests/acceptance/support/F02-durable-final/harness.mjs'));
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-team343-driver-'));let h;const pools=[];
 try{
  let code=fs.readFileSync(base,'utf8');
  code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original);
  code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
  for(let n=0;n<6;n++)code=code.replaceAll(String(58160+n),String(61620+n));
  code=code.replace("'packages/jobs','packages/ingestion'","'packages/team','packages/recovery','packages/gateway','packages/intelligence','packages/notifications','packages/briefs','packages/interventions','packages/recommendations','packages/workspace-service','packages/metrics','packages/economics','packages/problems','packages/connectors','packages/jobs','packages/ingestion'");
  // Reuse complete source hashes. Runtime methods use actual product modules, never behavioral replacements.
  code=code.replace('h.built=built;h.common=common;',`h.built=built;h.common=common;for(const name of ['team','recovery','gateway','intelligence','notifications','briefs','interventions','recommendations','workspace-service','metrics','economics','problems','connectors'])fs.cpSync(path.join(tmp,'packages',name),path.join(built,'packages',name),{recursive:true});`);
  // DB outage can terminate Next: stopping an already exited child must not await a second exit event.
  code=code.replace("if(web){const end=once(web,'exit');web.kill('SIGKILL');await end;children.delete(web);web=null;}","if(web){if(web.exitCode===null&&web.signalCode===null){const end=once(web,'exit');web.kill('SIGKILL');await end;}children.delete(web);web=null;}");
  code=code.replace("['run','build','--workspace','@vexa/web']","['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']");
  code=code.replace("fs.writeFileSync(path.join(tmp,'infra.mjs'),code);", `
  code=code.replace('return {container:prefix', 'return {service,container:prefix');
  code=code.replace("run('auth',", "const mail=prefix+'-mail';owned.push(mail);docker(['run','--pull','never','-d','--name',mail,...resources.reserve('container',mail),'--network',prefix,'public.ecr.aws/supabase/mailpit:v1.30.2']);run('auth',");
  code=code.replace('GOTRUE_MAILER_AUTOCONFIRM:true','GOTRUE_MAILER_AUTOCONFIRM:true,GOTRUE_SMTP_HOST:prefix+\"-mail\",GOTRUE_SMTP_PORT:1025,GOTRUE_SMTP_ADMIN_EMAIL:\"noreply@example.test\",GOTRUE_SMTP_SENDER_NAME:\"SYN VEXA\",GOTRUE_URI_ALLOW_LIST:\"http://127.0.0.1:61624/**\",GOTRUE_SMTP_MAX_FREQUENCY:\"0s\",GOTRUE_RATE_LIMIT_EMAIL_SENT:100');
  fs.writeFileSync(path.join(tmp,'infra.mjs'),code);`);
  code=code.replace("if(h.fault&&kind==='storage'","if(kind==='auth'&&req.url.startsWith('/auth/v1/invite')){h.inviteCalls=(h.inviteCalls??0)+1;if(h.teamFault){res.destroy();return;}}if(h.fault&&kind==='storage'");
  code=code.replace('h.auth=infra.http;', 'h.auth=infra.http;h.newUser=infra.user;h.pc=pc;h.mail=route=>{const r=spawnSync(\'docker\',[\'exec\',pc.container.replace(/-storage$/,\'-mail\'),\'wget\',\'-qO-\',\'http://127.0.0.1:8025\'+route],{encoding:\'utf8\'});assert.equal(r.status,0);return JSON.parse(r.stdout);};');
  code=code.replace('VEXA_IMPORT_CONFIRMATION_SECRET:randomUUID()', 'VEXA_TEAM_AUTH_ADMIN_KEY:pc.service,VEXA_TEAM_AUTH_URL:publicBase,VEXA_IMPORT_CONFIRMATION_SECRET:randomUUID()');
  code=code.replace("path.join(evidence,args[0]+'.log')","path.join(evidence,args.join('-').replaceAll('/','_')+'.log')");
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
