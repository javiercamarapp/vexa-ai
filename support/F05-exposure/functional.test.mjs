import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {setup,q} from './harness.mjs';import {exposureFixture} from './fixtures.mjs';
const scope={start:'2026-09-01T00:00:00.000Z',end:'2026-09-20T00:00:00.000Z',currency:'USD',exponent:2,basis:'net_order_excluding_tax_shipping'};
const route='/api/economics';
const report='SYN documented operational evidence reviewed by an authorized owner; no inferred financial relation.';
const types={order:'order_export',refund:'payment_ledger',reversal:'payment_ledger',replacement:'replacement_invoice',support_model:'support_timesheet'};

test('F05-03 real evidence, authorized canonical union and operational exposure UI',{timeout:480000},async t=>{
 const candidate=process.env.VEXA_CANDIDATE;
 for(const f of ['packages/metrics/exposure.mjs','supabase/migrations/0019_economic_problem_links.sql','apps/web/src/components/economic-exposure-panel.tsx'])assert.ok(candidate&&fs.existsSync(path.join(candidate,f)),'F0503_IMPLEMENTATION_MISSING:'+f);
 assert.notEqual(fs.realpathSync(new URL('../../',import.meta.url)),fs.realpathSync(candidate),'CONTROL_CANDIDATE_DISTINCT');
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-exposure259-'));fs.chmodSync(evidence,0o700);let h;
 const step=async(name,work)=>{let failure;await t.test(name,async()=>{try{await work();}catch(e){failure=e;throw e;}});if(failure)throw new Error('EXPOSURE_PREREQUISITE:'+name,{cause:failure});};
 try{
  h=await setup(candidate,evidence);const fixture=await exposureFixture(h);
  const rawGet=(actor=h.A,s=scope)=>h.request(actor,route+'?'+new URLSearchParams(s));
  const get=async(actor=h.A,s=scope)=>{const r=await rawGet(actor,s);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data;};
  const post=(body,actor=h.A)=>h.request(actor,route,body);
  const save=async(body,actor=h.A)=>{const r=await post(body,actor);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data;};
  const sources={},orders=[],events=[];let problems,P1,P2,aliasOrder,owner,reader;
  const link=(problemId,row,extra={})=>({operation:'link',problemId,ledgerRowId:row.rowId,expectedVersion:0,active:true,report,attested:true,...extra});
  const declareCustomer=(row,customerKey,extra={})=>({operation:'orderCustomer',orderRowId:row.rowId,customerKey,expectedVersion:0,report,attested:true,...extra});
  const alias=(a,c,extra={})=>({operation:'orderAlias',aliasRowId:a.rowId,canonicalRowId:c.rowId,expectedVersion:0,active:true,report,attested:true,...extra});
  const record=(kind,externalId,amountMinor,extra={})=>({operation:'record',sourceId:sources[types[kind]].id,sourceVersion:1,expectedRevision:0,externalId,kind,effectiveAt:'2026-09-12T12:00:00.000Z',currency:'USD',exponent:2,basis:scope.basis,amountMinor,status:kind==='order'?'recorded':kind==='support_model'?'modeled':'settled',orderId:null,reversalOf:null,details:{},report,attested:true,...extra});
  const attest=async(actor=h.A,complete=true)=>{const v=await get(actor);const x=v.exposure;assert.ok(x?.inputHash,'EXPOSURE_CONTRACT_INPUT_HASH');return save({operation:'relationCoverage',scope:{...scope,timezone:'UTC',dateBasis:'occurred_at'},expectedInputHash:x.inputHash,expectedVersion:x.coverage?.version??0,complete,report,attested:true},actor);};
  const metrics=v=>{assert.ok(v.exposure?.metrics,'EXPOSURE_CONTRACT_METRICS');return v.exposure.metrics;};

  await step('authorized vector problems and persisted synthetic ledger establish real evidence',async()=>{
   for(const type of ['order_export','payment_ledger','replacement_invoice','support_timesheet'])sources[type]=await save({operation:'source',expectedVersion:0,name:'SYN exposure '+type,evidenceType:type,active:true,complete:true,windowStart:scope.start,windowEnd:scope.end,watermark:scope.end,report,attested:true});
   for(const [externalId,amountMinor] of [['SYN-O1','10000'],['SYN-O2','20000'],['SYN-O3',null]])orders.push(await save(record('order',externalId,amountMinor)));
   const r=await save(record('refund','SYN-R1','2000',{orderId:orders[0].id}));events.push(r);
   events.push(await save(record('reversal','SYN-V1','-500',{orderId:orders[0].id,reversalOf:r.id})));
   events.push(await save(record('replacement','SYN-K1','1200',{orderId:orders[0].id})));
   events.push(await save(record('support_model','SYN-S1',null,{orderId:orders[0].id,details:{durationSeconds:'600',rateMinorPerMinute:'50',rateVersion:'SYN-rate1',unit:'minute',validFrom:scope.start,validUntil:scope.end,rateEvidence:report,approved:true}})));
   problems=[await fixture.problem(h.A,'SYN P1 exposure'),await fixture.problem(h.A,'SYN P2 exposure'),await fixture.problem(h.B,'SYN B private exposure')];[P1,P2]=problems.map(p=>p.id);
   const v=await get();assert.ok(v.exposure.problemOptions.some(p=>p.id===P1));assert.ok(!v.exposure.problemOptions.some(p=>p.id===problems[2].id));
   reader={...h.B,tenant:h.A.tenant,role:'viewer'};h.sql(`INSERT INTO memberships(tenant_id,user_id,role,status,permissions_version) VALUES(${q(h.A.tenant)},${q(h.B.id)},'viewer','active',7)`);owner={...h.bot,tenant:h.A.tenant,role:'owner'};h.sql(`UPDATE memberships SET role='owner',status='active' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(owner.id)}`);
  });

  await step('relationship coverage is explicit and union is P1=30000 P2=10000 global=30000',async()=>{
   await save(link(P1,orders[0]));await save(link(P1,orders[1]));await save(link(P2,orders[0]));
   let v=await get();assert.equal(metrics(v).global.amountMinor,null,'ORDER_COMPLETENESS_DOES_NOT_PROVE_RELATION_COVERAGE');assert.equal(metrics(v).global.knownSubtotalMinor,'30000');
   await attest();v=await get();const x=metrics(v);
   assert.equal(x.byProblem[P1].amountMinor,'30000');assert.equal(x.byProblem[P2].amountMinor,'10000');assert.equal(x.global.amountMinor,'30000','UNION_NOT_SUM40000');assert.equal(x.global.totalCount,2);assert.equal(x.problemRowsAreAdditive,false);
   assert.equal(v.bundle.metrics.allOrders.amountMinor,null);assert.equal(v.bundle.metrics.allOrders.knownSubtotalMinor,'30000');assert.equal(v.bundle.metrics.allOrders.knownCount,2);assert.equal(v.bundle.metrics.allOrders.totalCount,3);
   assert.equal(x.customerExposure.global.count,null,'NO_INVENTED_CUSTOMER_IDENTITIES');assert.equal(x.customerExposure.global.knownCount,0);
  });

  await step('causal calibration rejects summing problem rows as global money and restores original result',async()=>{
   const modulePath=path.join(h.built,'packages/metrics/exposure.mjs'),source=fs.readFileSync(modulePath,'utf8'),target='return {inputHash,scope,';
   assert.equal(source.split(target).length,2,'EXPOSURE_MUTATION_TARGET_UNIQUE');const database=h.repository(h.A).database;
   const oracle=async module=>{const view=await database.transaction('read',s=>module.readExposure(s,{scope:{...scope,timezone:'UTC',dateBasis:'occurred_at'}}));assert.equal(view.metrics.global.amountMinor,'30000','EXPOSURE_GLOBAL_UNION_NOT_SUM40000');};
   const original=await import(pathToFileURL(modulePath));await oracle(original);const mutantPath=path.join(h.built,'packages/metrics/exposure-global-mutant259.mjs');
   try{fs.writeFileSync(mutantPath,source.replace(target,"metrics.global.amountMinor=Object.values(metrics.byProblem).reduce((sum,row)=>sum+BigInt(row.amountMinor??'0'),0n).toString();"+target));const mutant=await import(pathToFileURL(mutantPath));let killed;try{await oracle(mutant);}catch(error){killed=error;}assert.equal(killed?.code,'ERR_ASSERTION','EXPOSURE_MUTANT_MUST_FAIL_FINANCIAL_ASSERTION_NOT_SETUP');assert.match(killed.message,/EXPOSURE_GLOBAL_UNION_NOT_SUM40000/);await oracle(original);fs.writeFileSync(path.join(evidence,'mutant-calibration.json'),JSON.stringify({before:0,mutant:1,after:0,oracle:'EXPOSURE_GLOBAL_UNION_NOT_SUM40000'}),{mode:0o600});console.log('F0503_MUTANT_UNION:0->1->0');}
   finally{fs.rmSync(mutantPath,{force:true});}
  });

  await step('duplicate relations and reverse arrival preserve IDs, coverage and stable amounts',async()=>{
   for(const [p,o] of [[P2,orders[0]],[P1,orders[1]],[P1,orders[0]]]){const r=await post(link(p,o));assert.ok([200,409].includes(r.status),'REPLAY_IDEMPOTENT_OR_EXPLICIT_CAS');}
   await attest();const x=metrics(await get());assert.equal(x.global.amountMinor,'30000');assert.equal(x.global.totalCount,2);assert.equal(x.byProblem[P1].amountMinor,'30000');
   const before=(await get()).exposure.inputHash;const fresh=(await get()).exposure.inputHash;assert.equal(fresh,before,'INPUT_HASH_DOES_NOT_CHANGE_WITH_CLOCK');
  });

  await step('human-confirmed order aliases collapse duplicate identity and reject incompatible money',async()=>{
   aliasOrder=await save(record('order','SYN-O1-migration-copy','10000'));await save(link(P2,aliasOrder));
   const beforeAlias=await get();assert.equal(metrics(beforeAlias).global.amountMinor,null,'INPUT_CHANGE_INVALIDATES_COVERAGE');assert.equal(beforeAlias.bundle.metrics.allOrders.knownSubtotalMinor,'40000','RAW_DISTINCT_ORDERS_BEFORE_ALIAS');
   assert.equal((await post(alias(aliasOrder,orders[1]))).status,409,'INCOMPATIBLE_ORDER_AMOUNTS_CANNOT_ALIAS');
   await save(alias(aliasOrder,orders[0]),owner);await attest();const x=metrics(await get());
   assert.equal(x.global.amountMinor,'30000');assert.equal(x.global.totalCount,2);assert.equal(x.byProblem[P2].amountMinor,'10000');const all=(await get()).bundle.metrics.allOrders;assert.equal(all.amountMinor,null);assert.equal(all.knownSubtotalMinor,'30000','ALL_ORDER_CARD_SHARES_CANONICAL_IDENTITY');assert.equal(all.totalCount,3);
   assert.ok([200,409].includes((await post(alias(aliasOrder,orders[0]))).status));
  });

  await step('explicit C1 identity unions customers independently from order money and distinct events',async()=>{
   await save(declareCustomer(orders[0],'SYN-C1'),owner);await save(declareCustomer(orders[1],'SYN-C1'),owner);
   assert.equal(metrics(await get()).global.amountMinor,null,'CUSTOMER_CHANGE_INVALIDATES_SCOPE_ATTESTATION');
   for(const event of events){await save(link(P1,event));await save(link(P2,event));}
   await attest();const x=metrics(await get());
   assert.equal(x.global.amountMinor,'30000');assert.equal(x.customerExposure.global.count,1);assert.equal(x.customerExposure.global.knownCount,1);assert.equal(x.customerExposure.global.totalOrderCount,2);
   assert.deepEqual(x.customerExposure.global.customerKeys,['SYN-C1']);
   assert.equal(x.eventUnion.global.refunds.amountMinor,'1500','EVENT_UNION_NOT_PROBLEM_SUM3000');
   assert.equal(x.eventUnion.global.replacement.amountMinor,'1200');assert.equal(x.eventUnion.global.supportModel.amountMinor,'500');
   assert.equal(new Set(x.eventUnion.global.eventIds).size,4);assert.equal(x.eventUnion.global.eventIds.length,4);
   assert.equal(x.eventUnion.byProblem[P1].refunds.amountMinor,'1500');assert.equal(x.eventUnion.byProblem[P2].refunds.amountMinor,'1500');assert.equal(x.eventUnion.problemRowsAreAdditive,false);
  });

  await step('customer totals require source completeness and shared coverage is independent of reader permission version',async()=>{
   const before=await get(),other=await get(reader);assert.equal(other.exposure.inputHash,before.exposure.inputHash,'READER_PERMISSION_VERSION_NOT_SHARED_DATA_IDENTITY');assert.equal(other.exposure.coverage.current,true,'COVERAGE_IS_SHARED_BY_AUTHORIZED_READERS');assert.equal(metrics(other).global.amountMinor,'30000');
   const source=sources.order_export;const update=complete=>({operation:'source',sourceId:source.id,expectedVersion:complete?2:1,name:source.name,evidenceType:'order_export',active:true,complete,windowStart:scope.start,windowEnd:scope.end,watermark:scope.end,report,attested:true});
   await save(update(false));await attest();let x=metrics(await get());assert.equal(x.global.amountMinor,null);assert.equal(x.customerExposure.global.count,null,'INCOMPLETE_ORDER_SOURCE_CANNOT_PROVE_CUSTOMER_TOTAL');assert.equal(x.customerExposure.global.knownCount,1);
   await save(update(true));await attest();assert.equal(metrics(await get()).customerExposure.global.count,1);
   await attest(h.B);x=metrics(await get(h.B));assert.equal(x.customerExposure.global.count,null,'ABSENT_ORDER_SOURCE_CANNOT_PROVE_ZERO_CUSTOMERS');assert.equal(x.customerExposure.global.knownCount,0);
  });

  await step('unknown linked O3 reduces money and customer coverage rather than inventing zero or identity',async()=>{
   await save(link(P2,orders[2]));await attest();const x=metrics(await get());
   assert.equal(x.global.amountMinor,null);assert.equal(x.global.knownSubtotalMinor,'30000');assert.equal(x.global.knownCount,2);assert.equal(x.global.totalCount,3);
   assert.equal(x.byProblem[P2].amountMinor,null);assert.equal(x.byProblem[P2].knownSubtotalMinor,'10000');
   assert.equal(x.customerExposure.global.count,null);assert.equal(x.customerExposure.global.knownCount,1);assert.equal(x.customerExposure.global.knownOrderCount,2);assert.equal(x.customerExposure.global.totalOrderCount,3);
  });

  await step('withdrawn problem evidence cannot leave a current complete exposure row',async()=>{
   h.sql(`UPDATE connections SET status='disconnected' WHERE id=${q(problems[0].extraction.a.connection)}`);
   try{const r=await rawGet();assert.ok([200,403,404,409].includes(r.status),'EVIDENCE_WITHDRAWAL_MUST_FAIL_CLOSED_NOT_SERVER_ERROR');if(r.status===200){const x=r.data.data.exposure;assert.ok(!x.problemOptions.some(p=>p.id===P1));assert.notEqual(x.metrics.byProblem[P1]?.amountMinor,'30000','WITHDRAWN_EVIDENCE_CANNOT_KEEP_CONFIRMED_TOTAL');for(const relation of x.relations.filter(v=>v.problemId===P1)){assert.equal(relation.valid,false);assert.equal(relation.report,null);}}}
   finally{h.sql(`UPDATE connections SET status='active' WHERE id=${q(problems[0].extraction.a.connection)}`);}
   await attest();
  });

  await step('scope CAS, tenant/current role, CSRF and current contributing actor are enforced',async()=>{
   const v=await get();assert.equal((await post({operation:'relationCoverage',scope:{...scope,timezone:'UTC',dateBasis:'occurred_at'},expectedInputHash:'0'.repeat(64),expectedVersion:v.exposure.coverage.version,complete:true,report,attested:true})).status,409,'STALE_INPUT_HASH_DENIED');
   assert.equal((await h.request(null,route+'?'+new URLSearchParams(scope))).status,401);
   assert.equal((await post({...link(P1,orders[0]),tenantId:h.B.tenant})).status,400);
   assert.ok([403,404,409].includes((await post(link(P1,orders[0]),h.B)).status));
   const csrf=await fetch(h.base+route,{method:'POST',headers:{cookie:h.cookie(h.A),'content-type':'application/json'},body:JSON.stringify(link(P1,orders[0]))});assert.equal(csrf.status,403);
   for(const role of ['viewer','analyst','operator']){h.sql(`UPDATE memberships SET role=${q(role)} WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);assert.equal((await post(link(P1,orders[0]))).status,403);assert.equal((await rawGet()).status,200);}
   h.sql(`UPDATE memberships SET role='owner' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
   assert.ok(!(await get(h.B)).exposure.problemOptions.some(p=>p.id===P1));
   h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(owner.id)}`);
   try{const revokedView=await get();assert.equal(revokedView.bundle.metrics.allOrders.knownSubtotalMinor,null,'REVOKED_ALIAS_CANNOT_KEEP_CANONICAL_ALL_ORDERS_SUBTOTAL');for(const binding of revokedView.exposure.customerBindings){assert.equal(binding.valid,false,'REVOKED_BINDING_INVALID');assert.equal(binding.report,null,'REVOKED_CONTRIBUTOR_REPORT_NOT_EXPOSED');}const current=metrics(revokedView);assert.equal(current.customerExposure.global.count,null,'REVOKED_CUSTOMER_CONTRIBUTOR_NOT_CURRENT');assert.equal(current.customerExposure.global.knownCount,0);assert.equal(current.global.amountMinor,null,'CONTRIBUTOR_CHANGE_INVALIDATES_COVERAGE');}
   finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(owner.id)}`);}
   await attest();
  });

  await step('real UI records identities, confirms and withdraws aliases, links and coverage',async()=>{
   const browser=await h.browser(),ctx=await browser.newContext({timezoneId:'America/Merida'});ctx.setDefaultTimeout(12000);h.ctx=ctx;
   await ctx.addCookies(h.cookie(h.A).split('; ').map(v=>{const i=v.indexOf('=');return{name:v.slice(0,i),value:v.slice(i+1),url:h.base};}));
   const page=await ctx.newPage();h.page=page;await page.goto(h.base+'/overview');
   const ledger=page.getByRole('region',{name:'Ledger económico',exact:true});await ledger.getByLabel('Fin exclusivo UTC',{exact:true}).fill('2026-09-20');
   const panel=page.getByRole('region',{name:'Exposición por problemas',exact:true});await panel.getByRole('heading',{name:'Exposición por problemas',exact:true}).waitFor();
   const action=async button=>{const posted=page.waitForResponse(r=>new URL(r.url()).pathname===route&&r.request().method()==='POST');const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname===route&&r.request().method()==='GET');await button.click();assert.equal((await posted).status(),200);assert.equal((await refreshed).status(),200);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
   const linkConsent=async()=>{await panel.getByLabel(/^Evidencia de el vínculo/).fill(report);await panel.getByLabel('Revisé y apruebo el vínculo',{exact:true}).check();};
   const cover=async()=>{const details=panel.locator('details').filter({has:page.getByText('Revisar cobertura de vínculos',{exact:true})});if(!await details.evaluate(e=>e.open))await details.locator('summary').click();await panel.getByLabel('Confirmo que revisé todas las relaciones de esta ventana',{exact:true}).check();await panel.getByLabel(/^Evidencia de la cobertura de vínculos/).fill(report);await panel.getByLabel('Revisé y apruebo la cobertura de vínculos',{exact:true}).check();await action(panel.getByRole('button',{name:'Guardar revisión de cobertura',exact:true}));};
   await panel.getByLabel(/^Problema/).selectOption(P2);await panel.getByLabel(/^Registro económico documentado/).selectOption(orders[2].rowId);await linkConsent();await action(panel.getByRole('button',{name:'Retirar vínculo',exact:true}));
   await cover();assert.match(await panel.getByRole('article',{name:'Exposición global de órdenes',exact:true}).innerText(),/300\.00 USD/);
   await panel.getByLabel(/^Registro económico documentado/).selectOption(orders[1].rowId);await linkConsent();await action(panel.getByRole('button',{name:'Vincular registro económico',exact:true}));await cover();assert.equal(metrics(await get()).byProblem[P2].amountMinor,'30000');
   await linkConsent();await action(panel.getByRole('button',{name:'Retirar vínculo',exact:true}));await cover();assert.equal(metrics(await get()).byProblem[P2].amountMinor,'10000');
   await panel.getByText('Confirmar equivalencia de órdenes',{exact:true}).click();await panel.getByLabel(/^Orden duplicada/).selectOption(aliasOrder.rowId);await panel.getByLabel(/^Orden canónica/).selectOption(orders[0].rowId);
   const aliasConsent=async()=>{await panel.getByLabel(/^Evidencia de la equivalencia/).fill(report);await panel.getByLabel('Revisé y apruebo la equivalencia',{exact:true}).check();};
   await aliasConsent();await action(panel.getByRole('button',{name:'Retirar equivalencia',exact:true}));await cover();const withdrawn=await get();assert.equal(metrics(withdrawn).global.amountMinor,'40000','WITHDRAWING_IDENTITY_RESTORES_DISTINCT_ORDER');assert.equal(withdrawn.bundle.metrics.allOrders.knownSubtotalMinor,'40000');
   await aliasConsent();await action(panel.getByRole('button',{name:'Guardar equivalencia de órdenes',exact:true}));await cover();const restored=await get();assert.equal(metrics(restored).global.amountMinor,'30000');assert.equal(restored.bundle.metrics.allOrders.knownSubtotalMinor,'30000');
   await panel.getByText('Identidad de cliente declarada',{exact:true}).click();await panel.getByLabel(/^Orden con identidad de cliente/).selectOption(orders[0].rowId);await panel.getByLabel('Clave canónica del cliente',{exact:true}).fill('SYN-C1');await panel.getByLabel(/^Evidencia de la identidad del cliente/).fill(report);await panel.getByLabel('Revisé y apruebo la identidad del cliente',{exact:true}).check();await action(panel.getByRole('button',{name:'Guardar identidad del cliente',exact:true}));await cover();
   assert.equal(metrics(await get()).customerExposure.global.count,1);assert.match(await panel.getByRole('article',{name:'Clientes únicos vinculados',exact:true}).innerText(),/1 clientes únicos/);
   assert.match(await panel.getByRole('article',{name:'Reembolsos asociados netos',exact:true}).innerText(),/15\.00 USD/);
   assert.ok(await panel.getByText('Fila no aditiva: una orden puede aparecer en varios problemas.',{exact:true}).count()>=2);
   await panel.getByText('Ver registros y evidencia',{exact:true}).first().click();await panel.getByRole('heading',{name:'SYN-O1 · Orden',exact:true}).waitFor();
   const p1=panel.getByRole('region',{name:'SYN P1 exposure',exact:true});await p1.getByText('Eventos asociados a este problema, no aditivos',{exact:true}).click();assert.match(await p1.getByRole('article',{name:'Reembolsos del problema',exact:true}).innerText(),/15\.00 USD/);
   await page.screenshot({path:path.join(evidence,'exposure-real-controls.png'),fullPage:true});
  });

  await step('late successful GET cannot restore exposure after current POST403 revocation',async()=>{
   const page=h.page,ledger=page.getByRole('region',{name:'Ledger económico',exact:true}),panel=page.getByRole('region',{name:'Exposición por problemas',exact:true});
   await panel.getByLabel(/^Problema/).selectOption(P2);await panel.getByLabel(/^Registro económico documentado/).selectOption(orders[1].rowId);await panel.getByLabel(/^Evidencia de el vínculo/).fill(report);await panel.getByLabel('Revisé y apruebo el vínculo',{exact:true}).check();
   let release,seen;const held=new Promise(r=>release=r),started=new Promise(r=>seen=r);let captured=false;
   await page.route('**/api/economics?*',async r=>{if(!captured){captured=true;const response=await r.fetch();assert.equal(response.status(),200);const body=await response.body();seen();await held;await r.fulfill({status:200,contentType:'application/json',body});}else await r.continue();});
   await ledger.getByRole('button',{name:'Actualizar ledger',exact:true}).click();await started;
   h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
   const denied=page.waitForResponse(r=>new URL(r.url()).pathname===route&&r.request().method()==='POST');await panel.locator('form').first().evaluate(form=>form.requestSubmit());assert.equal((await denied).status(),403);
   await ledger.getByText('Autorización revocada para el ledger.',{exact:true}).waitFor();const old=page.waitForResponse(r=>new URL(r.url()).pathname===route&&r.status()===200);release();await old;
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await ledger.getByRole('region',{name:'Exposición por problemas',exact:true}).count(),0,'LATE200_CANNOT_REPOPULATE_PRIVATE_EXPOSURE');assert.equal(await ledger.locator('article').count(),0);
   await page.screenshot({path:path.join(evidence,'exposure-revoked-late200.png'),fullPage:true});
  });
  h.verifySources();
 }finally{if(h?.page&&!h.page.isClosed()){fs.writeFileSync(path.join(evidence,'last-dom.html'),await h.page.content().catch(()=>''));await h.page.screenshot({path:path.join(evidence,'last-ui.png'),fullPage:true}).catch(()=>{});}if(h)await h.close();console.log('F0503_EVIDENCE:'+evidence);}
});
