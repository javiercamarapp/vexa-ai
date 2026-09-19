import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {launch} from './services.mjs';
import {command} from './harness.mjs';
export async function routes(h,candidate){
 // Start fresh identity services. Existing Auth product code is never replaced.
 const s=await launch({services:true});let proxy;
 try{
  for(const f of fs.readdirSync(path.join(candidate,'supabase/migrations')).filter(f=>/^\d.*\.sql$/.test(f)).sort())s.sql(fs.readFileSync(path.join(candidate,'supabase/migrations',f),'utf8'));
  const actors=[];for(const role of ['owner','analyst','operator','viewer'])actors.push({...await s.user(),role});
  const tenant=randomUUID(),foreign=randomUUID(),customer=randomUUID(),problem=randomUUID(),connection=randomUUID(),conversation=randomUUID();
  s.sql(`INSERT INTO organizations(id,name) VALUES ('${tenant}','SYN_AUTHORIZED'),('${foreign}','ONLY_B_${foreign}'); ${actors.map(a=>`INSERT INTO memberships(tenant_id,user_id,role,status,permissions_version) VALUES ('${tenant}','${a.id}','${a.role}','active',1);`).join('')}`);
  // Minimal F01-03 record fixtures; no assignment, finance or inference fixtures.
  s.sql(`INSERT INTO customers(id,tenant_id,external_id) VALUES ('${customer}','${tenant}','SYN_F01_04'); INSERT INTO problems(id,tenant_id,severity,cause_status) VALUES ('${problem}','${tenant}','low','unknown');`);
  s.sql(`INSERT INTO connections(id,tenant_id,source,account_id,status) VALUES ('${connection}','${tenant}','hubspot','SYN_F01_04','active'); INSERT INTO conversations(id,tenant_id,source,entity_type,external_id,source_revision,connection_id,customer_id) VALUES ('${conversation}','${tenant}','hubspot','conversation','SYN_F01_04','1','${connection}','${customer}'); INSERT INTO problem_conversations(id,tenant_id,problem_id,conversation_id) VALUES ('${randomUUID()}','${tenant}','${problem}','${conversation}');`);
  const verifiedIdentityRequests=Object.fromEntries(actors.map(a=>[a.role,0]));
  for(const a of actors)assert.equal(s.sql(`SELECT role FROM memberships WHERE tenant_id='${tenant}' AND user_id='${a.id}' AND status='active'`),a.role,'REAL_MEMBERSHIP_ROLE');
  proxy=http.createServer((req,res)=>{
   const prefix=req.url.startsWith('/auth/v1/')?'/auth/v1':req.url.startsWith('/rest/v1/')?'/rest/v1':null;
   if(!prefix){res.writeHead(404).end();return;}
   if(req.url==='/auth/v1/user')for(const a of actors)if(req.headers.authorization==='Bearer '+a.token)verifiedIdentityRequests[a.role]++;
   const upstream=http.request({hostname:'127.0.0.1',port:prefix==='/auth/v1'?57561:57563,path:req.url.slice(prefix.length),method:req.method,headers:{...req.headers,connection:'close'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>res.writeHead(503).end());req.pipe(upstream);
  });await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(57564,'127.0.0.1',resolve);});
  const previous=h.child;previous.kill('SIGTERM');await new Promise(resolve=>previous.exitCode===null?previous.once('exit',resolve):resolve());await new Promise(r=>setTimeout(r,1000));
  await h.start({NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:57564',NEXT_PUBLIC_SUPABASE_ANON_KEY:s.anon,NEXT_PUBLIC_SITE_URL:'http://localhost:57560'});
  await new Promise(r=>setTimeout(r,1500));assert.equal(h.child.exitCode,null,'SETUP restarted Next alive');
  // Token came from the real disposable Auth service, never a forged JWT.
  const sessions=actors.map(a=>({role:a.role,cookies:[{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(a.session)).toString('base64url')},{name:'vexa_active_org',value:tenant}]}));
  // Action API is optional for F01. Only test existing action routes, never require F06.
  const actionFile=path.join(candidate,'apps/web/src/app/api/interventions/[id]/transition/route.ts');
  const actionPresent=fs.existsSync(actionFile)&&/\bPOST\b/.test(fs.readFileSync(actionFile,'utf8'));
  const file=path.join(h.tmp,'fixture.json');fs.writeFileSync(file,JSON.stringify({tenant,foreign,problem,customer,dependencyUnavailable:true,sessions,actionPresent}),{mode:0o600});
  assert.equal(fs.statSync(file).mode&0o777,0o600,'FIXTURE_MODE_0600');
  command('docker',['cp',file,h.container+':/tmp/fixture.json']);
  // Keep 0600; transfer ownership only inside our disposable container.
  command('docker',['exec','--user','root',h.container,'chown','node:node','/tmp/fixture.json']);
  command('docker',['exec',h.container,'test','-r','/tmp/fixture.json']);
  assert.equal(command('docker',['exec',h.container,'stat','-c','%a %U','/tmp/fixture.json']).trim(),'600 node','FIXTURE_PRIVATE_NODE');
  console.log('FIXTURE_PRIVATE_NODE mode=600 owner=node readable=true');
  // Async child is essential: the local HTTP proxy must keep serving requests.
  const {spawn}=await import('node:child_process');
  const result=await new Promise((resolve,reject)=>{let output='';const p=spawn('docker',['exec',h.container,'node','/tmp/browser.cjs','routes']);p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);p.on('error',reject);p.on('close',code=>resolve({code,output}));});
  fs.writeFileSync(path.join(h.tmp,'routes.log'),result.output);assert.equal(result.code,0,result.output);for(const [role,count] of Object.entries(verifiedIdentityRequests)){assert.ok(count>0,'REAL_IDENTITY_VERIFIED:'+role);console.log('REAL_IDENTITY_VERIFIED role='+role+' requests='+count);}h.screenshots();
 }finally{fs.rmSync(path.join(h.tmp,'fixture.json'),{force:true});command('docker',['exec','--user','root',h.container,'rm','-f','/tmp/fixture.json']);if(proxy)await new Promise(r=>proxy.close(r));s.close();}
}
