import json,uuid,sys
from types import SimpleNamespace
records=[]
def sql(s,check=True):
 print(json.dumps({'sql':s}),flush=True)
 response=json.loads(sys.stdin.readline());p=SimpleNamespace(**response)
 if check and p.returncode:raise RuntimeError(p.stderr+p.stdout)
 return p.stdout.strip() if check else p
q=lambda x:"'"+str(x).replace("'","''")+"'"
j=lambda x:q(json.dumps(x))+'::jsonb'
def scope(u,t,action):return f"select set_config('request.jwt.claim.sub',{q(u)},true) as ignored \\gset\nselect set_config('vexa.tenant_id',{q(t)},true) as ignored \\gset\nselect set_config('vexa.action',{q(action)},true) as ignored \\gset\nset local role vexa_backend;"
def scoped(u,t,action,s):return sql('begin;'+scope(u,t,action)+s+';commit;')
def service(s):return sql('begin;set local role vexa_email_service;'+s+';commit;')
def fixture():
 ids={k:str(uuid.uuid4()) for k in ['t','producer','issuer','worker','recipient','event']};t=ids['t'];u=ids['recipient'];ids['email']='syn-'+u+'@example.test'
 sql('insert into auth.users(id,email,email_confirmed_at) values'+','.join(f"({q(ids[k])},{q(ids['email'] if k=='recipient' else 'syn-'+ids[k]+'@example.test')},now())" for k in ['producer','issuer','worker','recipient'])+';'+f"insert into organizations(id,name) values({q(t)},'SYN email419');insert into memberships(tenant_id,user_id,role,status) values"+','.join(f"({q(t)},{q(ids[k])},{q(role)},'active')" for k,role in [('producer','owner'),('issuer','owner'),('worker','analyst'),('recipient','viewer')])+f";insert into worker_delegations(tenant_id,user_id,enabled) values({q(t)},{q(ids['worker'])},true);")
 scoped(ids['issuer'],t,'configure',f"select notification_policy_set({j(dict(channel='email',enabled=True,expectedVersion=0,intervalMs=1000,digestWindowMs=0,maxAttempts=5,lifetimeMs=86400000))})")
 scoped(u,t,'notify',f"insert into notification_preferences(tenant_id,user_id,channel,event_type,enabled,version) values({q(t)},{q(u)},'email','*',true,1),({q(t)},{q(u)},'email','membership.welcome',true,1)")
 return next_job(ids)
def next_job(ids):
 ids=dict(ids);ids['event']=str(uuid.uuid4());t=ids['t'];u=ids['recipient'];sql(f"update notification_dispatch_limits set next_allowed_at='-infinity' where tenant_id={q(t)};update jobs set state='succeeded',lease_until=null where tenant_id={q(t)} and state='running'")
 jid=json.loads(scoped(ids['producer'],t,'import',f"select to_jsonb(notification_enqueue({j(dict(eventId=ids['event'],type='membership.welcome',resourceId=u,userId=u,channel='email'))}))"));ids['job']=jid
 cl=json.loads(scoped(ids['worker'],t,'import','select notification_claim(300000)'));ids['key']=cl['idempotency_key']
 begun=json.loads(scoped(ids['worker'],t,'import',f"select notification_begin_send({q(jid)},{q(cl['fencing_token'])}::bigint,true)"));assert begun['kind']=='ready',begun
 return ids

def prepare(f):return json.loads(service(f"select coalesce(notification_email_prepare({q(f['key'])},{q(f['t'])},{q(f['recipient'])},'resend'),'null'::jsonb)"))
def record(name,fn):
 try:fn();entry={'name':name,'status':'PASS'}
 except Exception as e:entry={'name':name,'status':'FAIL','error':str(e)}
 records.append(entry);print(json.dumps({'record':entry}),flush=True)
def revocation(kind):
 f=fixture();t=f['t'];u=f['recipient'];
 if kind in ['producer','recipient','issuer','worker']:sql(f"update memberships set status='revoked' where tenant_id={q(t)} and user_id={q(f[kind])}")
 elif kind=='policy':sql(f"update notification_delivery_policies set enabled=false where tenant_id={q(t)}")
 elif kind=='preference':scoped(u,t,'notify',f"update notification_preferences set enabled=false,version=version+1 where channel='email' and event_type='*'")
 elif kind=='resource':sql(f"insert into notification_events(tenant_id,id,type,resource_id) values({q(t)},gen_random_uuid(),'membership.welcome',{q(f['issuer'])});update notification_outbox_items set event_id=(select id from notification_events where tenant_id={q(t)} and resource_id={q(f['issuer'])}) where tenant_id={q(t)}")
 elif kind in ['ban_producer','ban_issuer','ban_worker']:sql(f"update auth.users set banned_until=now()+interval '1 hour' where id={q(f[kind[4:]])}")
 elif kind=='ban':sql(f"update auth.users set banned_until=now()+interval '1 hour' where id={q(u)}")
 elif kind=='deadline':sql(f"update jobs set deadline=now()-interval '1 second' where id={q(f['job'])}")
 elif kind=='lease':sql(f"update jobs set lease_until=now()-interval '1 second' where id={q(f['job'])}")
 result=prepare(f);count=sql(f"select count(*) from notification_email_messages where idempotency_key={q(f['key'])}")
 assert result is None and count=='0',{'result':result,'messages':count,'failure':'new send still admitted after '+kind}

