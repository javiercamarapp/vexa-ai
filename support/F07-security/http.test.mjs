import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {setup,q} from '../F06-push/harness.mjs';

// Control-only gate. Run explicitly with an immutable VEXA_CANDIDATE snapshot.
// F06-push provides isolated, real Next/Auth/Postgres and blocks outbound fetch.
const candidate=process.env.VEXA_CANDIDATE;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const machineRoutes=['worker','crm','extraction','history','problems','notifications'];
const bodyRoutes=[
  ['/api/imports',8192],['/api/imports/connections',8192],['/api/jobs/worker',8192],
  ['/api/connections/settings',32768],['/api/connections/:id/recheck',32768],
  ['/api/migrations',32768],['/api/migrations/aliases',32768],
  ['/api/economics',32768],['/api/economic-priorities',32768],['/api/economic-snapshots',16384],
  ['/api/briefs',32768],['/api/candidates',20000],['/api/explorer/query',16384],['/api/explorer/tools',16384],
  ['/api/extraction',8192],['/api/history',4096],['/api/interventions/:id',32768],
  ['/api/problems',32768],['/api/problems/:id/causality',32768],['/api/recommendations',32768],
  ['/api/workspace/mappings',32768],['/api/workspace/customer-bindings',16384],
  ['/api/team',16384],['/api/platform',4096],['/api/evaluation',16384],['/api/recovery',16384],
  ['/api/notifications/preferences',4096],['/api/notifications/delivery',4096],['/api/notifications/push',8192],
  ['/auth/email/request',1024],['/auth/email/session',16384],
];

function exportedMethods(source){
  const methods=[...source.matchAll(/export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(x=>x[1]);
  for(const group of source.matchAll(/export\s*\{([^}]+)\}/g))for(const binding of group[1].split(',')){
    const name=binding.trim().split(/\s+as\s+/).at(-1);
    if(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name))methods.push(name);
  }
  return [...new Set(methods)];
}

