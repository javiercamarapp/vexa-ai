import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {local,sql,startApp,login,origin,authURL,denied,tamper} from './support/F01-02/harness.mjs';

import {revocationOracle,readOnlyNavigation} from './support/F01-02/oracles.mjs';
const candidate=process.env.VEXA_CANDIDATE;
test('F01-02: real SSR callback, membership, invalid sessions, revocation and logout', {timeout:290000},async t=>{
  assert.ok(candidate,'SETUP: set VEXA_CANDIDATE explicitly');
  for(const file of ['packages/platform/src/session.ts','apps/web/src/app/login/page.tsx','apps/web/src/app/auth/callback/route.ts','apps/web/src/middleware.ts'])
    assert.ok(fs.existsSync(path.join(candidate,file)),`IMPLEMENTATION_MISSING: ${file}`);
  const h=await local(candidate);
  let browser,seeded=false;
  const a=randomUUID(),a2=randomUUID(),b=randomUUID();
  const canary=`ONLY_B_${randomUUID()}`;
  try {
    assert.equal(sql("SELECT to_regclass('public.organizations') IS NOT NULL AND to_regclass('public.memberships') IS NOT NULL;").trim(),'t',
      'SETUP: identity schema absent; apply reviewed VEXA identity migrations locally before this exam; no mock fallback');
    const A=await h.user(),B=await h.user();
    sql(`BEGIN; INSERT INTO public.organizations(id,name) VALUES ('${a}','SYN_A_${a}'),('${a2}','SYN_A2_${a2}'),('${b}','${canary}');
      INSERT INTO public.memberships(tenant_id,user_id,role,status,permissions_version) VALUES
      ('${a}','${A.userId}','analyst','active',1),('${a2}','${A.userId}','analyst','active',1),('${b}','${B.userId}','owner','active',1); COMMIT;`);
    seeded=true;
    await startApp(h,candidate);
    browser=await h.launchBrowser();
    const context=await browser.newContext({serviceWorkers:'block'});
    // Browser must not contact Google, cloud, or any other local service.
    const forbidden=[];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(![origin,authURL].includes(url.origin)){forbidden.push(url.origin);await route.abort();}
      else await route.continue();
    });
    const page=await context.newPage();
    const noB=async()=>assert.ok(!(await page.content()).includes(canary),'TENANT_LEAK: B canary rendered to A');
    const selector=()=>page.locator('select').filter({has:page.locator(`option[value="${a}"]`)});
    const select=async target=>{
      // New DOM load + new submit each time: no replay of a consumed action/nonce.
      await page.reload();await noB();
      const control=selector();assert.equal(await control.count(),1,'SETUP: expose the real organization select with UUID option values');
      await control.selectOption(target);
      const submit=control.locator('xpath=ancestor::form').locator('button[type="submit"],input[type="submit"]');
      if(await submit.count())await submit.first().click();
      await page.waitForLoadState('networkidle');
      assert.equal(await selector().inputValue(),target,'ORG_POSITIVE: authorized organization selection did not persist');
    };
    await t.test('valid local callback and local redirect',async()=>{
      await page.goto(await login(h,context,A.email,'/'));
      assert.equal(await selector().count(),1,'AUTH_POSITIVE: authenticated organization selector absent');
      assert.equal(await selector().locator(`option[value="${b}"]`).count(),0);
      await noB();
    });
    await t.test('fresh authorized selection / tampered B / fresh authorized control',async()=>{
      await select(a);await select(a2);
      const before=sql(`SELECT tenant_id,role,status,permissions_version FROM public.memberships WHERE user_id='${A.userId}' ORDER BY tenant_id;`);
      await page.reload();
      let intercepted=false,attackStatus,attackBody;
      // Modify a fresh real submission, preserving CSRF/action headers and nonce.
      const attack=async route=>{
        const request=route.request();const body=request.postData();
        if(!intercepted && request.method()==='POST' && body?.includes(a)){
          intercepted=true;
          const response=await route.fetch({postData:body.replaceAll(a,b),maxRedirects:0});
          attackStatus=response.status();attackBody=await response.text();await route.fulfill({response});
        }else await route.continue();
      };
      await page.route(`${origin}/**`,attack);
      try{
        await selector().selectOption(a);
        const submit=selector().locator('xpath=ancestor::form').locator('button[type="submit"],input[type="submit"]');
        if(await submit.count())await submit.first().click();
        await page.waitForLoadState('networkidle');
      }finally{await page.unroute(`${origin}/**`,attack);}
      assert.ok(intercepted,'SETUP: no real organization POST captured');
      assert.ok([403,404].includes(attackStatus),'ORG_FORBIDDEN: B selection must be forbidden');
      assert.doesNotMatch(attackBody,/csrf|invalid.*(?:nonce|action)|origin.*mismatch/i,'SETUP: CSRF failure is not membership enforcement');
      assert.match(attackBody,/forbidden|membership|organization|not.found|organizaci[oó]n|permiso/i,'ORG_REASON: rejection must identify authorization');
      assert.ok(!attackBody.includes(canary),'TENANT_LEAK: B data in rejection');
      await readOnlyNavigation(page,origin);assert.equal(await selector().inputValue(),a2,'ORG_STATE: forbidden selection changed active organization');await noB();
      assert.equal(sql(`SELECT tenant_id,role,status,permissions_version FROM public.memberships WHERE user_id='${A.userId}' ORDER BY tenant_id;`),before,'ORG_DB: forbidden request changed membership');
      await select(a);
    });
    await t.test('successful callback refuses external and protocol-relative redirects',async()=>{
      for(const next of ['https://example.invalid/escape','//example.invalid/escape','/\\example.invalid/escape']){
        const user=await h.user();
        sql(`INSERT INTO public.memberships(tenant_id,user_id,role,status,permissions_version) VALUES ('${a}','${user.userId}','analyst','active',1);`);
        const c=await browser.newContext();try{await login(h,c,user.email,next);}finally{await c.close();}
      }
      const r=await context.request.get(`${origin}/auth/callback?code=invalid&next=https://example.invalid`,{maxRedirects:0});
      assert.ok(r.status()>=400 || ([302,303,307,308].includes(r.status()) && new URL(r.headers().location,origin).origin===origin),'REDIRECT_INVALID: invalid code escaped origin');
    });
    await t.test('corrupt cookie, invalid signature, expired token without refresh, and anonymous',async()=>{
      const cookies=await context.cookies();
      const sessionCookies=cookies.filter(c=>/-auth-token(?:\.\d+)?$/.test(c.name));
      assert.ok(sessionCookies.length,'SETUP: Supabase SSR session cookies absent');
      const name=sessionCookies[0].name.replace(/\.\d+$/,'');
      const encoded=sessionCookies.sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true})).map(c=>c.value).join('');
      assert.ok(encoded.startsWith('base64-'),'SETUP: SSR cookie encoding changed; adapt reviewed driver');
      const session=JSON.parse(Buffer.from(encoded.slice(7),'base64url'));
      const expired=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
      // Both temporal probes use this local issuer's signature and real user claims.
      // An unchanged signature on modified exp would only test signature corruption.
      assert.ok(expired.exp*1000>Date.now(),'AUTH_POSITIVE: baseline token must be current');
      const fresh=h.signedClockSession(session,false),old=h.signedClockSession(session,true);
      const positive=await h.client.auth.getUser(fresh.access_token);
      assert.ok(!positive.error && positive.data.user?.id===A.userId,'EXPIRY_SETUP: local signer control must authenticate against real Auth');
      const negative=await h.client.auth.getUser(old.access_token);
      assert.ok(negative.error && !negative.data.user,'EXPIRY_SETUP: real Auth must reject expired signed token');
      const encode=s=>'base64-'+Buffer.from(JSON.stringify(s)).toString('base64url');
      const c0=await browser.newContext();try{
        await c0.addCookies([{name,value:encode(fresh),url:origin}]);
        const r=await c0.request.get(origin,{maxRedirects:0});
        assert.equal(r.status(),200,'EXPIRY_POSITIVE: equivalent current signed cookie must work in real app');
      }finally{await c0.close();}
      for(const value of [null,'corrupt-cookie',encode({...session,access_token:tamper(session.access_token),refresh_token:''}),encode(old)]){
        const c=await browser.newContext();try{
          if(value)await c.addCookies([{name,value,url:origin}]);
          const r=await c.request.get(origin,{maxRedirects:0});denied(r.status(),r.headers().location);
        }finally{await c.close();}
      }
    });
    await t.test('membership revocation blocks the immediately following request',async()=>{
      await select(a);
      sql(`DELETE FROM public.memberships WHERE user_id='${A.userId}';`);
      assert.equal(sql(`SELECT count(*) FROM public.memberships WHERE user_id='${A.userId}';`).trim(),'0');
      const r=await context.request.get(origin,{maxRedirects:0});
      revocationOracle(r.status(),r.headers().location,origin);
      assert.ok(!(await r.text()).includes(`SYN_A_${a}`),'REVOKED_DATA: protected content remains available');
      // Follow the real local chain BEFORE restoring membership. A login redirect
      // that then returns to protected content is not an authorization denial.
      const terminal=await page.goto(origin);await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).origin,origin,'REVOKED_CHAIN: escaped origin');
      assert.ok([401,403,404].includes(terminal?.status()) || new URL(page.url()).pathname==='/login','REVOKED_CHAIN: redirect restored protected access');
      assert.equal(await selector().count(),0,'REVOKED_CHAIN: private selector still available');
      assert.ok(!(await page.content()).includes(`SYN_A_${a}`),'REVOKED_CHAIN: protected content remains available');
      await noB();
      sql(`INSERT INTO public.memberships(tenant_id,user_id,role,status,permissions_version) VALUES ('${a}','${A.userId}','analyst','active',2);`);
    });
    await t.test('logout prevents direct return and browser back/cache access',async()=>{
      await page.goto(origin);assert.equal(await selector().count(),1);
      const logout=page.getByRole('button',{name:/log.?out|sign.?out|cerrar sesi[oó]n/i});
      assert.equal(await logout.count(),1,'SETUP: real logout button missing');
      await logout.click();await page.waitForLoadState('networkidle');
      const r=await context.request.get(origin,{maxRedirects:0});denied(r.status(),r.headers().location);
      await page.goBack();await page.waitForLoadState('networkidle');
      assert.equal(await selector().count(),0,'LOGOUT_CACHE: browser back restored private selector');
      assert.ok(!(await page.content()).includes(`SYN_A_${a}`),'LOGOUT_CACHE: browser back disclosed private data');
    });
    assert.deepEqual(forbidden,[],'NETWORK: browser attempted a forbidden destination');
  }finally{
    await browser?.close();await h.stopApp?.();
    try{if(seeded)sql(`BEGIN; DELETE FROM public.memberships WHERE tenant_id IN ('${a}','${a2}','${b}'); DELETE FROM public.organizations WHERE id IN ('${a}','${a2}','${b}'); COMMIT;`);}
    finally{await h.close();}
  }
});
