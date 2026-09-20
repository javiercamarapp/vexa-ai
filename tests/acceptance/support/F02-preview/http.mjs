// Candidate handler + canonical createDatabase/identity + real Auth/Pg/Storage.
// SQL is used ONLY to seed fixtures and independently observe effects.
import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {csv,mapping} from './fixtures.mjs';import {coverage,status,queued,safeExport} from './oracles.mjs';
export async function httpExam(candidate){
 const directory=process.env.F02_PREVIEW_HARNESS;assert.ok(directory,'SETUP: use F02-preview/run.py; original harness ports forbidden');
 const {runtime,snapshot,hash,q}=await import(pathToFileURL(path.join(directory,'runtime.mjs')));
 const {productBinding}=await import(pathToFileURL(path.join(directory,'product-binding.mjs')));
 const h=await runtime(candidate);let handler,server;
 try{
  handler=await productBinding(candidate,h.ports);
  server=createServer(async(req,res)=>{try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const r=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}));
   res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
  }catch{res.writeHead(500);res.end('HANDLER_UNCAUGHT');}});
  const port=JSON.parse(process.env.F02_PREVIEW_PORTS)[3];server.listen(port,'127.0.0.1');await once(server,'listening');
  const request=async(actor,route,body,headers={})=>{
   const r=await fetch('http://127.0.0.1:'+port+'/api/imports'+route,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{...(actor?{Authorization:'Bearer '+actor.token,'x-vexa-organization':actor.tenant}:{}),'content-type':'application/json','idempotency-key':randomUUID(),Connection:'close',...headers},body:body===undefined?undefined:JSON.stringify(body)});
   const text=await r.text();let data;try{data=JSON.parse(text);}catch{}return {status:r.status,data,text,headers:r.headers};
  };
  const bytes=csv(),metadata={connection_id:h.A.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:hash(bytes)};
  status(await request(null,''),401,'AUTH_401');status(await request(h.A,''),200,'LIST_AUTH_POSITIVE');
  const reserved=status(await request(h.A,'',metadata),201,'RESERVE');const id='/'+reserved.import_id;
  const upload=new URL(reserved.upload_url,'http://127.0.0.1:'+JSON.parse(process.env.F02_PREVIEW_PORTS)[1]);
  assert.equal(upload.hostname,'127.0.0.1','LOCAL_UPLOAD_ONLY');assert.equal(upload.port,String(JSON.parse(process.env.F02_PREVIEW_PORTS)[1]),'OWN_STORAGE_PORT');
  const sent=await fetch(upload,{method:'PUT',headers:{'content-type':'text/csv'},body:bytes});assert.equal(sent.status,200,'STORAGE_UPLOAD');
  const initial=snapshot(h,reserved.import_id);assert.equal(initial.jobs.length,0);
  const p=status(await request(h.A,id+'/preview',{mapping}),200,'PREVIEW');coverage(p.preview??p,1);assert.deepEqual(snapshot(h,reserved.import_id),initial,'PREVIEW_NO_APPROVAL_OR_JOB');
  const v0=initial.imports[0].mapping_version;
  const saved=status(await request(h.A,id+'/mapping',{mapping,expected_version:v0}),200,'SAVE_MAPPING');assert.notEqual(saved.mapping_version,v0,'SERVER_VERSION');assert.ok(typeof saved.upload_token==='string'&&saved.upload_token!==reserved.upload_token,'NEW_BOUND_CAPABILITY');
  const stable=snapshot(h,reserved.import_id);assert.equal(stable.jobs.length,0,'MAPPING_NOT_QUEUED');assert.ok(JSON.stringify(stable.imports[0].provenance).includes(saved.mapping_version),'DURABLE_MAPPING_HISTORY');
  status(await request(h.A,id+'/mapping',{mapping:{...mapping,timezone:'America/New_York'},expected_version:v0}),409,'CAS_STALE');assert.deepEqual(snapshot(h,reserved.import_id),stable,'CAS_NO_MUTATION');
  status(await request(h.A,id+'/mapping',{mapping,expected_version:saved.mapping_version}),200,'MAPPING_IDEMPOTENT');
  for(const [suffix,body] of [['',undefined],['/preview',{mapping}],['/mapping',{mapping,expected_version:saved.mapping_version}],['/errors.csv',undefined]]){
   status(await request(h.B,id+suffix,body),404,'TENANT_RESOURCE_404');
   status(await request({...h.A,tenant:h.B.tenant},id+suffix,body),403,'TENANT_SELECTOR_FORGED');
  }
  status(await request(h.A,id+'/mapping',{mapping,expected_version:saved.mapping_version,tenant_id:h.B.tenant}),400,'TENANT_BODY_FORGED');
  for(const [suffix,body] of [['/preview',{mapping,tenant_id:h.B.tenant}],['/confirm',{mapping_version:saved.mapping_version,upload_token:saved.upload_token,sha256:metadata.sha256,tenant_id:h.B.tenant}]])status(await request(h.A,id+suffix,body),400,'UNKNOWN_BODY_FIELD');
  status(await request(h.A,id+'?tenant_id='+h.B.tenant),404,'UNKNOWN_DETAIL_QUERY');
  // Two users in same organization do not acquire each other's upload ownership.
  const peer=await h.user();peer.tenant=h.A.tenant;h.sql(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(peer.tenant)},${q(peer.id)},'analyst','active')`);
  status(await request(peer,id+'/mapping',{mapping,expected_version:saved.mapping_version}),404,'OTHER_OWNER_404');
  for(const role of ['viewer','operator']){
   h.sql(`UPDATE memberships SET role=${q(role)},permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`);
   status(await request(h.A,id+'/mapping',{mapping,expected_version:saved.mapping_version}),403,'ROLE_403_'+role);
   status(await request(h.A,id+'/preview',{mapping}),403,'ROLE_PREVIEW_403_'+role);
   status(await request(h.A,id+'/errors.csv'),200,'ROLE_EXPORT_READ_'+role);
  }
  h.sql(`UPDATE memberships SET role='analyst',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`);
  status(await request(h.A,id+'/preview',{mapping}),200,'ANALYST_POSITIVE');
  const exported=await request(h.A,id+'/errors.csv');status(exported,200,'ERROR_EXPORT');assert.match(exported.headers.get('cache-control'),/private/);assert.match(exported.headers.get('cache-control'),/no-store/);assert.match(exported.headers.get('content-disposition'),/attachment/);safeExport(exported.text,0);
  h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`);
  status(await request(h.A,id+'/errors.csv'),403,'REVOKED_EXPORT');status(await request(h.A,id+'/preview',{mapping}),403,'REVOKED_PREVIEW');
  h.sql(`UPDATE memberships SET status='active',role='owner',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`);
  // Recreate handler against the SAME durable database; full process restart belongs to Next exam.
  handler=await productBinding(candidate,h.ports);status(await request(h.A,id),200,'RECREATED_HANDLER');
  const confirmed=await request(h.A,id+'/confirm',{mapping_version:saved.mapping_version,upload_token:saved.upload_token,sha256:metadata.sha256});queued(status(confirmed,202,'CONFIRM_202'));
  const immutable=snapshot(h,reserved.import_id);assert.equal(immutable.jobs.length,1);assert.equal(immutable.outbox.length,1);
  status(await request(h.A,id+'/mapping',{mapping:{...mapping,timezone:'America/New_York'},expected_version:saved.mapping_version}),409,'QUEUED_MAPPING_IMMUTABLE');assert.deepEqual(snapshot(h,reserved.import_id),immutable,'QUEUED_SNAPSHOT_UNCHANGED');
  queued(status(await request(h.A,id+'/confirm',{mapping_version:saved.mapping_version,upload_token:saved.upload_token,sha256:metadata.sha256}),202,'CONFIRM_REPLAY'));assert.deepEqual(snapshot(h,reserved.import_id),immutable,'ONE_JOB_REPLAY');
  console.log('HTTP_PREVIEW_ASSERTIONS_FINISHED — not full gate acceptance');
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}h.close();}
}
