import json,uuid,time,sys
from types import SimpleNamespace
records=[]
def sql(s,check=True):
 print(json.dumps({'sql':s}),flush=True)
 p=SimpleNamespace(**json.loads(sys.stdin.readline()))
 if check and p.returncode:raise RuntimeError(p.stderr+p.stdout)
 return p.stdout.strip() if check else p
def checked_rpc(u,t,action,expression):
 print(json.dumps({'rpc':{'user':u,'tenant':t,'action':action,'expression':expression}}),flush=True)
 result=json.loads(sys.stdin.readline())
 if result.get('code')!='00000':raise RuntimeError(('insufficient_privilege ' if result.get('code')=='42501' else 'SQL_ERROR ')+json.dumps(result))
 return result['rows']
q=lambda x:"'"+str(x).replace("'","''")+"'"
j=lambda x:q(json.dumps(x))+'::jsonb'
def scope(u,t,action):return f"select set_config('request.jwt.claim.sub',{q(u)},true) as ignored \\gset\nselect set_config('vexa.tenant_id',{q(t)},true) as ignored \\gset\nselect set_config('vexa.action',{q(action)},true) as ignored \\gset\nset local role vexa_backend;"
def scoped(u,t,action,s):return sql('begin;'+scope(u,t,action)+s+';commit;')
def service(s):return sql('begin;set local role vexa_email_service;'+s+';commit;')
def fixture():
 ids={k:str(uuid.uuid4()) for k in ['t','producer','issuer','worker','recipient','event']};t=ids['t'];u=ids['recipient'];ids['push']='syn-'+u+'@example.test'
 sql('insert into auth.users(id,email,email_confirmed_at) values'+','.join(f"({q(ids[k])},{q(ids['push'] if k=='recipient' else 'syn-'+ids[k]+'@example.test')},now())" for k in ['producer','issuer','worker','recipient'])+';'+f"insert into organizations(id,name) values({q(t)},'SYN push422');insert into memberships(tenant_id,user_id,role,status) values"+','.join(f"({q(t)},{q(ids[k])},{q(role)},'active')" for k,role in [('producer','owner'),('issuer','owner'),('worker','analyst'),('recipient','viewer')])+f";insert into worker_delegations(tenant_id,user_id,enabled) values({q(t)},{q(ids['worker'])},true);")
 scoped(ids['issuer'],t,'configure',f"select notification_policy_set({j(dict(channel='push',enabled=True,expectedVersion=0,intervalMs=1000,digestWindowMs=0,maxAttempts=5,lifetimeMs=86400000))})")
 scoped(u,t,'notify',f"insert into notification_preferences(tenant_id,user_id,channel,event_type,enabled,version) values({q(t)},{q(u)},'push','*',true,1),({q(t)},{q(u)},'push','membership.welcome',true,1)")
 ids['session']=str(uuid.uuid4());ids['device']=str(uuid.uuid4());sql(f"insert into auth.sessions(id,user_id,not_after) values({q(ids['session'])},{q(u)},now()+interval '1 hour')");scoped(u,t,'notify',f"select push_own({j(dict(op='register',consent=True,deviceId=ids['device'],sessionId=ids['session'],expiresAt=int(time.time())+1800,endpoint='https://fcm.googleapis.com/SYN-'+ids['device'],p256dh='B'+'a'*86,auth='a'*22))})");ids['subscription']=sql(f"select id from push_subscriptions where tenant_id={q(t)} and user_id={q(u)}");return next_job(ids)
def next_job(ids):
 ids=dict(ids);ids['event']=str(uuid.uuid4());t=ids['t'];u=ids['recipient'];sql(f"update notification_dispatch_limits set next_allowed_at='-infinity' where tenant_id={q(t)};update jobs set state='succeeded',lease_until=null where tenant_id={q(t)} and state='running'")
 jid=json.loads(scoped(ids['producer'],t,'import',f"select to_jsonb(notification_enqueue({j(dict(eventId=ids['event'],type='membership.welcome',resourceId=u,userId=u,channel='push'))}))"));ids['job']=jid
 cl=json.loads(scoped(ids['worker'],t,'import','select notification_claim(300000)'));ids['key']=cl['idempotency_key']
 begun=json.loads(scoped(ids['worker'],t,'import',f"select notification_begin_send({q(jid)},{q(cl['fencing_token'])}::bigint,true)"));assert begun['kind']=='ready',begun
 return ids

def prepare(f):return checked_rpc(f['worker'],f['t'],'import',f"push_worker({j(dict(op='begin',tenantId=f['t'],userId=f['recipient'],key=f['key'],subscriptionId=f['subscription']))})")
def record(name,fn):
 try:fn();entry={'name':name,'status':'PASS'}
 except Exception as e:entry={'name':name,'status':'FAIL','error':str(e)}
 records.append(entry);print(json.dumps({'record':entry}),flush=True)
