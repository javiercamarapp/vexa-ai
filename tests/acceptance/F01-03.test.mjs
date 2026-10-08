import * as businessNotifications from './support/F01-03/business-notification-oracles.mjs';
import * as push from './support/F01-03/push-oracles.mjs';
import * as email from './support/F01-03/email-oracles.mjs';
import * as outbox from './support/F01-03/outbox-oracles.mjs';
import * as crmWebhooks from './support/F01-03/crm-webhooks/oracles.mjs';
import * as releaseTables from './support/F01-03/release-tables/oracles.mjs';
import * as notifications from './support/F01-03/notification-oracles.mjs';
import * as briefs from './support/F01-03/brief-oracles.mjs';
import * as interventions from './support/F01-03/intervention-oracles.mjs';
import * as recommendations from './support/F01-03/recommendation-oracles.mjs';
import * as detail from './support/F01-03/detail-oracles.mjs';
import * as workspace from './support/F01-03/workspace-oracles.mjs';
import * as priority from './support/F01-03/priority-oracles.mjs';
import * as snapshots from './support/F01-03/snapshot-oracles.mjs';
import * as money from './support/F01-03/money-oracles.mjs';
import * as exposure from './support/F01-03/exposure-oracles.mjs';
import * as economic from './support/F01-03/economic-oracles.mjs';
import * as causality from './support/F01-03/causality-oracles.mjs';
import * as problems from './support/F01-03/problems-oracles.mjs';
import * as crm from './support/F01-03/crm-runtime/oracles.mjs';
import * as extraction from './support/F01-03/extraction-oracles.mjs';
import * as budget from './support/F01-03/budget-oracles.mjs';
import * as health from './support/F01-03/health/oracles.mjs';
import * as aliases from './support/F01-03/aliases/oracles.mjs';
import * as sync from './support/F01-03/sync/oracles.mjs';
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {candidateInputs,launch,write,denied} from './support/F01-03/harness.mjs';
import {definitions,relations,insert,q} from './support/F01-03/matrix.mjs';
import {A,B,identityOracle,schemaOracle,seed,tableOracle,fkOracle,revokeOracle,foreignKeys,discoveredFkOracle} from './support/F01-03/oracles.mjs';
import * as history from './support/F01-03/source-history/oracles.mjs';
import * as workers from './support/F01-03/worker-delegations/oracles.mjs';
import * as uploads from './support/F01-03/import-uploads/oracles.mjs';
import {serviceOracle} from './support/F01-03/services.mjs';

