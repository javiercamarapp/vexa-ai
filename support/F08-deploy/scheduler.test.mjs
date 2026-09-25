import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from '../../tests/acceptance/support/F01-03/harness.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const q=s=>"'"+s.replaceAll("'","''")+"'";
test('history/problems scheduling with real PostgreSQL, pg_cron, pg_net and Vault',async t=>{
 const h=await launch();
 try{
  // Own disposable database only. Prevent background HTTP requests during SQL tests.
  h.sql("ALTER SYSTEM SET cron.launch_active_jobs='off'");
  h.sql('SELECT pg_reload_conf()');
  assert.equal(h.sql('SHOW cron.launch_active_jobs'),'off');
  h.sql('CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net; CREATE EXTENSION IF NOT EXISTS supabase_vault');
  for(const name of ['history','problems']){
   const body=fs.readFileSync(path.join(root,'supabase/operations',name+'-cron.sql'),'utf8');
   const endpoint='https://synthetic-vexa.invalid/api/internal/'+name;
   const secret='SYN-only-not-a-provider-secret-'+name+'-aaaaaaaa';
   const settings=(entries)=>Object.entries(entries).map(([k,v])=>`SELECT set_config(${q('vexa.'+name+'_'+k)},${q(v)},false);`).join('\n');
   await t.test(name+': no saved approval means no schedule or secret',()=>{
    const denied=h.probe(body.replace(/^begin;\n|^commit;$/gm,''));
    assert.equal(denied.code,'P0001');assert.equal(denied.message,'interactive approval required');
    assert.equal(h.sql(`SELECT count(*) FROM cron.job WHERE jobname=${q('vexa-'+name+'-chunk')}`),'0');
    assert.equal(h.sql(`SELECT count(*) FROM vault.secrets WHERE name=${q('vexa_'+name+'_trigger')}`),'0');
   });
   await t.test(name+': reject wrong protocol/path before writing',()=>{
    for(const bad of ['http://synthetic-vexa.invalid/api/internal/'+name,endpoint+'?tenant=A','https://user@synthetic-vexa.invalid/api/internal/'+name]){
     const denied=h.probe(settings({bootstrap_approved:'yes',endpoint:bad,secret}).replaceAll('SELECT set_config','PERFORM set_config')+body.replace(/^begin;\n|^commit;$/gm,''));
     assert.equal(denied.code,'P0001');assert.equal(denied.message,'configuration required');
    }
    assert.equal(h.sql(`SELECT count(*) FROM cron.job WHERE jobname=${q('vexa-'+name+'-chunk')}`),'0');
   });
   await t.test(name+': schedules independently, rotates Vault, leaves no secret in SQL',()=>{
    h.sql(settings({bootstrap_approved:'yes',endpoint,secret})+body);
    const first=h.json(`SELECT jsonb_build_object('id',jobid,'schedule',schedule,'command',command,'active',active) FROM cron.job WHERE jobname=${q('vexa-'+name+'-chunk')}`);
    assert.equal(first.schedule,'30 seconds');assert.equal(first.active,true);
    assert.ok(first.command.includes(endpoint));assert.ok(first.command.includes('55000'));
    assert.ok(first.command.includes("'Authorization','Bearer '"));assert.ok(!first.command.includes(secret));
    assert.equal(h.sql(`SELECT (decrypted_secret=${q(secret)})::text FROM vault.decrypted_secrets WHERE name=${q('vexa_'+name+'_trigger')}`),'true');
    h.sql(settings({bootstrap_approved:'yes',endpoint,secret:secret+'-rotated'})+body);
    assert.equal(h.sql(`SELECT count(*) FROM cron.job WHERE jobname=${q('vexa-'+name+'-chunk')}`),'1');
    assert.equal(h.sql(`SELECT jobid FROM cron.job WHERE jobname=${q('vexa-'+name+'-chunk')}`),String(first.id));
    assert.equal(h.sql(`SELECT (decrypted_secret=${q(secret+'-rotated')})::text FROM vault.decrypted_secrets WHERE name=${q('vexa_'+name+'_trigger')}`),'true');
   });
  }
  await t.test('revoking history preserves problems and does not grant remote approval',()=>{
   const body=fs.readFileSync(path.join(root,'supabase/operations/history-cron.sql'),'utf8');
   h.sql("SELECT set_config('vexa.history_bootstrap_approved','yes',false),set_config('vexa.history_revoke','yes',false);"+body);
   assert.equal(h.sql("SELECT count(*) FROM cron.job WHERE jobname='vexa-history-chunk'"),'0');
   assert.equal(h.sql("SELECT count(*) FROM cron.job WHERE jobname='vexa-problems-chunk'"),'1');
   assert.equal(h.sql('SHOW cron.launch_active_jobs'),'off');
   assert.equal(h.sql('SELECT count(*) FROM cron.job_run_details'),'0');
   assert.equal(h.sql('SELECT count(*) FROM net.http_request_queue'),'0');
  });
 }finally{h.close();}
});
