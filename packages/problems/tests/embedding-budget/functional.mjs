import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {setup,q} from './harness.mjs';
const candidate=process.env.VEXA_CANDIDATE??process.cwd(),evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-budget325-'));console.log('BUDGET325_EVIDENCE:'+evidence);const report={node:process.version,candidate,status:'running',checks:[]};let h,ctx;
const check=async(name,fn)=>{const record={name,status:'running'};report.checks.push(record);try{await fn();record.status='pass';}catch(error){record.status='fail';record.error=error.message;throw error;}finally{fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2));}};
try{
 h=await setup(candidate,evidence);const {syntheticConfig}=await import(pathToFileURL(path.join(candidate,'support/F04-extraction/config-fixture.mjs'))),{createDurableBudgetRepository}=await import(pathToFileURL(path.join(h.built,'packages/gateway/durable-budget.mjs')));
 const windows={embedding:'SYN-EMBED-325',extraction:'SYN-EXTRACT-325',old:'SYN-EMBED-OLD-325'};
 const config=a=>{const c=syntheticConfig(a.tenant);c.gateway.policy.window=windows.embedding;return{tenantId:a.tenant,modelId:'synthetic/model',dimensions:3,version:'SYN325',threshold:0.2,gateway:{policy:c.gateway.policy,candidate:c.gateway.modelsByRole.extraction[0],catalog:{...c.gateway.catalog,models:[{id:'synthetic/model',dimensions:3,contextTokens:200000}]}}};};
 const extraction=syntheticConfig(h.A.tenant);extraction.gateway.policy.window=windows.extraction;
 const preload=path.join(h.tmp,'no-external325.mjs');fs.writeFileSync(preload,"const original=globalThis.fetch;globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url??String(input));if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('PROVIDER_CALL_NOT_AUTHORIZED');return original(input,init);};");
 const env={NODE_OPTIONS:'--import '+preload,VEXA_PROBLEMS_CONFIG_JSON:JSON.stringify([config(h.A),config(h.B)]),VEXA_PROBLEMS_RUNTIME:'stub',VEXA_EXTRACTION_CONFIG_JSON:JSON.stringify([extraction]),VEXA_AI_RUNTIME:'stub'};
 await h.stopWeb();await h.startWeb(false,env);
 const request=(body,a=h.A)=>h.request(a,'/api/problems',body),get=async(a=h.A)=>{const r=await request(undefined,a);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
 const configure=(purpose,amount,extra={})=>({operation:'budget',purpose,limitUsd:amount,expectedWindow:windows.embedding,...extra});
 const ok=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data;};
 let current,older,foreign,extractReservation,reconcileBody;
 await check('owner configures all and embedding in their own window without enabling inference',async()=>{
  const before=await get();assert.equal(before.canConfigureBudget,true);assert.equal(before.budget.window,windows.embedding);assert.equal(before.configuration.enabled,false);assert.deepEqual(before.budget.limits,[]);
  await ok(request(configure('all','10')));await ok(request(configure('embedding','2.123456')));
  const state=await get();assert.equal(state.budget.limits.find(x=>x.purpose==='embedding').limitMinor,'2123456');assert.equal(state.configuration.enabled,false);
  assert.equal(h.sql(`SELECT count(*) FROM ai_budget_limits WHERE tenant_id=${q(h.A.tenant)} AND window_key=${q(windows.extraction)}`),'0');
  assert.equal(h.sql(`SELECT count(*) FROM ai_budget_reservations WHERE tenant_id=${q(h.A.tenant)}`),'0');
 });
 await check('strict payloads and window/version CAS reject invalid changes',async()=>{
  for(const body of [configure('extraction','1'),configure('embedding',1),configure('embedding','1e3'),configure('embedding','-1'),configure('embedding','1.0000001'),configure('embedding','1',{tenantId:h.B.tenant}),configure('embedding','1',{expectedVersion:0})])assert.equal((await request(body)).status,400,JSON.stringify(body));
  assert.equal((await request(configure('embedding','3',{expectedWindow:windows.extraction,expectedVersion:1}))).status,409);
  await ok(request(configure('embedding','3',{expectedVersion:1})));assert.equal((await request(configure('embedding','4',{expectedVersion:1}))).status,409);
  assert.equal((await get()).budget.limits.find(x=>x.purpose==='embedding').limitMinor,'3000000');
  const csrf=await fetch(h.base+'/api/problems',{method:'POST',headers:{cookie:h.cookie(h.A),'content-type':'application/json'},body:JSON.stringify(configure('embedding','9',{expectedVersion:2}))});assert.equal(csrf.status,403);
 });
 const seed=async(a,window,purpose='embedding')=>{
  const jobId=randomUUID();h.sql(`INSERT INTO jobs(id,tenant_id,type,state,input_ref,input_hash,version) VALUES(${q(jobId)},${q(a.tenant)},${q(purpose)},'running','SYN-budget325',${q(randomUUID())},'SYN-v1')`);
  const repository=createDurableBudgetRepository({database:h.repository(a).database,purpose,jobId});
  for(const target of ['all',purpose])if(h.sql(`SELECT count(*) FROM ai_budget_limits WHERE tenant_id=${q(a.tenant)} AND window_key=${q(window)} AND purpose=${q(target)}`)==='0')await repository.configure({window,purpose:target,limitMinor:'10000000'});
  const held=await repository.reserve({tenantId:a.tenant,taskKey:randomUUID(),window,amountMinor:'500',fingerprint:'a'.repeat(64),tenantLimitMinor:'10000000',currency:'USD',exponent:6});assert.equal(held.acquired,true);
  await repository.recordAttempt(held.reservationId,{index:0,state:'started',model:'SYN-no-network',provider:'SYN-local',pricingVersion:'SYN-v1',ceilingMinor:'500'});
  await repository.finalize(held.reservationId,{state:'uncertain',actualMinor:null,reportedMinor:'0'});
  return(await repository.list({window})).find(x=>x.id===held.reservationId);
 };
 await check('real durable uncertain reservations are purpose and tenant isolated including old windows',async()=>{
  current=await seed(h.A,windows.embedding);older=await seed(h.A,windows.old);foreign=await seed(h.B,windows.embedding);extractReservation=await seed(h.A,windows.extraction,'extraction');
  const state=await get();assert.deepEqual(new Set(state.budget.reservations.map(x=>x.id)),new Set([current.id,older.id]));assert.ok(state.budget.reservations.every(x=>x.actualMinor===null&&x.state==='uncertain'&&x.heldMinor==='500'));
  assert.deepEqual((await get(h.B)).budget.reservations.map(x=>x.id),[foreign.id]);
  assert.equal((await h.request(h.A,'/api/extraction')).data.reservations[0].id,extractReservation.id);
 });
 await check('only current owner may read budget detail or mutate limits and receipts',async()=>{
  for(const role of ['viewer','analyst']){h.sql(`UPDATE memberships SET role=${q(role)} WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`);const actor={...h.bot,tenant:h.A.tenant};const data=await get(actor);assert.equal(data.canConfigureBudget,false);assert.equal(data.budget,null);assert.equal((await request(configure('embedding','9',{expectedVersion:2}),actor)).status,403);assert.equal((await request({operation:'reconcile'},actor)).status,403);}
  h.sql(`UPDATE memberships SET role='analyst' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`);
  reconcileBody={operation:'reconcile',reservationId:current.id,expectedVersion:current.version,expectedWindow:current.window,actualUsd:'0.000040',evidenceHash:'b'.repeat(64),confirmedProviderEvidence:true};
  assert.equal((await request(reconcileBody,h.B)).status,404);assert.equal((await request({...reconcileBody,reservationId:extractReservation.id,expectedWindow:windows.extraction})).status,404);
  assert.equal((await request({...reconcileBody,expectedWindow:windows.old})).status,404);
  for(const body of [{...reconcileBody,confirmedProviderEvidence:false},{...reconcileBody,evidenceHash:'bad'},{...reconcileBody,actualUsd:'-1'},{...reconcileBody,tenantId:h.B.tenant}])assert.equal((await request(body)).status,400);
  assert.equal((await request({...reconcileBody,expectedVersion:current.version+1})).status,409);assert.equal((await get()).budget.reservations.find(x=>x.id===current.id).actualMinor,null);
 });
 const browser=await h.browser();ctx=await browser.newContext({viewport:{width:390,height:844}});ctx.setDefaultTimeout(15000);await ctx.addCookies(h.cookie(h.A).split('; ').map(v=>{const n=v.indexOf('=');return{name:v.slice(0,n),value:v.slice(n+1),url:h.base};}));const page=await ctx.newPage();await page.goto(h.base+'/problems/manage');const panel=page.getByRole('region',{name:'Consumo de agrupación',exact:true});await panel.waitFor();
 const click=async(name)=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/problems'&&r.request().method()==='POST');await panel.getByRole('button',{name,exact:true}).click();return response;};
 await check('browser changes limit, handles real stale CAS and stays disabled for inference',async()=>{
  await panel.getByLabel('Tipo de límite de agrupación',{exact:true}).selectOption('embedding');await panel.getByLabel('Límite de agrupación en USD',{exact:true}).fill('4');assert.equal((await click('Guardar límite de agrupación')).status(),200);
  const prior=(await get()).budget.limits.find(x=>x.purpose==='embedding');await ok(request(configure('embedding','5',{expectedVersion:prior.version})));
  await panel.getByLabel('Límite de agrupación en USD',{exact:true}).fill('6');assert.equal((await click('Guardar límite de agrupación')).status(),409);
  await panel.getByText(/Agrupación: 5.000000 USD/).waitFor();await panel.getByLabel('Límite de agrupación en USD',{exact:true}).fill('6');assert.equal((await click('Guardar límite de agrupación')).status(),200);
  assert.equal((await get()).configuration.enabled,false);await page.screenshot({path:path.join(evidence,'owner-budget-mobile.png'),fullPage:true});
 });
 await check('browser receipt consent binds exact fields and real reconciliation is idempotent',async()=>{
  await panel.getByLabel('Reserva de agrupación',{exact:true}).selectOption(current.id);await panel.getByLabel('Costo confirmado de agrupación en USD',{exact:true}).fill('0.000040');await panel.getByLabel('Huella SHA-256 del recibo de agrupación',{exact:true}).fill('b'.repeat(64));
  const consent=panel.getByLabel('Contrasté este costo de agrupación con evidencia del proveedor.',{exact:true});const submit=panel.getByRole('button',{name:'Conciliar costo de agrupación',exact:true});assert.equal(await submit.isEnabled(),false);await consent.check();await panel.getByLabel('Costo confirmado de agrupación en USD',{exact:true}).fill('0.000041');assert.equal(await consent.isChecked(),false);assert.equal(await submit.isEnabled(),false);await panel.getByLabel('Costo confirmado de agrupación en USD',{exact:true}).fill('0.000040');assert.equal(await consent.isChecked(),false,'CONSENT_REQUIRES_RECONFIRMATION');await consent.check();assert.equal((await click('Conciliar costo de agrupación')).status(),200);
  const row=(await get()).budget.reservations.find(x=>x.id===current.id);assert.equal(row.state,'settled');assert.equal(row.actualMinor,'40');assert.equal(h.sql(`SELECT count(*) FROM ai_budget_reconciliations WHERE reservation_id=${q(current.id)}`),'1');
  await ok(request(reconcileBody));assert.equal((await request({...reconcileBody,actualUsd:'0.000041'})).status,409);assert.equal(h.sql(`SELECT count(*) FROM ai_budget_reconciliations WHERE reservation_id=${q(current.id)}`),'1');
 });
 await check('old uncertain window remains reconcilable when configured window is absent',async()=>{
  await h.stopWeb();await h.startWeb(false,{...env,VEXA_PROBLEMS_CONFIG_JSON:'[]'});await page.reload();await panel.waitFor();await panel.getByText(/Falta configurar la ventana/).waitFor();assert.equal(await panel.getByRole('button',{name:'Guardar límite de agrupación',exact:true}).count(),0);
  await panel.getByLabel('Reserva de agrupación',{exact:true}).selectOption(older.id);await panel.getByLabel('Costo confirmado de agrupación en USD',{exact:true}).fill('0');await panel.getByLabel('Huella SHA-256 del recibo de agrupación',{exact:true}).fill('c'.repeat(64));await panel.getByLabel('Contrasté este costo de agrupación con evidencia del proveedor.',{exact:true}).check();assert.equal((await click('Conciliar costo de agrupación')).status(),200);
  const stored=h.json(`SELECT jsonb_build_object('state',state,'actual',actual_minor::text) FROM ai_budget_reservations WHERE id=${q(older.id)}`);assert.deepEqual(stored,{state:'settled',actual:'0'});assert.equal((await request(configure('embedding','1'))).status,503);
  assert.equal(h.sql(`SELECT actual_minor IS NULL FROM ai_budget_reservations WHERE id=${q(extractReservation.id)}`),'t');
 });
 await check('role loss clears financial controls in browser and denies mutation',async()=>{
  h.sql(`UPDATE memberships SET role='viewer',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);await page.getByRole('button',{name:'Actualizar problemas',exact:true}).click();await panel.waitFor({state:'detached'});assert.equal((await get()).budget,null);assert.equal((await request(reconcileBody)).status,403);await page.screenshot({path:path.join(evidence,'viewer-no-budget.png'),fullPage:true});
 });
 h.verifySources();report.status='pass';
}catch(error){report.status='fail';report.error={message:error.message,stack:error.stack};process.exitCode=1;}finally{if(ctx)await ctx.close();if(h)await h.close();if(fs.existsSync(path.join(evidence,'cleanup.json')))report.cleanup=JSON.parse(fs.readFileSync(path.join(evidence,'cleanup.json')));fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,evidence}));}