for kind in ['producer','recipient','issuer','worker','policy','preference','resource','ban','ban_producer','ban_issuer','ban_worker','deadline','lease']:record('post_begin_'+kind,lambda kind=kind:revocation(kind))
def normal():
 f=fixture();r=prepare(f);assert r['email']==f['email'];assert r['providerId'] is None
record('normal_real_begin_prepare',normal)
def accepted(f,pid):
 assert prepare(f) is not None
 service(f"select notification_email_accepted({q(f['key'])},'resend',{q(pid)})")
def receipt(pid,kind,bounce=None,eid=None):
 eid=eid or 'SYN_'+uuid.uuid4().hex
 service(f"select notification_email_receipt({q(eid)},{q(pid)},{q(kind)},'2026-09-01'::timestamptz,{'%s' % q('a'*64)},{'null' if bounce is None else q(bounce)})")
 return eid
def suppression(kind,bounce=None,expected=True,orphan=False):
 f=fixture();pid='SYN_'+uuid.uuid4().hex;new_email='syn-new-'+f['recipient']+'@example.test'
 if orphan:receipt(pid,kind,bounce)
 accepted(f,pid)
 if not orphan:receipt(pid,kind,bounce)
 before=sql(f"select delivery from notification_email_messages where idempotency_key={q(f['key'])}")
 nxt=next_job(f);result=prepare(nxt)
 assert (result is None)==expected,{'kind':kind,'bounce':bounce,'result':result}
 if expected:
  assert sql(f"select count(*) from notification_email_suppressions where tenant_id={q(f['t'])}")=='1'
  assert sql(f"select count(*) from notification_email_messages where idempotency_key={q(nxt['key'])}")=='0'
  receipt(pid,'email.delivered')
  assert prepare(nxt) is None,'later delivered cleared suppression'
  scoped(f['recipient'],f['t'],'notify',f"update notification_preferences set enabled=true,version=version+1 where channel='email'")
  assert prepare(nxt) is None,'preference opt-in cleared suppression'
  sql(f"update auth.users set email={q(new_email)},email_confirmed_at=null where id={q(f['recipient'])}")
  assert prepare(nxt) is None,'unconfirmed new address authorized'
  sql(f"update auth.users set email_confirmed_at=now() where id={q(f['recipient'])}")
  fresh=prepare(nxt);assert fresh['email']==new_email
  # An old orphan/receipt still binds to the immutable mailbox sent earlier.
  receipt(pid,'email.complained')
  assert prepare(nxt)['email']==new_email
  assert sql(f"select delivery from notification_email_messages where idempotency_key={q(f['key'])}") in ['complained','bounced','suppressed']
for kind,bounce,expected in [('email.complained',None,True),('email.suppressed',None,True),('email.bounced','Permanent',True),('email.bounced','Transient',False),('email.bounced','Undetermined',False),('email.bounced',None,False),('email.delivery_delayed',None,False)]:
 record('suppression_'+kind+'_'+str(bounce),lambda kind=kind,bounce=bounce,expected=expected:suppression(kind,bounce,expected))
record('orphan_complaint_mapping_late',lambda:suppression('email.complained',None,True,True))
def no_direct_access():
 for role in ['anon','authenticated','service_role','vexa_backend','vexa_email_service']:
  for stmt in ["select * from notification_email_suppressions","delete from notification_email_suppressions","select notification_email_items_current(null,null,null)"]:
   p=sql('set role '+role+';'+stmt,check=False);assert p.returncode!=0 and 'permission denied' in p.stderr,role+stmt+p.stdout+p.stderr
record('suppression_table_and_private_helper_acl',no_direct_access)
def context():
 f=fixture();before=str(uuid.uuid4());who=str(uuid.uuid4())
 # Service starts with unrelated tenant/subject/action; helper must restore all three.
 answer=sql(f"begin;select set_config('vexa.tenant_id',{q(before)},true) as x \\gset\nselect set_config('request.jwt.claim.sub',{q(who)},true) as x \\gset\nselect set_config('vexa.action','configure',true) as x \\gset\nset local role vexa_email_service;select notification_email_prepare({q(f['key'])},{q(f['t'])},{q(f['recipient'])},'resend') is not null;select current_setting('vexa.tenant_id')={q(before)} and current_setting('request.jwt.claim.sub')={q(who)} and current_setting('vexa.action')='configure';rollback;")
 assert answer=='t\nt',answer
record('prepare_restores_caller_context',context)
sys.exit(0 if len(records)==24 and all(x['status']=='PASS' for x in records) else 1)
