import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {q} from '../F06-push/harness.mjs';
import {seedBriefs} from '../F06-briefs/fixtures.mjs';
import {canaries,assertNoSecrets,inspectPublished} from '../../tests/acceptance/support/ci/artifact-secrets.mjs';

const candidate=process.env.VEXA_CANDIDATE;
const hash=value=>createHash('sha256').update(value).digest('hex');
const sensitivePayload='SYN-HTTP-WEBHOOK-PII-'+randomUUID()+'@example.test';

// Adapt accepted infrastructure only in a disposable driver. Canaries exist in
// env before npm/build, not just in the server started after compilation.
async function setupWithBuildCanaries(candidate,evidence,fixture){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'f07-http-extra-driver-'));
  const sourceURL=new URL('../F06-push/harness.mjs',import.meta.url);
  let source=fs.readFileSync(sourceURL,'utf8');
  source=source.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,sourceURL).href):original);
  source=source.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,sourceURL).href)+')');
  const buildEnv=`Object.assign(env,${JSON.stringify({SUPABASE_SERVICE_ROLE_KEY:fixture.service,VEXA_SERVER_ONLY_CANARY:fixture.server})});`;
  const publicFixture=`fs.mkdirSync(path.join(tmp,'apps/web/public'),{recursive:true});fs.writeFileSync(path.join(tmp,'apps/web/public/SYN-public-anon.txt'),${JSON.stringify(fixture.anon)});`;
  const insertion="fs.writeFileSync(path.join(driver,'harness.mjs'),code);";
  assert.equal(source.split(insertion).length,2,'HARNESS_INSERTION_UNIQUE');
  const adapter=`
    const replaceOnce=(needle,value)=>{assert.equal(code.split(needle).length,2,'HARNESS_ADAPTER_UNIQUE:'+needle);code=code.replace(needle,value);};
    replaceOnce("env.PATH=path.dirname(process.execPath)+':'+env.PATH;", "env.PATH=path.dirname(process.execPath)+':'+env.PATH;"+${JSON.stringify(buildEnv)});
    replaceOnce('copyBuildInputs(candidate,tmp);','copyBuildInputs(candidate,tmp);'+${JSON.stringify(publicFixture)});
    for(let n=0;n<6;n++)code=code.replaceAll(String(60840+n),String(60940+n));
    replaceOnce("h.base='http://127.0.0.1:60944'", "h.base='http://localhost:60944'");
  `;
  source=source.replace(insertion,adapter+insertion);
  fs.writeFileSync(path.join(directory,'harness.mjs'),source,{mode:0o600});
  fs.writeFileSync(path.join(evidence,'canary-build-contract.json'),JSON.stringify({nonce:fixture.nonce,ports:[60940,60941,60942,60943,60944,60945],harnessSHA256:hash(fs.readFileSync(sourceURL)),adapterSHA256:hash(source),injectedBeforeBuild:['SUPABASE_SERVICE_ROLE_KEY','VEXA_SERVER_ONLY_CANARY'],publicPositive:'SYN-public-anon.txt'}),{mode:0o600});
  let harness;
  try{
    harness=await(await import(pathToFileURL(path.join(directory,'harness.mjs')))).setup(candidate,evidence);
    const close=harness.close.bind(harness);
    harness.close=async()=>{try{await close();}finally{fs.rmSync(directory,{recursive:true,force:true});}};
    return harness;
  }catch(error){fs.rmSync(directory,{recursive:true,force:true});throw error;}
}

function signedDelivery(base,binding,{body,stamp=Date.now(),signature,signPath}={}){
  const raw=body??(binding.source==='hubspot'?`[ {"portalId":${binding.accountId},"appId":${binding.appId},"private":"${sensitivePayload}"} ]`:`{ "event":"ticket.updated", "private":"${sensitivePayload}", "tenant_id":"SYN-untrusted-tenant" }`);
  const timestamp=binding.source==='hubspot'?String(stamp):new Date(stamp).toISOString();
  const route='/api/webhooks/crm/'+binding.id;
  const input=binding.source==='hubspot'?'POST'+base+(signPath??route)+raw+timestamp:timestamp+raw;
  const headers={'content-type':'application/json',Connection:'close'};
  headers[binding.source==='hubspot'?'x-hubspot-request-timestamp':'x-zendesk-webhook-signature-timestamp']=timestamp;
  headers[binding.source==='hubspot'?'x-hubspot-signature-v3':'x-zendesk-webhook-signature']=signature??createHmac('sha256',binding.secret).update(input).digest('base64');
  return {route,raw,timestamp,headers,digest:hash(timestamp+'\0'+raw)};
}

