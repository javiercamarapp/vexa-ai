import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {setup,q} from '../F06-push/harness.mjs';
import {emailSecuritySql} from '../F06-email/security-sql.mjs';
import {emailPreSend} from '../F06-email/pre-send.mjs';
import {pushSqlSecurity} from '../F06-push/security-sql.mjs';
import {pushPreSend} from '../F06-push/pre-send.mjs';
import {pushLogoutSecurity} from '../F06-push/logout-security.mjs';
import {backend} from '../../tests/acceptance/support/F01-03/import-uploads/oracles.mjs';
import {sink} from '../F06-outbox/fixtures.mjs';

const json=value=>q(JSON.stringify(value))+'::jsonb';
const candidate=process.env.VEXA_CANDIDATE;

// All operations below use the real migration RPCs with their real SQL roles.
// The additional tenants/users are synthetic and belong to this isolated DB.
function fixture(h,channel){
  const f={tenant:randomUUID(),producer:h.A.id,issuer:randomUUID(),worker:randomUUID(),recipient:randomUUID(),channel};
  f.email='SYN-f07-'+f.recipient+'@example.test';
  h.sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ${['issuer','worker','recipient'].map(key=>`(${q(f[key])},${q(key==='recipient'?f.email:'SYN-f07-'+f[key]+'@example.test')},now())`).join(',')};
    INSERT INTO organizations(id,name) VALUES(${q(f.tenant)},'SYN-F07 notification authorization');
    INSERT INTO memberships(tenant_id,user_id,role,status) VALUES ${[['producer','owner'],['issuer','owner'],['worker','analyst'],['recipient','viewer']].map(([key,role])=>`(${q(f.tenant)},${q(f[key])},${q(role)},'active')`).join(',')};
    INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(f.tenant)},${q(f.worker)},true);`);
  scoped(h,f.issuer,f.tenant,'configure',`notification_policy_set(${json({channel,enabled:true,expectedVersion:0,intervalMs:1000,digestWindowMs:0,maxAttempts:5,lifetimeMs:86400000})})`);
  h.sql(`BEGIN;${scope(f.recipient,f.tenant,'notify')}
    INSERT INTO notification_preferences(tenant_id,user_id,channel,event_type,enabled,version) VALUES
      (${q(f.tenant)},${q(f.recipient)},${q(channel)},'*',true,1),
      (${q(f.tenant)},${q(f.recipient)},${q(channel)},'membership.welcome',true,1);COMMIT;`);
  return f;
}
function scope(user,tenant,action){
  return `SELECT set_config('request.jwt.claim.sub',${q(user)},true) AS ignored \\gset
