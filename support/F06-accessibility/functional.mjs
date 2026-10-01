import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash,randomUUID} from 'node:crypto';
import {setup} from '../F06-notifications/harness.mjs';
import {seedDetail,detailQuery,detailReport} from '../F06-detail/fixtures.mjs';
import {missingLoadingStates,emptyInbox,hasPassedState} from './focal-states.mjs';
import {validateInheritance} from './coverage.mjs';import {scan} from './browser.mjs';import {notificationStates} from './states.mjs';import {preferencesPersistence,briefPersistence} from './actions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('F06-07 composed local SYN accessibility and action persistence; human judgment remains external',{timeout:900000},async()=>{
 assert.equal(process.versions.node.split('.')[0],'22','NODE22_REQUIRED');
 const candidate=process.env.VEXA_CANDIDATE,out=process.env.VEXA_F0607_EVIDENCE;
 assert.ok(out&&path.isAbsolute(out),'PRIVATE_EVIDENCE_DIRECTORY_REQUIRED');fs.mkdirSync(out,{recursive:true,mode:0o700});
 const playwright=process.env.VEXA_F0607_PLAYWRIGHT,axePath=process.env.VEXA_F0607_AXE;
 assert.ok(playwright&&fs.existsSync(playwright),'PINNED_LOCAL_PLAYWRIGHT_REQUIRED_NO_AUTO_INSTALL');assert.ok(axePath&&fs.existsSync(axePath),'PINNED_LOCAL_AXE_REQUIRED_NO_AUTO_INSTALL');
 const sourceRoot=process.env.VEXA_F0607_REUSE_ROOT,bindingsPath=process.env.VEXA_F0607_BINDINGS;
 assert.ok(sourceRoot&&bindingsPath,'INHERITED_BINDINGS_REQUIRED');const bindings=JSON.parse(fs.readFileSync(bindingsPath));
 for(const [file,hash]of Object.entries(bindings.files))assert.equal(sha(fs.readFileSync(path.join(sourceRoot,file))),hash,'INHERITED_EVIDENCE_CHANGED:'+file);
 const ledgerPath=process.env.VEXA_F0607_REVIEWED_LEDGER;assert.ok(ledgerPath,'REVIEWED_ROUTE_STATE_LEDGER_REQUIRED_BEFORE_INFRA');const ledger=JSON.parse(fs.readFileSync(ledgerPath));validateInheritance({candidate,root:sourceRoot,ledger,bindings});
 const report={task:'F06-07',status:'running',fixture:'SYN-A/B-existing-canonical-detail-v1',checks:[],humanVisual:'not_run',formalAcceptance:false,versions:{node:process.version,playwrightSha256:sha(fs.readFileSync(playwright)),axeSha256:sha(fs.readFileSync(axePath))},historicalErrors:'389/RSC remains historical FAIL; current scans never filter console errors',pending:['Human visual review','F06-12 accepted receipt and final source reconciliation','Route-state/action inheritance independent adjudication; no global coverage claim']};
 const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));const record=x=>{report.checks.push(x);save();};let h,browser;
 try{
  h=await setup(candidate,out);const f=await seedDetail(h,{beforeSnapshot:async x=>x.ok(h.request(h.A,'/api/workspace/customer-bindings',{customerKey:'C1',customerId:x.a.customers.C1,expectedVersion:0,active:true,report:detailReport,attested:true}))});
  const query=detailQuery(f.snapshot),workspace=await f.ok(h.request(h.A,'/api/workspace?'+query+'&resource=metrics'));query.set('scope_hash',workspace.meta.scope_hash);
  const recommendation=await f.ok(h.request(h.A,'/api/recommendations',{operation:'generate',query:query.toString(),problemId:f.p1.id,requestKey:randomUUID()}));await f.ok(h.request(h.A,'/api/recommendations/'+recommendation.id+'/interventions',{expectedVersion:recommendation.version,requestKey:randomUUID()}));
  const brief=await f.ok(h.request(h.A,'/api/briefs',{operation:'generate',query:query.toString(),comparisonQuery:null,expectedPreviousId:null,requestKey:randomUUID()}));
  report.fixtureIds={tenantA:h.A.tenant,tenantB:h.B.tenant,snapshot:f.snapshot.id,problem:f.p1.id,customer:f.a.customers.C1,brief:brief.id};report.fixtureHash=sha(JSON.stringify(report.fixtureIds));save();
  const views=['/overview','/problems','/problems/'+f.p1.id,'/customers/'+f.a.customers.C1,'/recommendations','/explorer','/interventions','/briefs/'+brief.id];
  const extra=['/notifications','/settings/notifications','/notifications/push','/settings/notification-delivery','/settings/team'];
  const engines=await import(pathToFileURL(playwright));
  for(const engine of ['chromium','webkit']){
   browser=await engines[engine].launch({headless:true});report.versions[engine]=browser.version();const context=await browser.newContext({reducedMotion:'reduce',timezoneId:'America/Merida'});context.setDefaultTimeout(15000);
   await context.addCookies(h.cookie(h.A).split('; ').map(v=>{const i=v.indexOf('=');return{name:v.slice(0,i),value:v.slice(i+1),url:h.base};}));
   const blocked=[];await context.route('**/*',r=>{if(!['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)){blocked.push(r.request().url());return r.abort();}return r.continue();});
   const page=await context.newPage();
   try{
    for(const viewport of [{width:390,height:844},{width:1440,height:900}])for(const route of [...views,...extra])record({...await scan({page,url:h.base+route+(views.includes(route)?'?'+query:''),viewport,axePath,out,engine,label:route}),route:route.replace(f.p1.id,'[id]').replace(f.a.customers.C1,'[id]').replace(brief.id,'[id]'),state:'ready'});
    await missingLoadingStates({page,h,query,brief,record});await emptyInbox({page,h,record});
    await notificationStates({page,h,record});await preferencesPersistence({page,h,record});await briefPersistence({page,h,f,query,record});
    assert.deepEqual(blocked,[],'OUTBOUND_BROWSER_ATTEMPT');
   }finally{await context.close();}
   const anon=await browser.newContext({reducedMotion:'reduce'});anon.setDefaultTimeout(15000);await anon.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());const publicPage=await anon.newPage();
   try{for(const viewport of [{width:390,height:844},{width:1440,height:900}])for(const route of ['/login','/login?error=oauth_cancelled','/auth/email/complete'])record({...await scan({page:publicPage,url:h.base+route,viewport,axePath,out,engine,label:route}),route:route.split('?')[0],state:route.includes('?error=')?'error':'ready'});}
   finally{await anon.close();await browser.close();browser=null;}
  }
  for(const row of ledger.filter(r=>r.requiredByF0607))for(const [state,item]of Object.entries(row.states))if(item.resolution==='current_run')assert.ok(hasPassedState(report.checks,row.route,state,item.scenario),'STATE_SCENARIO_NOT_EXECUTED:'+row.route+':'+state);
  h.verifySources();report.status='pass_scoped_automated_composition';
 }catch(error){report.status='fail';report.error={message:error.message,stack:error.stack};throw error;}
 finally{if(browser)await browser.close();if(h)await h.close();save();}
});