async function webhookChecks(t,h,evidence){
  const bindings=[
    {id:'SYN_zendesk_binding_http_A',tenantId:h.A.tenant,connectionId:h.A.connection,source:'zendesk',accountId:h.A.account,secret:'SYN-ZENDESK-NOT-A-REAL-SECRET-'+randomUUID()},
    {id:'SYN_hubspot_binding_http_B',tenantId:h.B.tenant,connectionId:h.B.connection,source:'hubspot',accountId:'123',appId:'456',secret:'SYN-HUBSPOT-NOT-A-REAL-SECRET-'+randomUUID()},
  ];
  for(const [i,binding]of bindings.entries()){
    const actor=i===0?h.A:h.B;
    h.sql(`UPDATE connections SET source=${q(binding.source)},account_id=${q(binding.accountId)} WHERE tenant_id=${q(actor.tenant)} AND id=${q(actor.connection)};
      INSERT INTO crm_sync_settings(tenant_id,connection_id,actor_id,enabled,history_from,backfill_to,next_attempt_at)
      VALUES(${q(actor.tenant)},${q(actor.connection)},${q(actor.id)},true,clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 hour');`);
  }
  await h.stopWeb();await h.startWeb(false,{VEXA_CRM_WEBHOOKS_ENABLED:'true',VEXA_CRM_WEBHOOK_BINDINGS_JSON:JSON.stringify(bindings)});
  const observations=[];
  const send=async(delivery,{suffix='',headers={}}={})=>{
    const response=await fetch(h.base+delivery.route+suffix,{method:'POST',redirect:'manual',headers:{...delivery.headers,...headers},body:delivery.raw,signal:AbortSignal.timeout(15000)});
    const text=await response.text();assert.ok(!text.includes(sensitivePayload),'WEBHOOK_NO_RESPONSE_PII');
    for(const binding of bindings)assert.ok(!text.includes(binding.secret),'WEBHOOK_NO_RESPONSE_SECRET');
    assert.match(response.headers.get('cache-control')??'',/no-store/,'WEBHOOK_PRIVATE');
    const data=JSON.parse(text);observations.push({source:delivery.route===('/api/webhooks/crm/'+bindings[0].id)?'zendesk':'hubspot',status:response.status,code:data.code});
    return {status:response.status,data};
  };
  const receipts=()=>h.sql('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),\'[]\'::jsonb) FROM crm_webhook_receipts r');
  const count=(binding,digest)=>Number(h.sql(`SELECT count(*) FROM crm_webhook_receipts WHERE tenant_id=${q(binding.tenantId)} AND connection_id=${q(binding.connectionId)}${digest?' AND digest='+q(digest):''}`));
  const assertAccepted=async(binding,options={})=>{
    const delivery=signedDelivery(h.base,binding,options),before=count(binding);
    const accepted=await send(delivery);assert.equal(accepted.status,202,'SIGNED_DELIVERY_ACCEPTED');assert.equal(accepted.data.code,'CRM_WEBHOOK_ACCEPTED');
    assert.equal(count(binding,delivery.digest),1,'EXACT_DIGEST_PERSISTED');assert.equal(count(binding),before+1,'ONE_RECEIPT_PERSISTED');
    return delivery;
  };
  t.after(()=>fs.writeFileSync(path.join(evidence,'SYN-webhook-observations.json'),JSON.stringify(observations,null,2),{mode:0o600}));

  await t.test('signed raw payload persists only bound tenant and replay is durable duplicate',async()=>{
    for(const binding of bindings){
      const other=bindings.find(row=>row!==binding),otherBefore=count(other);
      const body=binding.source==='zendesk'?JSON.stringify({event:'ticket.updated',private:sensitivePayload,tenant_id:other.tenantId,connection_id:other.connectionId}):undefined;
      const delivery=await assertAccepted(binding,{body});
      assert.equal(count(other),otherBefore,'BODY_TENANT_CANNOT_REASSIGN');
      assert.equal(h.sql(`SELECT next_attempt_at<clock_timestamp()+interval '10 seconds' FROM crm_sync_settings WHERE tenant_id=${q(binding.tenantId)} AND connection_id=${q(binding.connectionId)}`),'t','SYNC_WAKEUP_PERSISTED');
      const before=receipts(),replay=await send(delivery);
      assert.equal(replay.status,200);assert.equal(replay.data.code,'CRM_WEBHOOK_DUPLICATE');assert.equal(receipts(),before,'REPLAY_NO_MUTATION');
    }
    assert.ok(!receipts().includes(sensitivePayload),'RAW_PAYLOAD_NOT_PERSISTED_IN_RECEIPTS');
  });

  await t.test('invalid signature, timestamp, URL scope and HubSpot account cannot persist',async()=>{
    const before=receipts();
    for(const binding of bindings){
      assert.equal((await send(signedDelivery(h.base,binding,{signature:'A'.repeat(43)+'='}))).status,401,'SIGNATURE_DENIED');
      assert.equal((await send(signedDelivery(h.base,binding,{stamp:Date.now()-360000}))).status,401,'STALE_DENIED');
      assert.equal((await send(signedDelivery(h.base,binding),{suffix:'?tenant='+bindings[1].tenantId})).status,400,'QUERY_SCOPE_DENIED');
    }
    const hub=bindings[1];
    assert.equal((await send(signedDelivery(h.base,hub,{body:'[{"portalId":999,"appId":456}]'}))).status,403,'ACCOUNT_DENIED');
    assert.equal((await send(signedDelivery(h.base,hub,{body:'[{"portalId":123,"appId":999}]'}))).status,403,'APP_DENIED');
    assert.equal((await send(signedDelivery(h.base,hub,{signPath:'/api/webhooks/crm/SYN_other_binding'}))).status,401,'SIGNED_URL_DENIED');
    const raw=signedDelivery(h.base,hub);raw.raw=JSON.stringify(JSON.parse(raw.raw));
    assert.equal((await send(raw)).status,401,'RAW_WHITESPACE_SIGNATURE');
    assert.equal(receipts(),before,'INVALID_DELIVERIES_NO_RECEIPT');
  });

  await t.test('revoked owner or worker delegation rejects next delivery and preserves tenant B',async()=>{
    for(const revoke of ['owner','delegation']){
      const apply=revoke==='owner'?`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`:`UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`;
      const restore=revoke==='owner'?`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`:`UPDATE worker_delegations SET enabled=true WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`;
      h.sql(apply);
      try{
        const before=receipts(),delivery=signedDelivery(h.base,bindings[0],{body:JSON.stringify({event:'ticket.updated',private:sensitivePayload,nonce:randomUUID()})});
        assert.equal((await send(delivery)).status,503,'REVOKED_DELIVERY_DENIED:'+revoke);
        assert.equal(receipts(),before,'REVOKED_NO_RECEIPT');
        await assertAccepted(bindings[1],{body:JSON.stringify([{portalId:123,appId:456,nonce:randomUUID()}])});
      }finally{h.sql(restore);}
      await assertAccepted(bindings[0],{body:JSON.stringify({event:'ticket.updated',nonce:randomUUID()})});
    }
  });
  return bindings.map(row=>row.secret);
}