// Keep every oracle and its order, but give setup/core, domain and FK/services
// separate deadlines. Shared fixtures are local to this process; downstream
// stages fail closed if an earlier assertion failed. No skip/filter is allowed.
let h,migrations,actors,f,stage=0,prerequisiteFailed=false;
after(async()=>{if(h)await h.close();});
const check=(t,name,fn)=>t.test(name,async()=>{try{return await fn();}catch(error){prerequisiteFailed=true;throw error;}});
test('F01-03 part 1: real migrations and core SQL authorization', {timeout:600000},async t=>{
  migrations=candidateInputs(process.env.VEXA_CANDIDATE);
  h=await launch({services:true});
  for(const migration of migrations)h.sql(migration);
  releaseTables.requireTables(h,migrations.releaseTablesRequired);
  h.sql("NOTIFY pgrst, 'reload schema';");
  if(migrations.workerDelegationsRequired)assert.ok(workers.present(h),'WORKER_MIGRATION_REQUIRED');
  if(migrations.syncRequired)assert.deepEqual(sync.present(h),sync.tables,'SYNC_MIGRATION_REQUIRED');
  if(migrations.aliasesRequired)assert.ok(aliases.present(h),'ALIAS_MIGRATION_REQUIRED');
  if(migrations.healthRequired)assert.ok(health.present(h),'HEALTH_MIGRATION_REQUIRED');
  if(migrations.budgetRequired)assert.deepEqual(budget.present(h),budget.tables,'BUDGET_MIGRATION_REQUIRED');
  if(migrations.extractionRequired)assert.deepEqual(extraction.present(h),extraction.tables,'EXTRACTION_MIGRATION_REQUIRED');
  if(migrations.crmRequired)assert.ok(crm.present(h),'CRM_MIGRATION_REQUIRED');
  if(migrations.crmWebhooksRequired)assert.ok(crmWebhooks.present(h),'CRM_WEBHOOK_MIGRATION_REQUIRED');
  if(migrations.problemsRequired)assert.deepEqual(problems.present(h),problems.tables,'PROBLEM_MIGRATION_REQUIRED');
  if(migrations.causalityRequired)assert.deepEqual(causality.present(h),causality.tables,'CAUSAL_MIGRATION_REQUIRED');
  if(migrations.economicRequired)assert.deepEqual(economic.present(h),economic.tables,'ECONOMIC_MIGRATION_REQUIRED');
  if(migrations.exposureRequired)assert.deepEqual(exposure.present(h),exposure.tables,'EXPOSURE_MIGRATION_REQUIRED');
  if(migrations.moneyRequired)assert.deepEqual(money.present(h),money.tables,'MONEY_MIGRATION_REQUIRED');
  if(migrations.interventionsRequired)assert.deepEqual(interventions.present(h),interventions.tables,'INTERVENTION_MIGRATION_REQUIRED');
  if(migrations.recommendationsRequired)assert.deepEqual(recommendations.present(h),recommendations.tables,'RECOMMENDATION_MIGRATION_REQUIRED');
  if(migrations.detailRequired)assert.deepEqual(detail.present(h),detail.tables,'DETAIL_MIGRATION_REQUIRED');
  if(migrations.workspaceRequired)assert.deepEqual(workspace.present(h),workspace.tables,'WORKSPACE_MIGRATION_REQUIRED');
  if(migrations.priorityRequired)assert.deepEqual(priority.present(h),priority.tables,'PRIORITY_MIGRATION_REQUIRED');
  if(migrations.snapshotsRequired)assert.deepEqual(snapshots.present(h),snapshots.tables,'SNAPSHOT_MIGRATION_REQUIRED');
  if(migrations.briefsRequired)assert.deepEqual(briefs.present(h),briefs.tables,'BRIEF_MIGRATION_REQUIRED');
  if(migrations.outboxRequired)assert.deepEqual(outbox.present(h),outbox.tables,'OUTBOX_MIGRATION_REQUIRED');
  if(migrations.emailRequired)assert.deepEqual(email.present(h),email.tables,'EMAIL_MIGRATION_REQUIRED');
  if(migrations.pushRequired)assert.deepEqual(push.present(h),push.tables,'PUSH_MIGRATION_REQUIRED');
  if(migrations.businessNotificationsRequired)assert.equal(businessNotifications.present(h),true,'BUSINESS_NOTIFICATION_MIGRATION_REQUIRED');
  if(migrations.notificationsRequired)assert.deepEqual(notifications.present(h),notifications.tables,'NOTIFICATIONS_MIGRATION_REQUIRED');
  schemaOracle(h);
  actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
  f=seed(h,actors);
  history.seedHistory(h,f);
  if(sync.present(h).length){f.sync=sync.seed(h,f,actors);await check(t,'sync008 backend raw authorization',()=>sync.access(h,f.sync,actors));}
  if(health.present(h)){f.health=health.seed(h,f,actors);await check(t,'health0010 summary authorization',()=>health.access(h,f.health,actors));}
  if(history.present(h).length)await check(t,'source history backend authorization',()=>history.access(h,f,actors));
  if(history.present(h).includes('source_heads'))await check(t,'owner selection fence cannot bypass via SQL',()=>history.selectionFence(h,f,actors));
  if(uploads.present(h)){
    f.importUploads=uploads.seedUploads(h,f,actors);
    await check(t,'import_uploads owner and backend authorization',()=>uploads.access(h,f.importUploads,actors));
  }
  if(workers.present(h)){
    f.workers=workers.seedWorkers(h,actors);
    for(const [name,oracle] of Object.entries(workers.checks))await check(t,'worker delegation '+name,()=>oracle(h,f,actors));
  }
  await check(t,"identity tables",()=>identityOracle(h,actors));
  for(const [table] of definitions)await check(t,'functional RLS '+table,()=>tableOracle(h,table,f,actors));
  if(crm.present(h)){f.crm=crm.seed(h,f,actors);await check(t,'CRM settings0013 authorization and dispatch',()=>crm.access(h,f.crm,actors));}
  if(crmWebhooks.present(h)){f.crmWebhooks=crmWebhooks.seed(h,f,actors);await check(t,'CRM webhooks0040 current scope grants and immutable receipts',()=>crmWebhooks.access(h,f.crmWebhooks,actors));}
  if(extraction.present(h).length){f.extraction=extraction.seed(h,f,actors);await check(t,'extraction0012 private maps and claims authorization',()=>extraction.access(h,f.extraction,actors));}
  if(budget.present(h).length){f.budget=budget.seed(h,f,actors);await check(t,'budget0011 authorization and reconciliation',()=>budget.access(h,f.budget,actors));}
  for(const relation of relations)await check(t,`required FK ${relation.table}.${relation.column}`,()=>fkOracle(h,f,relation));
  if(!prerequisiteFailed&&!t.signal.aborted)stage=1;
});
test('F01-03 part 2: domain authorization and durable fixtures', {timeout:600000},async t=>{
  assert.equal(stage,1,'SQL_CORE_PREREQUISITE');
  if(problems.present(h).length){f.problemVectors=problems.seed(h,f,actors);await check(t,'problems0016 authorization',()=>problems.access(h,f.problemVectors,actors));}
  if(causality.present(h).length){f.causality=causality.seed(h,f,actors);await check(t,'causality0017 authorization',()=>causality.access(h,f.causality,actors));await check(t,'causality0017 scoped contributor helper',()=>causality.contributor(h,f.causality,actors));}
  if(economic.present(h).length){f.economic=economic.seed(h,f,actors);await check(t,'economic0018 authorization and append-only',()=>economic.access(h,f.economic,actors));await check(t,'economic0018 exact amounts state source and CAS',()=>economic.financial(h,f.economic,actors));}
  if(exposure.present(h).length){f.exposure=exposure.seed(h,f,actors);await check(t,'exposure0019 authorization and append-only',()=>exposure.access(h,f.exposure,actors));await check(t,'exposure0019 identity and CAS',()=>exposure.identity(h,f.exposure,actors));await check(t,'exposure0019 contributor revocation',()=>exposure.contributor(h,f.exposure,actors));}
  if(money.present(h).length){f.money=money.seed(h,f,actors);await check(t,'money0020 authorization and append-only',()=>money.access(h,f.money,actors));await check(t,'money0020 catalog FX provenance versions and contributors',()=>money.versions(h,f.money,actors));}
  if(snapshots.present(h).length){f.snapshots=snapshots.seed(h,f,actors);await check(t,'snapshots0021 private drafts and current authorization',()=>snapshots.visibility(h,f.snapshots,actors));await check(t,'snapshots0021 exact money metadata and identity',()=>snapshots.metadata(h,f.snapshots,actors));await check(t,'snapshots0021 atomic publication and immutable history',()=>snapshots.integrity(h,f.snapshots,actors));await check(t,'snapshots0021 digest timezone independence',()=>snapshots.timezones(h,f.snapshots,actors));await check(t,'snapshots0021 withdrawn source privacy',()=>snapshots.withdrawal(h,f.snapshots,actors));}
  if(priority.present(h).length){f.priority=priority.seed(h,f,actors,f.snapshots);await check(t,'priority0022 tenant current actors and roles',()=>priority.access(h,f.priority,actors));await check(t,'priority0022 exact policy versions and actionability CAS',()=>priority.versions(h,f.priority,actors));await check(t,'priority0022 publication integrity rollback and immutable history',()=>priority.integrity(h,f.priority,actors));await check(t,'priority0022 scoped metadata head and revocation recovery',()=>priority.heads(h,f.priority,actors));await check(t,'priority0022 historical input republished with new version',()=>priority.rollbackPolicy(h,f.priority,actors));}
  if(workspace.present(h).length){f.workspace=await workspace.seed(h,f,actors,f.snapshots);await check(t,'workspace0023 tenant roles and current mapping contributors',()=>workspace.access(h,f.workspace,actors));await check(t,'workspace0023 mapping and immutable binding integrity',()=>workspace.integrity(h,f.workspace,actors));}
  if(detail.present(h).length){f.detail=await detail.seed(h,f,actors,f.workspace);await check(t,'detail0024 tenant roles and private identities',()=>detail.access(h,f.detail,actors));await check(t,'detail0024 approved identity CAS cutoff and immutable receipt',()=>detail.integrity(h,f.detail,actors));await check(t,'detail0024 complete conversation identity manifest',()=>detail.conversationCompleteness(h,f,actors,f.workspace));}
  if(recommendations.present(h).length){f.recommendations=await recommendations.seed(h,f,actors,f.workspace);await check(t,'recommendations0025 tenant current roles capabilities',()=>recommendations.access(h,f.recommendations,actors));await check(t,'recommendations0025 captured evidence CAS history draft only',()=>recommendations.integrity(h,f.recommendations,actors));await check(t,'recommendations0025 withdrawn evidence cannot certify writes',()=>recommendations.sourceAuthorization(h,f.recommendations,actors));await check(t,'recommendations0025 scoped helper privileges',()=>recommendations.helpers(h,f.recommendations,actors));await check(t,'recommendations0025 revoked history cannot be recertified',()=>recommendations.revokedHistory(h,f.recommendations,actors));}
  if(interventions.present(h).length){
    f.interventions=interventions.seed(h,f.recommendations,actors);
    await check(t,'interventions0026 scoped money and current sources',()=>interventions.projection(h,f.workspace,actors));
    await check(t,'interventions0026 plan permissions CAS and approval immutability',()=>interventions.states(h,f.interventions,actors));
    await check(t,'interventions0026 ordered canonical measurement and exact delta',()=>interventions.lifecycle(h,f.interventions,f.recommendations,f.workspace,actors));
    assert.ok(f.interventions.a.intervention_results&&f.interventions.b.intervention_results,'INTERVENTION_LIFECYCLE_PREREQUISITE');
    await check(t,'interventions0026 operational owner recovery without source revival',()=>interventions.assignment(h,f.interventions,actors));
    await check(t,'interventions0026 net refund and unknown reversal',()=>interventions.refunds(h,f.interventions,f.workspace,actors));
    await check(t,'interventions0026 partial unknown and immature measurements',()=>interventions.partial(h,f.interventions,f.recommendations,f.workspace,actors));
    await check(t,'interventions0026 reopen retains history and requires new measurement',()=>interventions.reopen(h,f.interventions,actors));
    await check(t,'interventions0026 current captured mapping contributor',()=>interventions.mappingAuthorization(h,f.interventions,actors));
    await check(t,'interventions0026 tenant roles immutable audit and result authority',()=>interventions.access(h,f.interventions,actors));
    await check(t,'interventions0026 scoped helper privileges',()=>interventions.scopedHelpers(h,f.recommendations,actors));
  }
  if(briefs.present(h).length){f.briefs=await briefs.seed(h,f,actors,f.workspace);await check(t,'briefs0027 current roles and tenant capabilities',()=>briefs.access(h,f.briefs,actors));await check(t,'briefs0027 immutable scoped publication and payload-bound replay',()=>briefs.integrity(h,f.briefs,actors));await check(t,'briefs0027 no invented causal savings',()=>briefs.claims(h,f.briefs,actors));await check(t,'briefs0027 current snapshot mapping and comparison authority',()=>briefs.authorization(h,f.briefs,actors));await check(t,'briefs0027 exact prior comparison and both-source authorization',()=>briefs.comparison(h,f.briefs,actors));}
  if(notifications.present(h).length){f.notifications=await notifications.seed(h,f,actors,f.briefs);await check(t,'notifications0028 own users roles and tenant',()=>notifications.access(h,f.notifications,actors));await check(t,'notifications0028 own preferences CAS and immutable event/read state',()=>notifications.integrity(h,f.notifications,actors));await check(t,'notifications0028 current resource authority and absent capability',()=>notifications.authorization(h,f.notifications,actors));await check(t,'notifications0028 all catalogue resource roles and evidence',()=>notifications.resources(h,f.notifications,actors));}
  if(releaseTables.present(h).length){releaseTables.seed(h,f,actors);await check(t,'release0033..38 real tenant row visibility and raw-role denials',()=>releaseTables.access(h,f,actors));}
  if(outbox.present(h).length){f.outbox=await outbox.seed(h,f,actors);await check(t,'outbox0029 exact private operational access and current authority',()=>outbox.access(h,f.outbox,actors));}
  if(email.present(h).length){f.email=email.seed(h,f.outbox,actors);await check(t,'email0030 private receipt mapping and tenant-scoped status',()=>email.access(h,f.email,actors));}
  if(push.present(h).length){f.push=await push.seed(h,f.outbox,actors);await check(t,'push0031 private device keys and current-session RPC isolation',()=>push.access(h,f.push,actors));}
  if(businessNotifications.present(h)){f.businessNotifications=businessNotifications.seed(h,f.outbox);await check(t,'business0032 private transaction ledger and cross-tenant event binding',()=>businessNotifications.access(h,f.businessNotifications,actors));}
  if(!prerequisiteFailed&&!t.signal.aborted)stage=2;
});
test('F01-03 part 3: discovered foreign keys, Storage and retrieval revocation', {timeout:600000},async t=>{
  // Release shared services before downstream matrices in the same test process.
  // Register before prerequisites so a prior failure still runs cleanup; global after remains fallback.
  t.after(async()=>{if(h){await h.close();h=undefined;}});
  assert.equal(stage,2,'SQL_DOMAIN_PREREQUISITE');
  for(const fk of foreignKeys(h))await check(t,`discovered FK ${fk.name}`,()=>discoveredFkOracle(h,f,fk));
  await check(t,'external identity 42 is tenant scoped and revision deduplicated',()=>{
    assert.equal(h.sql("SELECT count(*) FROM public.conversations WHERE external_id='42'"),'2');
    const duplicate={...f.a.conversations,id:'00000000-0000-4000-8000-000000000099'};
    assert.equal(h.probe(write(insert('conversations',duplicate))).code,'23505','DEDUP_IDENTITY');
    assert.equal(h.probe(write(insert('conversations',{...duplicate,external_id:'43'}))).code,'00000','IDENTITY_POSITIVE');
  });
  await check(t,'membership cannot be self-granted or escalated',()=>{
    denied(h.probe(write(insert('memberships',{tenant_id:B,user_id:actors.a.id,role:'owner',status:'active'})),actors.a),'SELF_GRANT');
    denied(h.probe(write(`UPDATE public.memberships SET role='owner' WHERE tenant_id=${q(A)} AND user_id=${q(actors.viewer.id)}`),actors.viewer),'SELF_ESCALATION');
  });
  // Failures here cannot be replaced with SQL-only assertions or a stub server.
  const revokedServices=await serviceOracle(h,f,actors);
  t.diagnostic("REAL_AUTH_STORAGE_RETRIEVAL_COMPLETE: positives, external negatives, forged selector, payload isolation");
  await check(t,'old session after membership revocation',async()=>{revokeOracle(h,f,actors);await revokedServices();t.diagnostic("REAL_OLD_SESSION_REVOCATION_COMPLETE: SQL, Storage and retrieval");});
});