function inventory(root){
  const routes=[];
  for(const domain of ['api','auth']){
    const walk=dir=>{
      for(const item of fs.readdirSync(dir,{withFileTypes:true})){
        const file=path.join(dir,item.name);
        if(item.isDirectory())walk(file);
        else if(item.name==='route.ts'){
          const source=fs.readFileSync(file,'utf8');
          const route='/'+path.relative(path.join(root,'apps/web/src/app'),path.dirname(file)).split(path.sep).join('/');
          routes.push({route,file:path.relative(root,file),sha256:digest(source),
            exports:exportedMethods(source),
            importedModules:[...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(x=>x[1]),
            exercised:machineRoutes.some(name=>route==='/api/internal/'+name)||bodyRoutes.some(([r])=>r.replace(':id','[id]')===route)||['/api/health/version','/auth/callback','/auth/organization'].includes(route)});
        }
      }
    };
    walk(path.join(root,'apps/web/src/app',domain));
  }
  return routes.sort((a,b)=>a.route.localeCompare(b.route));
}

function privateResponse(response){
  assert.match(response.headers.get('cache-control')??'',/\bno-store\b/i,'PRIVATE_NO_STORE');
}
function securityHeaders(response){
  assert.equal(response.headers.get('x-content-type-options'),'nosniff','NO_SNIFF');
  assert.equal(response.headers.get('x-frame-options'),'DENY','FRAME_DENY');
  const csp=response.headers.get('content-security-policy')??'';
  for(const directive of ["base-uri 'self'","object-src 'none'","frame-ancestors 'none'"])
    assert.ok(csp.split(';').map(x=>x.trim()).includes(directive),'CSP_DIRECTIVE:'+directive);
}

// A real chunked TCP request, never a mocked Request stream. An unfinished body
// must receive an application response; client timeout/reset is a test failure.
function chunkedPost(base,route,{cookie,origin=base,chunk='{' ,end=false,timeoutMs=12000}={}){
  const url=new URL(route,base);
  assert.equal(url.hostname,'127.0.0.1','LOCAL_ONLY');
  return new Promise((resolve,reject)=>{
    const began=performance.now();let settled=false;
    const request=http.request(url,{method:'POST',agent:false,headers:{
      'content-type':'application/json','transfer-encoding':'chunked',origin,
      ...(cookie?{cookie}:{}),Connection:'close',
    }},response=>{
      const chunks=[];
      response.on('data',bytes=>chunks.push(bytes));
      response.on('error',finishError);
      response.on('end',()=>{
        if(settled)return;settled=true;clearTimeout(timer);
        resolve({status:response.statusCode,text:Buffer.concat(chunks).toString(),elapsedMs:performance.now()-began});
        request.destroy();
      });
    });
    function finishError(error){if(settled)return;settled=true;clearTimeout(timer);request.destroy();reject(error);}
    const timer=setTimeout(()=>finishError(Error('APPLICATION_DID_NOT_FINISH_BODY_REQUEST')),timeoutMs);
    request.on('error',finishError);request.flushHeaders();request.write(chunk);
    if(end)request.end();
  });
}

test('SEC HTTP: real local auth, bounded input, machine triggers, headers and cache isolation',{timeout:600000},async t=>{
  assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
  const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-sec-http-'));
  fs.chmodSync(evidence,0o700);console.log('F07_HTTP_EVIDENCE:'+evidence);
  const routes=inventory(candidate),supplemental={};
  for(const [route]of bodyRoutes)assert.ok(routes.find(r=>r.route===route.replace(':id','[id]'))?.exports.includes('POST'),'POST_ROUTE_REQUIRED:'+route);
  for(const name of machineRoutes){
    const exported=routes.find(r=>r.route==='/api/internal/'+name)?.exports??[];
    assert.ok(exported.includes('POST'),'MACHINE_POST_REQUIRED:'+name);
    assert.equal(exported.includes('GET'),name==='crm','MACHINE_GET_CONTRACT:'+name);
  }
  for(const file of ['apps/web/next.config.ts','package.json','package-lock.json'])supplemental[file]=digest(fs.readFileSync(path.join(candidate,file)));
  fs.writeFileSync(path.join(evidence,'http-source-inventory.json'),JSON.stringify({routes,supplemental},null,2),{mode:0o600});
  let h;
  t.after(async()=>{
    try{
      if(h)h.verifySources();
      for(const [file,hash]of Object.entries(supplemental))assert.equal(digest(fs.readFileSync(path.join(candidate,file))),hash,'SOURCE_CHANGED:'+file);
    }finally{if(h)await h.close();}
  });
  h=await setup(candidate,evidence);
  // Only synthetic local configuration. Email negatives below never invoke OTP.
  await h.stopWeb();await h.startWeb(false,{VEXA_EMAIL_AUTH_ENABLED:'true'});
  const receipt=[];
  const request=async(route,{actor=h.A,method='GET',body,origin=h.base,headers={}}={})=>{
    const response=await fetch(h.base+route,{method,redirect:'manual',signal:AbortSignal.timeout(15000),
      headers:{...(actor?{cookie:h.cookie(actor)}:{}),...(origin===null?{}:{origin}),
        ...(body===undefined?{}:{'content-type':'application/json'}),Connection:'close',...headers},
      ...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=null;}
    receipt.push({route,method,status:response.status});
    return {response,status:response.status,text,data};
  };
  t.after(()=>fs.writeFileSync(path.join(evidence,'http-observations.json'),JSON.stringify(receipt,null,2),{mode:0o600}));
  const routeFor=route=>route.replace(':id',h.A.connection);
  const mutationState=()=>h.sql(`SELECT json_build_object('imports',(SELECT count(*) FROM imports),'jobs',(SELECT count(*) FROM jobs),'connections',(SELECT count(*) FROM connections),'members',(SELECT count(*) FROM memberships))`);

  await t.test('security headers apply to HTML, public version and private authorization failures',async()=>{
    for(const route of ['/login','/api/health/version','/api/imports']){
      const result=await request(route,{actor:null});
      assert.equal(result.status,route==='/api/imports'?401:200,route);securityHeaders(result.response);
      if(route==='/api/imports')privateResponse(result.response);
    }
  });

  await t.test('each protected POST denies absent or foreign Origin before mutations',async()=>{
    const before=mutationState();
    for(const [template]of bodyRoutes)for(const origin of [null,'https://SYN-foreign.invalid']){
      const result=await request(routeFor(template),{method:'POST',body:{},origin});
      assert.equal(result.status,403,'CSRF:'+template);privateResponse(result.response);
    }
    assert.equal(mutationState(),before,'CSRF_NO_COUNT_CHANGE_OBSERVED_TABLES');
  });

  await t.test('route-specific byte ceilings reject declared oversized bodies',async()=>{
    const before=mutationState();
    for(const [template,limit]of bodyRoutes){
      const result=await request(routeFor(template),{method:'POST',body:' '.repeat(limit+1)});
      assert.equal(result.status,413,'HTTP_BODY_LIMIT:'+template);privateResponse(result.response);
    }
    const form=await request('/auth/organization',{method:'POST',body:'x'.repeat(4097),headers:{'content-type':'application/x-www-form-urlencoded'}});
    assert.equal(form.status,413,'FORM_BODY_LIMIT');
    assert.equal(mutationState(),before,'OVERSIZE_NO_COUNT_CHANGE_OBSERVED_TABLES');
  });

  await t.test('chunked oversized body stops before JSON/domain work and valid body still succeeds',async()=>{
    const before=mutationState();
    const oversized=await chunkedPost(h.base,'/api/imports/connections',{cookie:h.cookie(h.A),chunk:' '.repeat(8193)});
    assert.equal(oversized.status,413,'CHUNKED_LIMIT');
    assert.equal(mutationState(),before,'CHUNKED_NO_COUNT_CHANGE_OBSERVED_TABLES');
    const body={account_id:'SYN-HTTP-'+randomUUID()};
    const valid=await request('/api/imports/connections',{method:'POST',body});
    assert.equal(valid.status,201,'VALID_BODY_CREATED');assert.equal(valid.data.data.connection.account_id,body.account_id);
    const replay=await request('/api/imports/connections',{method:'POST',body});
    assert.equal(replay.status,200,'VALID_BODY_REPLAY');assert.equal(replay.data.data.connection.id,valid.data.data.connection.id);
  });

  await t.test('unfinished real HTTP input receives 408 near the five-second deadline',async()=>{
    const before=mutationState();
    const stalled=await chunkedPost(h.base,'/api/explorer/query',{cookie:h.cookie(h.A)});
    assert.equal(stalled.status,408,'BODY_STALL_APPLICATION_TIMEOUT');
    assert.ok(stalled.elapsedMs>=4500&&stalled.elapsedMs<10000,'BODY_DEADLINE_5S');
    assert.equal(mutationState(),before,'STALL_NO_COUNT_CHANGE_OBSERVED_TABLES');
  });

  await t.test('64 pending readers share admission; excess request gets 429 and slots recover',async()=>{
    const distinctBundles=['/api/explorer/query','/api/history','/api/briefs'];
    // Warm all route bundles before admitting unfinished input concurrently.
    for(const route of distinctBundles)assert.equal((await request(route,{method:'POST',body:'{'})).status,400,'BUNDLE_READY:'+route);
    const result=await Promise.all(Array.from({length:65},(_,i)=>chunkedPost(h.base,distinctBundles[i%distinctBundles.length],{cookie:h.cookie(h.A)})));
    assert.equal(result.filter(r=>r.status===429).length,1,'READER_65_REJECTED');
    assert.equal(result.filter(r=>r.status===408).length,64,'READERS_64_BOUNDED');
    for(const route of distinctBundles){
      const after=await request(route,{method:'POST',body:'{'});
      assert.equal(after.status,400,'READERS_RELEASED:'+route);
    }
  });

  await t.test('machine routes reject browser identity and incorrect secrets; valid empty trigger remains idle',async()=>{
    // No runtime may dispatch work: disable only these synthetic worker grants.
    h.sql(`UPDATE worker_delegations SET enabled=false WHERE user_id=${q(h.bot.id)}`);
    try{
      const before=mutationState();
      for(const name of machineRoutes){
        const route='/api/internal/'+name,methods=name==='crm'?['GET','POST']:['POST'];
        if(name!=='crm')assert.equal((await request(route,{actor:null})).status,405,'MACHINE_METHOD:'+name);
        for(const method of methods){
          for(const headers of [{},{authorization:'Bearer SYN-invalid'}]){
            const denied=await request(route,{method,headers});
            assert.equal(denied.status,401,'MACHINE_SECRET:'+name+':'+method);privateResponse(denied.response);
          }
          const good=await request(route,{actor:null,method,origin:null,headers:{authorization:'Bearer '+h.triggerSecret},...(method==='POST'?{body:'{}'}:{})});
          assert.equal(good.status,200,'MACHINE_IDLE:'+name+':'+method);assert.equal(good.data.code,'IDLE');privateResponse(good.response);
        }
        const bad=await request(route,{actor:null,method:'POST',origin:null,body:'{"tenant":"SYN"}',headers:{authorization:'Bearer '+h.triggerSecret}});
        assert.equal(bad.status,400,'MACHINE_BODY:'+name);
      }
      assert.equal(mutationState(),before,'MACHINE_NO_COUNT_CHANGE_OBSERVED_TABLES');
    }finally{h.sql(`UPDATE worker_delegations SET enabled=true WHERE user_id=${q(h.bot.id)}`);}
  });

  await t.test('redirects remain local and organization selector never authorizes another tenant',async()=>{
    const anonymous=await request('/overview?next=https://SYN-foreign.invalid/',{actor:null});
    assert.equal(anonymous.status,303);assert.equal(anonymous.response.headers.get('location'),h.base+'/login');
    for(const next of ['https://SYN-foreign.invalid/','//SYN-foreign.invalid/','%2f%2fSYN-foreign.invalid']){
      const cancelled=await request('/auth/callback?error=access_denied&next='+encodeURIComponent(next),{actor:null});
      assert.equal(cancelled.status,303);assert.equal(cancelled.response.headers.get('location'),h.base+'/login?error=oauth_cancelled');
    }
    const select=tenant=>request('/auth/organization',{method:'POST',body:new URLSearchParams({tenant_id:tenant}).toString(),headers:{'content-type':'application/x-www-form-urlencoded'}});
    assert.equal((await select(h.B.tenant)).status,403,'FOREIGN_SELECTOR_DENIED');
    const own=await select(h.A.tenant);assert.equal(own.status,303);assert.equal(own.response.headers.get('location'),h.base+'/');
    assert.ok((own.response.headers.get('set-cookie')??'').includes('vexa_active_org='+h.A.tenant),'OWN_SELECTION_COOKIE');
  });

  await t.test('owner to viewer to tenant B reuses the path without privileged or foreign cached data',async()=>{
    for(const [actor,canary]of [[h.A,'SYN-HTTP-ONLY-A'],[h.B,'SYN-HTTP-ONLY-B']]){
      actor.canary=canary;actor.jobId=randomUUID();const importId=randomUUID();
      h.sql(`UPDATE connections SET source='csv',account_id=${q(canary)} WHERE tenant_id=${q(actor.tenant)} AND id=${q(actor.connection)};
        INSERT INTO imports(id,tenant_id,connection_id,file_hash,mapping_version,state,idempotency_key) VALUES(${q(importId)},${q(actor.tenant)},${q(actor.connection)},${q(digest(canary))},'SYN-HTTP-v1','succeeded',${q(randomUUID())});
        INSERT INTO jobs(id,tenant_id,type,state,input_ref,input_hash,version,import_id) VALUES(${q(actor.jobId)},${q(actor.tenant)},'import','succeeded',${q(importId)},${q(digest(canary))},'SYN-HTTP-v1',${q(importId)});`);
    }
    const own=await request('/api/imports');assert.equal(own.status,200);privateResponse(own.response);
    assert.equal(own.data.data.canConfigure,true);assert.ok(own.data.data.team_jobs.some(row=>row.id===h.A.jobId));
    assert.ok(own.text.includes(h.A.canary));assert.ok(!own.text.includes(h.B.canary)&&!own.text.includes(h.B.jobId));
    h.sql(`UPDATE memberships SET role='viewer',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
    try{
      const viewer=await request('/api/imports');assert.equal(viewer.status,200);privateResponse(viewer.response);
      assert.equal(viewer.data.data.canConfigure,false);assert.deepEqual(viewer.data.data.team_jobs,[]);
      assert.ok(!viewer.text.includes(h.A.jobId),'PRIVILEGED_JOB_NOT_CACHED');
      const foreign=await request('/api/imports',{actor:h.B});assert.equal(foreign.status,200);privateResponse(foreign.response);
      assert.equal(foreign.data.data.canConfigure,true);assert.ok(foreign.data.data.team_jobs.some(row=>row.id===h.B.jobId));
      assert.ok(foreign.text.includes(h.B.canary));assert.ok(!foreign.text.includes(h.A.canary)&&!foreign.text.includes(h.A.jobId),'TENANT_CACHE_ISOLATION');
    }finally{h.sql(`UPDATE memberships SET role='owner',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
    h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
    try{
      const revoked=await request('/api/imports');assert.equal(revoked.status,403);privateResponse(revoked.response);
      assert.ok(!revoked.text.includes(h.A.canary)&&!revoked.text.includes(h.A.jobId),'REVOKED_NO_CACHED_PAYLOAD');
      const preserved=await request('/api/imports',{actor:h.B});assert.equal(preserved.status,200);assert.ok(preserved.text.includes(h.B.canary));
    }finally{h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
    assert.equal((await request('/api/imports')).status,200,'REVOCATION_CONTROL_RECOVERED');
  });

  await t.test('no attempted external fetch and no candidate mutation',()=>{
    const outbound=fs.readFileSync(path.join(evidence,'outbound-attempts.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
    assert.equal(outbound.some(row=>row.blocked),false,'NO_EXTERNAL_FETCH_ATTEMPT');h.verifySources();
  });
  fs.writeFileSync(path.join(evidence,'coverage.json'),JSON.stringify({
    scope:'local HTTP security slice; not global security acceptance',bodyRoutes,internalRoutes:machineRoutes,
    guardSources:{browserOrigin:'packages/platform/src/session.ts:assertOrigin',membership:'packages/platform/src/db.ts:createDatabase.transaction',body:'apps/web/src/lib/request-body.ts',
      worker:['packages/jobs/durable/hosted.mjs','packages/connectors/hosted.mjs','packages/intelligence/hosted.mjs','packages/notifications/hosted.mjs','apps/web/src/app/api/internal/history/route.ts','apps/web/src/app/api/internal/problems/route.ts'],headers:'apps/web/next.config.ts'},
    mutationObservation:{tables:['imports','jobs','connections','memberships'],oracle:'row counts only; updates/deletes offset by inserts and other tables are not covered'},
    unexercisedRoutes:routes.filter(r=>!r.exercised).map(r=>r.route),
    notProven:['CDN/edge cache in production','distributed admission quota','actual worker job execution','successful OAuth provider exchange','all role and resource matrices','logout and browser back-cache behavior','already issued signed-download revocation'],
  },null,2),{mode:0o600});
});