async function exportChecks(t,h,evidence,fixture,webhookSecrets){
  await t.test('authenticated brief exports preserve identity, hide secrets and PII, escape HTML and recheck membership',async()=>{
    const f=await seedBriefs(h);
    // Persist a raw PII canary through real canonical ingestion in this tenant;
    // it is unrelated private customer data and must not enter the brief export.
    const customerId=await f.a.save('customer','SYN-EXPORT-PRIVATE-CUSTOMER',{display_name:sensitivePayload});
    assert.equal(h.sql(`SELECT display_name FROM customers WHERE tenant_id=${q(h.A.tenant)} AND id=${q(customerId)}`),sensitivePayload,'RAW_PII_CANARY_PERSISTED');
    const generated=await h.request(h.A,'/api/briefs',{operation:'generate',query:f.query.toString(),comparisonQuery:null,expectedPreviousId:null,requestKey:randomUUID()});
    assert.equal(generated.status,200,'ACTUAL_BRIEF_GENERATED');
    const brief=generated.data.data;
    assert.ok(brief.document.critical.some(problem=>problem.id===f.critical.id),'HOSTILE_LABEL_IN_ACTUAL_BRIEF');
    assert.ok(JSON.stringify(brief.document).includes('<img src=x onerror=alert(1)>'),'HTML_CANARY_SOURCE_PRESENT');
    assert.ok(brief.document.metrics.length>0&&brief.document.top3.length>0,'NONEMPTY_EXPORT_FIXTURE');
    const scan=(value,surface)=>{
      assertNoSecrets(value,fixture,surface);
      for(const marker of [sensitivePayload,...webhookSecrets,h.A.email,h.B.email,'SOLO_B_9F'])
        assertNoSecrets(value,{server:marker},surface+':SYN_PRIVATE_MARKER');
    };
    const observations=[];
    const download=async(format,actor=h.A)=>{
      const response=await fetch(h.base+'/api/briefs/'+brief.id+'/export?format='+format,{redirect:'manual',headers:{...(actor?{cookie:h.cookie(actor)}:{}),Connection:'close'},signal:AbortSignal.timeout(20000)});
      const bytes=Buffer.from(await response.arrayBuffer());
      scan(bytes,'authenticated_export:'+format);scan(JSON.stringify([...response.headers]),'authenticated_export_headers:'+format);
      assert.match(response.headers.get('cache-control')??'',/\bprivate\b/,'EXPORT_PRIVATE');
      assert.match(response.headers.get('cache-control')??'',/\bno-store\b/,'EXPORT_NO_STORE');
      observations.push({format,status:response.status,bytes:bytes.length,sha256:hash(bytes)});
      return {response,bytes,text:bytes.toString('utf8')};
    };
    const csp="default-src 'none'; sandbox; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
    for(const format of ['json','html']){
      const result=await download(format);assert.equal(result.response.status,200,'AUTHORIZED_EXPORT:'+format);
      assert.ok(result.bytes.length>100,'NONEMPTY_EXPORT_BYTES');
      assert.equal(result.response.headers.get('content-disposition'),`attachment; filename="brief-${brief.id}.${format}"`);
      assert.equal(result.response.headers.get('x-contract-version'),'f06-briefs-v1');
      assert.equal(result.response.headers.get('x-content-type-options'),'nosniff');
      assert.match(result.response.headers.get('x-trace-id')??'',/^[0-9a-f-]{36}$/i);
      assert.equal(result.response.headers.get('content-security-policy'),csp,'EXPORT_CSP_SERVED_NOT_GLOBAL_DEFAULT');
      if(format==='json'){
        assert.match(result.response.headers.get('content-type')??'',/^application\/json\b/);
        const actual=JSON.parse(result.text);assert.equal(actual.id,brief.id);assert.equal(actual.contentHash,brief.contentHash);assert.deepEqual(actual.document,brief.document);
      }else{
        assert.match(result.response.headers.get('content-type')??'',/^text\/html\b/);
        assert.ok(result.text.includes(brief.id)&&result.text.includes(brief.contentHash),'HTML_IDENTITY_POSITIVE');
        assert.ok(result.text.includes('&lt;img src=x onerror=alert(1)&gt;'),'HOSTILE_LABEL_ESCAPED');
        assert.ok(!/<(?:script|img|iframe|object)\b/i.test(result.text),'NO_ACTIVE_HOSTILE_EXPORT_TAGS');
      }
      fs.writeFileSync(path.join(evidence,'SYN-export-brief.'+format),result.bytes,{mode:0o600});
      for(const [actor,status]of [[h.B,404],[null,401]]){
        const denied=await download(format,actor);assert.equal(denied.response.status,status,'EXPORT_FOREIGN_OR_ANON');
        assert.ok(!denied.text.includes(brief.id)&&!denied.text.includes(brief.contentHash)&&!denied.text.includes(f.critical.label),'DENIED_EXPORT_NO_DOCUMENT');
      }
    }
    h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
    try{
      for(const format of ['json','html']){
        const denied=await download(format);assert.equal(denied.response.status,403,'REVOKED_EXPORT_DENIED');
        assert.ok(!denied.text.includes(brief.contentHash)&&!denied.text.includes(f.critical.label),'REVOKED_EXPORT_NO_DOCUMENT');
      }
      const control=await h.request(h.B,'/api/imports');assert.equal(control.status,200,'OTHER_TENANT_AUTH_PRESERVED');
    }finally{h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
    const restored=await download('json');assert.equal(restored.response.status,200,'EXPORT_AUTHORIZATION_RECOVERED');
    assert.deepEqual(JSON.parse(restored.text).document,brief.document,'RESTORED_EXPORT_EXACT_DOCUMENT');
    fs.writeFileSync(path.join(evidence,'SYN-export-security.json'),JSON.stringify({observations,csp,formats:['json','html'],privateCanaryPersisted:true,scope:'actual authenticated attachment bytes, immutable brief identity, served restrictive CSP, hostile label escaping and current membership',notProven:['All export families or CSV formula safety','Arbitrary stored XSS payloads','Browser rendering of attachment HTML with CSP enforcement']},null,2),{mode:0o600});
  });
}

async function logoutChecks(t,h,evidence){
  await t.test('real browser logout clears session; old cookie, old tab and back navigation fail closed',async()=>{
    const organizationCanary='SYN-HTTP-PRIVATE-ORG-'+randomUUID();
    h.sql(`UPDATE organizations SET name=${q(organizationCanary)} WHERE id=${q(h.A.tenant)}`);
    const browser=await h.browser(),context=await browser.newContext();context.setDefaultTimeout(20000);
    const outbound=[];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return route.continue();
      outbound.push({origin:url.origin,path:url.pathname});await route.abort('blockedbyclient');
    });
    const oldCookie=h.cookie(h.A);
    await context.addCookies(oldCookie.split('; ').map(value=>{const split=value.indexOf('=');return{name:value.slice(0,split),value:value.slice(split+1),url:h.base};}));
    const events=[];
    await context.exposeBinding('recordPageTransition',(_source,event)=>events.push(event));
    await context.addInitScript(()=>window.addEventListener('pageshow',event=>{void window.recordPageTransition({type:'pageshow',persisted:event.persisted,path:location.pathname});}));
    const active=await context.newPage(),oldTab=await context.newPage(),backTab=await context.newPage();
    try{
      for(const page of [active,oldTab,backTab]){
        await page.goto(h.base+'/overview');await page.getByText(organizationCanary,{exact:true}).first().waitFor();
      }
      // A full document navigation puts the private page into browser history.
      await backTab.goto(h.base+'/login');
      const logoutResponse=active.waitForResponse(response=>response.url()===h.base+'/auth/logout'&&response.request().method()==='POST');
      await active.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
      const logout=await logoutResponse;assert.equal(logout.status(),303,'LOGOUT_REVOKED');
      assert.equal(await logout.headerValue('clear-site-data'),'"cache", "cookies", "storage"','LOGOUT_CLEAR_SITE_DATA');
      await active.waitForURL(url=>url.pathname==='/login');
      const cookies=await context.cookies(h.base);assert.equal(cookies.some(cookie=>cookie.name.startsWith('sb-')||cookie.name==='vexa_active_org'),false,'AUTH_COOKIES_CLEARED');
      const replay=await fetch(h.base+'/api/imports',{redirect:'manual',headers:{cookie:oldCookie},signal:AbortSignal.timeout(15000)});
      assert.equal(replay.status,401,'OLD_COOKIE_REPLAY_DENIED');assert.ok(!(await replay.text()).includes(organizationCanary),'OLD_COOKIE_NO_PRIVATE_DATA');
      const oldTabRequest=await oldTab.evaluate(async()=>{const response=await fetch('/api/imports',{cache:'no-store'});return{status:response.status,text:await response.text()};});
      assert.equal(oldTabRequest.status,401,'OLD_TAB_NEXT_REQUEST_DENIED');assert.ok(!oldTabRequest.text.includes(organizationCanary));
      await oldTab.reload();await oldTab.waitForURL(url=>url.pathname==='/login');
      await backTab.goBack({waitUntil:'domcontentloaded'});await backTab.waitForURL(url=>url.pathname==='/login');
      for(const page of [active,oldTab,backTab])assert.ok(!(await page.locator('body').innerText()).includes(organizationCanary),'LOGOUT_NO_PRIVATE_DOM');
      const b=await fetch(h.base+'/api/imports',{redirect:'manual',headers:{cookie:h.cookie(h.B)},signal:AbortSignal.timeout(15000)});
      assert.equal(b.status,200,'OTHER_USER_SESSION_PRESERVED');await b.arrayBuffer();
      assert.equal(outbound.length,0,'NO_BROWSER_EXTERNAL_REQUEST');
    }finally{
      fs.writeFileSync(path.join(evidence,'SYN-logout-browser.json'),JSON.stringify({events,blockedRequests:outbound,actualBFCacheRestorationObserved:events.some(event=>event.persisted),limits:['No forced BFCache restoration; browser may decline caching','No instantaneous erasure asserted for idle tabs before a request/navigation']},null,2),{mode:0o600});
      await context.close();
    }
  });
}

