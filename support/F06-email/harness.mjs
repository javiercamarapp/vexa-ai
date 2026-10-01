import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 for(const f of ['packages/notifications/index.mjs'])assert.ok(candidate&&fs.existsSync(path.join(candidate,f)),'IMPLEMENTATION_MISSING:'+f);
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'f03-runtime-driver-'));let h;const pools=[];
 try{let code=fs.readFileSync(new URL('../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url),'utf8');
 const base=new URL('../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url);
 code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original);
 code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
 code=code.replace("['run','build','--workspace','@vexa/web']", "['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']");
 for(let n=0;n<6;n++)code=code.replaceAll(String(58160+n),String(60820+n));
 code=code.replace("'packages/jobs','packages/ingestion'","'packages/notifications','packages/briefs','packages/interventions','packages/recommendations','packages/workspace-service','packages/metrics','packages/economics','packages/problems','packages/gateway','packages/intelligence','packages/connectors','packages/jobs','packages/ingestion'");
 code=code.replace('h.built=built;h.common=common;','h.built=built;h.common=common;fs.cpSync(path.join(tmp,\'packages/connectors\'),path.join(built,\'packages/connectors\'),{recursive:true});for(const module of [\'notifications\',\'briefs\',\'interventions\',\'recommendations\',\'workspace-service\',\'metrics\',\'economics\',\'problems\',\'gateway\',\'intelligence\'])fs.cpSync(path.join(tmp,\'packages/\'+module),path.join(built,\'packages/\'+module),{recursive:true});');
 const audit=path.join(driver,'outbound-audit.mjs'),auditJournal=path.join(evidence,'outbound-attempts.jsonl');fs.copyFileSync(new URL('../F06-recommendations/outbound-audit.mjs',import.meta.url),audit);fs.writeFileSync(auditJournal,'',{mode:0o600,flag:'wx'});code=code.replace('NEXT_PUBLIC_SUPABASE_URL:publicBase',`NODE_OPTIONS:${JSON.stringify('--import='+audit)},VEXA_RECOMMENDATION_AUDIT:${JSON.stringify(auditJournal)},NEXT_PUBLIC_SUPABASE_URL:publicBase`);
 fs.writeFileSync(path.join(driver,'harness.mjs'),code);const mod=await import(pathToFileURL(path.join(driver,'harness.mjs')));h=await mod.setup(candidate,evidence);const close=h.close.bind(h);h.close=async()=>{for(const p of pools)await p.end();await close();fs.rmSync(driver,{recursive:true,force:true});};
 const{default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js')));const{createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));h.sync=await import(pathToFileURL(path.join(h.built,'packages/connectors/sync.mjs')));h.health=await import(pathToFileURL(path.join(h.built,'packages/connectors/health.mjs')));h.ingestion=await import(pathToFileURL(path.join(h.built,'packages/ingestion/index.mjs')));
 for(const a of [h.A,h.B]){a.role='owner';a.source='zendesk';a.account='SYN-account-'+randomUUID();h.sql(`UPDATE connections SET source='zendesk',account_id=${q(a.account)},credential_ref='SYN-SECRET-REFERENCE' WHERE id=${q(a.connection)}`);}
 h.repository=a=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2});pools.push(pool);const identity={async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role??'owner',status:'active',permissions_version:1}];}};const database=createDatabase({identity,pool,selectedTenant:a.tenant});return {database,repository:h.sync.createSyncRepository({database}),health:h.health.createHealthRepository({database})};};

 const {createOutboxRepository}=await import(pathToFileURL(path.join(h.built,'packages/notifications/outbox.mjs')));
 h.outbox=(actor=h.A)=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2});pools.push(pool);const identity={async getUser(){return{id:actor.id};},async memberships(){return[{tenant_id:actor.tenant,user_id:actor.id,role:'owner',status:'active',permissions_version:1}];}};return createOutboxRepository({database:createDatabase({identity,pool,selectedTenant:actor.tenant}),leaseMs:30000});};
 const emailRole='syn_email303_'+randomUUID().replaceAll('-',''),password=randomUUID();
 h.sql(`CREATE ROLE ${emailRole} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD ${q(password)};GRANT vexa_email_service TO ${emailRole};`);
 const emailUrl=new URL(h.common.VEXA_DATABASE_URL);emailUrl.username=emailRole;emailUrl.password=password;
 h.emailUrl=emailUrl.toString();h.emailPool=new pg.Pool({connectionString:emailUrl.toString(),max:2});pools.push(h.emailPool);
 return h;
 }catch(e){if(h)await h.close();fs.rmSync(driver,{recursive:true,force:true});throw e;}
}

import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
export async function mailpit(evidence){
 const name='vexa-SYN303-mailpit-'+randomUUID();
 const run=spawnSync('docker',['run','--pull','never','-d','--name',name,'--network','none','public.ecr.aws/supabase/mailpit:v1.30.2'],{encoding:'utf8',timeout:20000});
 assert.equal(run.status,0,'MAILPIT_LOCAL_START');
 const id=run.stdout.trim();fs.writeFileSync(path.join(evidence,'mailpit-owned.json'),JSON.stringify({name,id,network:'none',smtpRelay:false}));
 const children=new Set();const tunnel=createServer(socket=>{const child=spawn('docker',['exec','-i',id,'nc','127.0.0.1','1025'],{stdio:['pipe','pipe','ignore']});children.add(child);socket.pipe(child.stdin);child.stdout.pipe(socket);socket.on('error',()=>{});child.stdin.on('error',()=>{});socket.on('close',()=>child.kill());child.on('exit',()=>{children.delete(child);socket.destroy();});});
 try{tunnel.listen(60825,'127.0.0.1');await once(tunnel,'listening');}catch(error){tunnel.close();spawnSync('docker',['rm','-f',id],{encoding:'utf8',timeout:15000});throw error;}
 const json=resource=>{const r=spawnSync('docker',['exec',id,'wget','-qO-','http://127.0.0.1:8025/api/v1/'+resource],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,'MAILPIT_API');return JSON.parse(r.stdout);};
 return {id,json,async close(){for(const child of children){if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}}await new Promise(resolve=>tunnel.close(resolve));const r=spawnSync('docker',['rm','-f',id],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,'MAILPIT_CLEANUP');const v=spawnSync('docker',['inspect',id],{encoding:'utf8',timeout:10000});assert.match(v.stderr,/no such/i);fs.writeFileSync(path.join(evidence,'mailpit-cleanup.json'),JSON.stringify({id,absent:true}));}};
}

/** Extend the existing signal cleanup before the SMTP fixture is used. Both closes are idempotent. */
export function ownMailpit(h,fixture){
 const closeRuntime=h.close.bind(h),closeMailpit=fixture.close.bind(fixture);let mailpitClosing,closing;
 fixture.close=()=>mailpitClosing??=closeMailpit();
 h.close=()=>closing??=(async()=>{try{await fixture.close();}finally{await closeRuntime();}})();
 return fixture;
}