SELECT set_config('vexa.tenant_id',${q(tenant)},true) AS ignored \\gset
SELECT set_config('vexa.action',${q(action)},true) AS ignored \\gset
SET LOCAL ROLE vexa_backend;`;
}
function scoped(h,user,tenant,action,expression){
  return h.json(`BEGIN;${scope(user,tenant,action)} SELECT ${expression};COMMIT;`);
}
function enqueue(h,f){
  const event=randomUUID();
  const id=scoped(h,f.producer,f.tenant,'import',`to_jsonb(notification_enqueue(${json({eventId:event,type:'membership.welcome',resourceId:f.recipient,userId:f.recipient,channel:f.channel})}))`);
  return {id,event};
}
function begin(h,f,queued=enqueue(h,f)){
  const {id,event}=queued;
  const claim=scoped(h,f.worker,f.tenant,'import','notification_claim(300000)');
  assert.equal(claim?.id,id,'ACTUAL_QUEUED_JOB_CLAIMED');
  const ready=scoped(h,f.worker,f.tenant,'import',`notification_begin_send(${q(id)},${q(claim.fencing_token)}::bigint,true)`);
  assert.equal(ready.kind,'ready','ACTUAL_SEND_AUTHORIZED_BEFORE_REVOCATION');
  return {...claim,event};
}

test('SEC notifications: real SQL admission, current publication authority and Auth logout',{timeout:780000},async t=>{
  assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
  const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'rovaq-f07-notifications-'));fs.chmodSync(evidence,0o700);
  console.log('F07_NOTIFICATION_EVIDENCE:'+evidence);
  let h;
  try{
    h=await setup(candidate,evidence);
    let emailFixture;
    await t.test('email security fixture is prepared through enqueue claim begin and service RPC, without asserting delivery',()=>{
      const f=fixture(h,'email'),claim=begin(h,f);
      const prepared=h.json(`BEGIN;SET LOCAL ROLE vexa_email_service;
        SELECT notification_email_prepare(${q(claim.idempotency_key)},${q(f.tenant)},${q(f.recipient)},'resend');COMMIT;`);
      assert.equal(prepared?.email,f.email);assert.equal(prepared.providerId,null);
      const row=h.json(`SELECT to_jsonb(m) FROM notification_email_messages m WHERE idempotency_key=${q(claim.idempotency_key)}`);
      assert.equal(row.tenant_id,f.tenant);assert.equal(row.user_id,f.recipient);assert.equal(row.job_id,claim.id);
      assert.equal(row.acceptance,'unknown');assert.equal(row.delivery,'unknown');
      // The reused SQL suite needs a persisted own-tenant message, not SMTP bytes.
      emailFixture={...h,A:{...h.A,tenant:f.tenant}};
    });
    assert.ok(emailFixture,'EMAIL_SQL_FIXTURE_PREREQUISITE');
    await emailSecuritySql(t,emailFixture);
    await emailPreSend(t,h,evidence);
    await pushSqlSecurity(t,h);
    await pushPreSend(t,h,evidence);

    await t.test('in-app publication denies foreign selected scope and rechecks recipient after begin',()=>{
      const f=fixture(h,'inapp'),claim=begin(h,f);
      const finish=`notification_finish(${q(claim.id)},${q(claim.fencing_token)}::bigint,${json({kind:'accepted',providerId:'SYN_F07_INAPP'})})`;
      const state=()=>h.sql(`SELECT json_build_object('job',(SELECT row_to_json(j) FROM jobs j WHERE id=${q(claim.id)}),'outbox',(SELECT row_to_json(o) FROM notification_outbox o WHERE id=${q(claim.id)}),'inbox',(SELECT count(*) FROM notification_inbox WHERE tenant_id=${q(f.tenant)}))`);
      const before=state();
      const foreign=backend(h,`SELECT ${finish} INTO result;`,{id:f.worker},h.B.tenant,'import');
      assert.equal(foreign.code,'42501','FOREIGN_SCOPE_CANNOT_PUBLISH');assert.equal(state(),before);
      h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(f.tenant)} AND user_id=${q(f.recipient)}`);
      const denied=scoped(h,f.worker,f.tenant,'import',finish);
      assert.equal(denied.state,'suppressed','RECIPIENT_REVOKED_BEFORE_PUBLICATION');
      assert.equal(h.sql(`SELECT count(*) FROM notification_inbox WHERE tenant_id=${q(f.tenant)} AND event_id=${q(claim.event)}`),'0','REVOKED_RECIPIENT_ZERO_INBOX_EFFECT');
      h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(f.tenant)} AND user_id=${q(f.recipient)};
        UPDATE notification_dispatch_limits SET next_allowed_at='-infinity' WHERE tenant_id=${q(f.tenant)};`);
      const automatic=h.json(`SELECT json_build_object('id',i.job_id,'event',i.event_id) FROM notification_outbox_items i JOIN notification_events e ON e.tenant_id=i.tenant_id AND e.id=i.event_id JOIN jobs j ON j.tenant_id=i.tenant_id AND j.id=i.job_id WHERE i.tenant_id=${q(f.tenant)} AND i.user_id=${q(f.recipient)} AND i.channel='inapp' AND e.type='membership.welcome' AND i.event_id<>${q(claim.event)} AND j.state='queued'`);
      assert.ok(automatic?.id&&automatic.event,'REACTIVATION_AUTOMATIC_WELCOME_QUEUED');
      const restored=begin(h,f,automatic);
      assert.equal(scoped(h,f.worker,f.tenant,'import',`notification_finish(${q(restored.id)},${q(restored.fencing_token)}::bigint,${json({kind:'accepted',providerId:'SYN_F07_INAPP_RESTORED'})})`).state,'accepted');
      assert.equal(h.sql(`SELECT count(*) FROM notification_inbox WHERE tenant_id=${q(f.tenant)} AND event_id=${q(restored.event)} AND user_id=${q(f.recipient)}`),'1','CURRENT_RECIPIENT_POSITIVE_PUBLICATION');
      assert.equal(h.sql(`SELECT count(*) FROM notification_inbox WHERE tenant_id=${q(f.tenant)} AND event_id=${q(claim.event)}`),'0','OLD_SUPPRESSED_EVENT_NOT_REVIVED');
    });

    const {consumeNotification}=await import(pathToFileURL(path.join(h.built,'packages/notifications/worker.mjs')));
    for(const channel of ['email','push'])await t.test(channel+' real consumer blocks send after resolver revokes recipient, with separate positive fixture',async()=>{
      const receiver=await sink();
      try{
        for(const revoked of [true,false]){
          const f=fixture(h,channel),queued=enqueue(h,f);
          const repository=h.outbox({id:f.worker,tenant:f.tenant,role:'analyst'});
          const before=receiver.requests.length;let resolutions=0,sends=0;
          const transport={
            configured:()=>true,
            async resolveRecipient(identity){
              assert.deepEqual(identity,{tenantId:f.tenant,userId:f.recipient,channel});resolutions++;
              if(revoked)h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(f.tenant)} AND user_id=${q(f.recipient)}`);
              return {...identity,...(channel==='email'?{email:f.email,emailVerified:true}:{consent:true})};
            },
            async send(input){
              sends++;
              const response=await fetch(receiver.url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':input.idempotencyKey},body:JSON.stringify({recipient:input.recipient,message:input.message}),signal:input.signal,redirect:'error'});
              assert.equal(response.status,202,'SYN_LOOPBACK_ACCEPTED');return response.json();
            },
          };
          await consumeNotification({repository,transports:{[channel]:transport},timeoutMs:1000});
          const saved=await repository.get(queued.id);assert.equal(resolutions,1,'REAL_CONSUMER_RESOLVED_CLAIMED_RECIPIENT');
          assert.equal(saved.state,revoked?'suppressed':'accepted');
          assert.equal(sends,revoked?0:1,'CURRENT_AUTHORIZATION_GATES_TRANSPORT');
          assert.equal(receiver.requests.length-before,revoked?0:1,'REAL_LOOPBACK_EFFECT_COUNT');
          if(!revoked){const accepted=receiver.requests.at(-1);assert.equal(accepted.idempotencyKey,saved.idempotencyKey);assert.equal(accepted.body.recipient.tenantId,f.tenant);assert.equal(accepted.body.recipient.userId,f.recipient);}
          assert.equal(h.sql(`SELECT count(*) FROM notification_email_messages WHERE tenant_id=${q(f.tenant)}`),'0','SYN_TRANSPORT_NOT_REAL_EMAIL_PROVIDER');
          assert.equal(h.sql(`SELECT count(*) FROM push_attempts WHERE tenant_id=${q(f.tenant)}`),'0','SYN_TRANSPORT_NOT_REAL_PUSH_PROVIDER');
        }
        assert.deepEqual(receiver.violations,[],'SYN_LOOPBACK_PROTOCOL');
      }finally{await receiver.close();}
    });
    await pushLogoutSecurity(t,h);
    h.verifySources();
    const outbound=fs.readFileSync(path.join(evidence,'outbound-attempts.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
    assert.equal(outbound.some(row=>row.blocked),false,'NO_BLOCKED_EXTERNAL_FETCH_ATTEMPT');
    fs.writeFileSync(path.join(evidence,'scope.json'),JSON.stringify({scope:'real local SQL authorization, real consumeNotification and SQL outbox with SYN loopback transport, prepared email state, push pre-send admission and real Auth logout',reused:['emailSecuritySql','emailPreSend','pushSqlSecurity','pushPreSend','pushLogoutSecurity'],notProven:['SMTP/push provider transport or actual delivery','production or previously issued signed URLs'],accepted:false},null,2),{mode:0o600});
  }finally{
    if(h){try{h.verifySources();}finally{await h.close();}}
  }
  const cleanup=JSON.parse(fs.readFileSync(path.join(evidence,'cleanup.json'),'utf8'));
  assert.equal(cleanup.ownResourcesRemoved,true);assert.equal(cleanup.temporaryPathsRemoved,true);
  assert.ok(cleanup.resources.length>0&&cleanup.resources.every(resource=>resource.absent===true),'OWN_RESOURCE_CLEANUP');
});