test('SEC HTTP extra: build canaries, signed CRM persistence and browser logout',{timeout:600000},async t=>{
  assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
  const evidence=fs.mkdtempSync(path.join(process.env.VEXA_FUNCTIONAL_EVIDENCE??os.tmpdir(),'vexa-sec-http-extra-'));
  fs.chmodSync(evidence,0o700);console.log('F07_HTTP_EXTRA_EVIDENCE:'+evidence);
  const fixture=canaries(),supplemental={};let h;let webhookSecrets=[];
  for(const file of ['apps/web/next.config.ts','package.json','package-lock.json'])supplemental[file]=hash(fs.readFileSync(path.join(candidate,file)));
  fs.writeFileSync(path.join(evidence,'extra-source-hashes.json'),JSON.stringify(supplemental,null,2),{mode:0o600});
  t.after(async()=>{
    try{if(h)h.verifySources();for(const[file,digest]of Object.entries(supplemental))assert.equal(hash(fs.readFileSync(path.join(candidate,file))),digest,'SOURCE_CHANGED:'+file);}
    finally{if(h)await h.close();}
  });
  h=await setupWithBuildCanaries(candidate,evidence,fixture);
  assert.equal(h.common.SUPABASE_SERVICE_ROLE_KEY,fixture.service,'RUNTIME_INHERITED_BUILD_CANARY');
  assert.equal(h.common.VEXA_SERVER_ONLY_CANARY,fixture.server,'SERVER_CANARY_INSTALLED');
  await t.test('all published static artifacts, prerenders and unauthenticated HTTP responses hide server canaries',async()=>{
    const publicResponse=await fetch(h.base+'/SYN-public-anon.txt',{redirect:'manual',signal:AbortSignal.timeout(15000)});
    assert.equal(publicResponse.status,200);assert.equal(await publicResponse.text(),fixture.anon,'PUBLIC_ANON_POSITIVE');
    const result=await inspectPublished(path.join(h.tmp,'apps/web'),h.base,fixture);
    assert.ok(result.artifacts>0&&result.requests>0,'PUBLISHED_SURFACES_INSPECTED');
    fs.writeFileSync(path.join(evidence,'canary-published.json'),JSON.stringify(result,null,2),{mode:0o600});
  });
  webhookSecrets=await webhookChecks(t,h,evidence);
  await exportChecks(t,h,evidence,fixture,webhookSecrets);
  await logoutChecks(t,h,evidence);
  await t.test('build/runtime logs contain no SYN secrets or webhook PII; external fetch remains blocked',async()=>{
    await h.stopWeb();
    const files=fs.readdirSync(evidence).filter(file=>/\.(log|jsonl)$/.test(file));assert.ok(files.includes('run-build---workspace-@vexa_web.log'),'BUILD_LOG_PRESENT');
    for(const file of files){
      const content=fs.readFileSync(path.join(evidence,file));assertNoSecrets(content,fixture,'log:'+file);
      for(const secret of [sensitivePayload,...webhookSecrets])assert.ok(!content.toString().includes(secret),'NO_SYN_PII_OR_SECRET_LOG:'+file);
    }
    const attempts=fs.readFileSync(path.join(evidence,'outbound-attempts.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
    assert.equal(attempts.some(row=>row.blocked),false,'NO_EXTERNAL_FETCH_ATTEMPT');
    fs.writeFileSync(path.join(evidence,'extra-coverage.json'),JSON.stringify({logFiles:files,buildCanaries:true,realHTTPPersistence:true,browserLogout:true,authenticatedBriefExports:true,servedBriefCSP:true,notProven:['production deployment/CDN','real CRM deliveries','provider credentials or live LLM','all authenticated pages and all log destinations','other export families and CSV formula safety','arbitrary stored XSS or browser attachment CSP enforcement','guaranteed BFCache entry','existing signed URLs revoked']},null,2),{mode:0o600});
  });
});