def revocation(kind):
 f=fixture();t=f['t'];u=f['recipient']
 if kind in ['producer','recipient','issuer','worker']:sql(f"update memberships set status='revoked' where tenant_id={q(t)} and user_id={q(f[kind])}")
 elif kind=='policy':sql(f"update notification_delivery_policies set enabled=false where tenant_id={q(t)}")
 elif kind=='delegation':sql(f"update worker_delegations set enabled=false where tenant_id={q(t)}")
 elif kind=='preference':scoped(u,t,'notify',"update notification_preferences set enabled=false,version=version+1 where channel='push' and event_type='*'")
 elif kind=='resource':sql(f"insert into notification_events(tenant_id,id,type,resource_id) values({q(t)},gen_random_uuid(),'membership.welcome',{q(f['issuer'])});update notification_outbox_items set event_id=(select id from notification_events where tenant_id={q(t)} and resource_id={q(f['issuer'])}) where tenant_id={q(t)}")
 elif kind in ['ban_producer','ban_issuer','ban_worker','ban_recipient']:sql(f"update auth.users set banned_until=now()+interval '1 hour' where id={q(f[kind[4:]])}")
 elif kind=='deadline':sql(f"update jobs set deadline=now()-interval '1 second' where id={q(f['job'])}")
 elif kind=='lease':sql(f"update jobs set lease_until=now()-interval '1 second' where id={q(f['job'])}")
 elif kind=='logout':sql(f"delete from auth.sessions where id={q(f['session'])}")
 elif kind=='session_expired':sql(f"update auth.sessions set not_after=now()-interval '1 second' where id={q(f['session'])}")
 try:r=prepare(f)
 except RuntimeError as e:
  if 'insufficient_privilege' in str(e):r={'kind':'denied'}
  else:raise
 count=sql(f"select count(*) from push_attempts where idempotency_key={q(f['key'])}")
 assert r.get('kind')!='ready' and count=='0',{'result':r,'attempts':count,'failure':'new push still admitted after '+kind}

for kind in ['producer','recipient','issuer','worker','policy','delegation','preference','resource','ban_recipient','ban_producer','ban_issuer','ban_worker','deadline','lease','logout','session_expired']:record('post_begin_'+kind,lambda kind=kind:revocation(kind))
def normal():
 f=fixture();r=prepare(f);assert r['kind']=='ready';assert r['subscription']['endpoint'].startswith('https://fcm.googleapis.com/')
record('normal_real_begin_prepare',normal)
def own_expired():
 f=fixture();sql(f"update auth.sessions set not_after=now()-interval '1 second' where id={q(f['session'])}")
 try:checked_rpc(f['recipient'],f['t'],'read',f"push_own({j(dict(op='list',sessionId=f['session']))})")
 except RuntimeError as e:
  assert 'insufficient_privilege' in str(e);return
 raise AssertionError('expired Auth session can still list own push devices')
record('own_expired_session_list',own_expired)
def own_banned():
 f=fixture();sql(f"update auth.users set banned_until=now()+interval '1 hour' where id={q(f['recipient'])}")
 try:checked_rpc(f['recipient'],f['t'],'read',f"push_own({j(dict(op='list',sessionId=f['session']))})")
 except RuntimeError as e:
  assert 'insufficient_privilege' in str(e);return
 raise AssertionError('banned account can still list own push devices')
record('own_banned_account_list',own_banned)
def logout_finish():
 f=fixture();r=prepare(f);assert r['kind']=='ready';sql(f"delete from auth.sessions where id={q(f['session'])}")
 result=json.loads(scoped(f['worker'],f['t'],'import',f"select push_worker({j(dict(op='finish',kind='accepted',attempt=r['attempt'],tenantId=f['t'],userId=f['recipient'],key=f['key'],subscriptionId=f['subscription']))})"));assert result['kind']=='accepted'
 assert sql(f"select state from push_attempts where idempotency_key={q(f['key'])}")=='accepted'
 assert sql(f"select status||':'||(session_id is null)::text from push_subscriptions where id={q(f['subscription'])}")=='revoked:true'
 assert prepare(f)['kind']=='accepted'
record('logout_preserves_and_finishes_history_without_resend',logout_finish)
def rotated_410():
 f=fixture();begun=prepare(f);assert begun['kind']=='ready'
 scoped(f['recipient'],f['t'],'notify',f"select push_own({j(dict(op='register',consent=True,deviceId=f['device'],sessionId=f['session'],expiresAt=int(time.time())+1800,endpoint='https://fcm.googleapis.com/SYN-rotated-'+f['device'],p256dh='B'+'a'*86,auth='a'*22))})")
 result=json.loads(scoped(f['worker'],f['t'],'import',f"select push_worker({j(dict(op='finish',kind='permanent',revoke=True,attempt=begun['attempt'],tenantId=f['t'],userId=f['recipient'],key=f['key'],subscriptionId=f['subscription']))})"));assert result['kind']=='permanent'
 row=sql(f"select status||':'||version::text from push_subscriptions where id={q(f['subscription'])}")
 assert row=='active:2',{'actual':row,'expected':'active:2','oracle':'410 from old registration must not revoke new registration'}
 assert sql(f"select state from push_attempts where idempotency_key={q(f['key'])}")=='permanent'
record('old_410_does_not_revoke_rotated_registration',rotated_410)

sys.exit(0 if len(records)==21 and all(x['status']=='PASS' for x in records) else 1)
