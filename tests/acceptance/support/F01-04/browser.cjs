const assert=require('node:assert/strict');
const {chromium}=require('/app/node_modules/playwright-core');
const fs=require('node:fs');
const base='http://localhost:57560';
const scope='date_start=2026-09-01&date_end=2026-10-01&currency=MXN&timezone=UTC&date_basis=conversation&sku=SYN-A&sku=SYN-B&source=csv&source=zendesk&snapshot_id=11111111-1111-4111-8111-111111111111';
const paths=['/overview','/problems','/recommendations','/explorer','/interventions','/briefs'];
async function keyboard(page,selector,label){
 const target=typeof selector==='string'?page.locator(selector):selector;assert.equal(await target.count(),1,`${label}: unique control`);
 await page.evaluate(()=>document.activeElement?.blur());
 let reached=false;
 for(let i=0;i<80;i++){await page.keyboard.press('Tab');if(await target.evaluate(e=>e===document.activeElement)){reached=true;break;}}
 assert.ok(reached,`${label}: unreachable by Tab`);
 assert.ok(await target.evaluate(e=>{const s=getComputedStyle(e);return (s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none';}),`${label}: invisible focus`);
}
async function stateOracle(page,kind){
 const root=page.locator('#exam-state');const text=await root.innerText();
 if(kind==='error'){
  assert.equal(await root.getByRole('alert').count(),1,'ERROR_VISIBLE');
  assert.match(text,/SYN_DATABASE_UNAVAILABLE/,'ERROR_CAUSE');
  assert.doesNotMatch(text,/Sin resultados|0 problemas|consulta terminó correctamente/i,'ERROR_NOT_EMPTY');
  const retry=root.getByRole('link',{name:/intentar|retry/i}).or(root.getByRole('button',{name:/intentar|retry/i}));
  assert.equal(await retry.count(),1,'ERROR_RETRY');
  await keyboard(page,retry,'ERROR_RETRY_KEYBOARD');
  const before=await root.getAttribute('data-render');
  const response=page.waitForResponse(r=>r.request().isNavigationRequest()&&new URL(r.url()).pathname==='/exam-f01-04',{timeout:4000}).catch(()=>null);
  await page.keyboard.press('Enter');
  assert.ok(await response,'ERROR_RETRY_REQUEST');
  await page.waitForLoadState();
  assert.notEqual(await root.getAttribute('data-render'),before,'ERROR_RETRY_REAL_RENDER');
  await keyboard(page,root.getByRole('link',{name:/intentar|retry/i}).or(root.getByRole('button',{name:/intentar|retry/i})),'ERROR_RETRY_FOCUS_AFTER');
  assert.equal(await root.getByRole('alert').count(),1,'ERROR_RETRY_REAL_RENDER');
 }else{
  assert.equal(await root.getByRole('status').count(),1,'STATE_LIVE:'+kind);
  if(kind==='loading')assert.equal(await root.locator('[aria-busy=true]').count(),1,'LOADING_BUSY');
  if(kind==='empty')assert.match(text,/Sin resultados|vacío|no results/i,'EMPTY_EXPLICIT');
  if(kind==='partial')assert.match(text,/parcial/i,'PARTIAL_EXPLICIT');
  if(kind==='stale')assert.match(text,/desactualiz|stale/i,'STALE_EXPLICIT');
  if(['partial','stale','ready'].includes(kind)){assert.match(text,/SYN_COVERAGE/,'COVERAGE');assert.match(text,/2026-09-01/,'WATERMARK');assert.match(text,/SYN_AUTHORIZED_CHILD/,'CHILD_CONTENT');}
  else assert.doesNotMatch(text,/SYN_AUTHORIZED_CHILD/,'NO_READY_DATA');
 }
}
async function navigationOracle(page){
 const nav=page.getByRole('navigation',{name:'Espacio de trabajo'});
 assert.equal(await nav.getByRole('link').count(),6,'SIX_ENTRIES');
 for(const p of paths){
  const selector=`nav a[href^="${p}?"]`;const link=page.locator(selector);
  assert.equal(await link.count(),1,'NAV_DESTINATION:'+p);
  const url=new URL(await link.getAttribute('href'),base);
  for(const [k] of new URLSearchParams(scope))assert.deepEqual(url.searchParams.getAll(k),new URLSearchParams(scope).getAll(k),'SCOPE_PRESERVED:'+k);
  assert.equal(url.searchParams.has('cursor'),false,'CURSOR_RESET');
  await keyboard(page,selector,'KEYBOARD_NAV');
 }
 await page.keyboard.press('Enter');await page.waitForURL('**/briefs?**');
 assert.equal(new URL(page.url()).pathname,'/briefs','KEYBOARD_ACTIVATION');
}
async function responsive(page,label){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'RESPONSIVE_OVERFLOW:'+label);
 const animations=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&Number(a.effect?.getTiming().duration)>1).length);
 assert.equal(animations,0,'REDUCED_MOTION:'+label);
 await page.screenshot({path:'/tmp/'+label+'.png',fullPage:true});
}
const invalidQueries=[['date_start=2026-02-31','invalid_date'],['currency=FAKE','invalid_currency'],['date_start=2026-10-01&date_end=2026-09-01','invalid_date_window'],['currency=USD&currency=MXN','duplicate_filter'],['source=unknown','invalid_source'],['timezone=Invalid','timezone_not_supported']];
async function validation(page,code){
 const alert=page.locator('[role=alert]:not(#__next-route-announcer__)');assert.equal(await alert.count(),1,'VALIDATION_ALERT:'+code);
 assert.match(await alert.innerText(),new RegExp('\\b'+code+'\\b'),'VALIDATION_SPECIFIC:'+code);
 assert.match(await alert.innerText(),/Alcance inválido|invalid scope/i,'VALIDATION_ACTIONABLE');
 assert.equal(await page.getByText(/Snapshot disponible/).count(),0,'INVALID_URL_NOT_READY');
}
async function authorized(page,response,fixture,label){
 assert.ok([200,503].includes(response.status()),'AUTHORIZED_ROUTE:'+label);
 assert.notEqual(new URL(page.url()).pathname,'/login','AUTHORIZED_NO_REDIRECT');
 assert.equal(await page.getByRole('navigation',{name:'Espacio de trabajo'}).count(),1,'AUTHORIZED_SHELL');
 const org=page.getByLabel('Organización activa');assert.equal(await org.inputValue(),fixture.tenant,'AUTHORIZED_ORG');
 assert.equal(await org.locator('option:checked').innerText(),'SYN_AUTHORIZED','AUTHORIZED_ORG_NAME');
 const body=await page.locator('body').innerText();assert.match(body,new RegExp('\\bRol: '+fixture.role+'\\b'),'AUTHORIZED_ROLE_PRESERVED expected='+fixture.role);
 assert.doesNotMatch(body,/ONLY_B_|workspace_identity_unavailable|organizations_unavailable|authentication_required/,'AUTH_NOT_DEPENDENCY');
 const alert=page.locator('[role=alert]:not(#__next-route-announcer__)');
 if(fixture.dependencyUnavailable||await alert.count()||response.status()===503){
  assert.equal(await alert.count(),1,'DEPENDENCY_VISIBLE');
  assert.match(await alert.innerText(),/workspace_unavailable|workspace_database_unavailable|database_not_configured/,'DEPENDENCY_SPECIFIC');
  assert.match(await alert.innerText(),/administrador.*configurar.*PostgreSQL.*workspace/i,'DEPENDENCY_ACTIONABLE');
  assert.equal(await page.getByText(/Snapshot disponible|Sin resultados para este alcance/).count(),0,'DEPENDENCY_NOT_READY');
 }
 console.log('AUTHORIZED '+label+' status='+response.status()+' role='+fixture.role+' org=synthetic dependency='+(await alert.count()>0));
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/ms-playwright/chromium-1226/chrome-linux/chrome',headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'});
 const forbidden=[];await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();forbidden.push(u.origin);return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(30000);
 if(process.argv[2]==='components'){
  for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
   await page.setViewportSize(viewport);
   for(const kind of ['loading','empty','error','partial','stale','ready']){
    const r=await page.goto(base+'/exam-f01-04?'+scope+'&kind='+kind+'&cursor=OLD');assert.equal(r.status(),200,'RENDER_SETUP');
    await stateOracle(page,kind);await responsive(page,`${viewport.width}-${kind}`);
   }
   await navigationOracle(page);
  }
 }else if(process.argv[2]==='validation'){
  for(const [query,code] of invalidQueries){await page.goto(base+'/exam-f01-04?kind=error&'+query);await validation(page,code);}
 }else{
  const routeScope='date_start=2026-09-01&date_end=2026-10-01&timezone=UTC&currency=USD&date_basis=conversation';
  const fixture=JSON.parse(fs.readFileSync('/tmp/fixture.json','utf8'));
  const detailPaths=[`/problems/${fixture.problem}`,`/customers/${fixture.customer}`];
  for(const p of [...paths,...detailPaths]){
   const r=await page.goto(base+p+'?'+routeScope);
   assert.ok([401,403].includes(r.status())||new URL(page.url()).pathname==='/login','ANONYMOUS_DENIED:'+p);
   assert.equal(await page.getByRole('navigation',{name:'Espacio de trabajo'}).count(),0,'ANONYMOUS_NO_SHELL');
  }
  assert.deepEqual(fixture.sessions.map(s=>s.role),['owner','analyst','operator','viewer'],'FOUR_REAL_ROLES');
  for(const session of fixture.sessions){
  fixture.role=session.role;
  await context.clearCookies();
  await context.addCookies(session.cookies.map(c=>({...c,url:base})));
  for(const p of [...paths,...detailPaths]){
   const r=await page.goto(base+p+'?'+routeScope);await authorized(page,r,fixture,p);
   assert.equal(new URL(page.url()).pathname,p,'AUTHORIZED_NO_REDIRECT');
   assert.equal(await page.getByRole('navigation',{name:'Espacio de trabajo'}).count(),1,'AUTHORIZED_SHELL');
   assert.equal(await page.locator('h1').count(),1,'ROUTE_HEADING');
   assert.doesNotMatch(await page.locator('body').innerText(),/ONLY_B_/,'TENANT_LEAK');
   for(const v of [{width:390,height:844},{width:1440,height:900}]){await page.setViewportSize(v);await responsive(page,`${v.width}-${fixture.role}-${p.slice(1).replaceAll('/','-')}`);}
  }
  if(fixture.actionPresent&&fixture.role!=='owner'){
   const r=await context.request.post(base+'/api/interventions/'+fixture.problem+'/transition',{headers:{Origin:base,'Idempotency-Key':'11111111-1111-4111-8111-111111111111'},data:{target:'approved',expected_version:1,reason:'SYN_ROLE_DENIAL',scope:routeScope}});
   assert.equal(r.status(),403,'LOWER_ROLE_ACTION_403_BEFORE_DB:'+fixture.role);
   assert.equal((await r.json()).error?.code,'role_forbidden','LOWER_ROLE_ACTION_ROLE_NOT_INFRA:'+fixture.role);
   console.log('ACTION_DENIED role='+fixture.role+' status=403 code=role_forbidden database=unconfigured');
  }
  // Real route authorization: a menu link cannot authorize a forged selector.
  for(const p of [...paths,...detailPaths]){
   const r=await page.goto(base+p+'?'+routeScope+'&tenant_id='+fixture.foreign);
   if(![400,401,403,404].includes(r.status()))await validation(page,'unsupported_filter');
   assert.equal(await page.getByText(/Snapshot disponible/).count(),0,'FORGED_SCOPE_NOT_READY');
  }
  await context.addCookies([{name:'vexa_active_org',value:fixture.foreign,url:base}]);
  for(const p of [...paths,...detailPaths]){
   const r=await page.goto(base+p+'?'+routeScope);assert.ok([401,403,404].includes(r.status())||new URL(page.url()).pathname==='/login','FORGED_ORG_DENIED:'+p);
  }
  await context.addCookies([{name:'vexa_active_org',value:fixture.tenant,url:base}]);
  await authorized(page,await page.goto(base+'/overview?'+routeScope),fixture,'AFTER_ATTACK');
  for(const [query,code] of invalidQueries){
   await page.goto(base+'/overview?'+query);await validation(page,code);
  }
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-invalid-session',url:base}]);
  for(const p of [...paths,...detailPaths]){
   const r=await page.goto(base+p+'?'+routeScope);
   assert.ok([401,403].includes(r.status())||new URL(page.url()).pathname==='/login','INVALID_SESSION_DENIED:'+p);
   assert.equal(await page.getByRole('navigation',{name:'Espacio de trabajo'}).count(),0,'INVALID_SESSION_NO_SHELL');
  }
  } // each real Auth role

 }
 assert.deepEqual(forbidden,[],'NETWORK_FORBIDDEN');console.log('PASS '+process.argv[2]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
