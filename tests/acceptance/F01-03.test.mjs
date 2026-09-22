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
import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateInputs,launch,write,denied} from './support/F01-03/harness.mjs';
import {definitions,relations,insert,q} from './support/F01-03/matrix.mjs';
import {A,B,identityOracle,schemaOracle,seed,tableOracle,fkOracle,revokeOracle,foreignKeys,discoveredFkOracle} from './support/F01-03/oracles.mjs';
import * as history from './support/F01-03/source-history/oracles.mjs';
import * as workers from './support/F01-03/worker-delegations/oracles.mjs';
import * as uploads from './support/F01-03/import-uploads/oracles.mjs';
import {serviceOracle} from './support/F01-03/services.mjs';

test('F01-03: real candidate migrations, SQL matrix, Storage and retrieval', {timeout:600000},async t=>{
  const migrations=candidateInputs(process.env.VEXA_CANDIDATE);
  const h=await launch({services:true});t.after(()=>h.close());
  for(const migration of migrations)h.sql(migration);
  h.sql("NOTIFY pgrst, 'reload schema';");
  if(migrations.workerDelegationsRequired)assert.ok(workers.present(h),'WORKER_MIGRATION_REQUIRED');
  if(migrations.syncRequired)assert.deepEqual(sync.present(h),sync.tables,'SYNC_MIGRATION_REQUIRED');
  if(migrations.aliasesRequired)assert.ok(aliases.present(h),'ALIAS_MIGRATION_REQUIRED');
  if(migrations.healthRequired)assert.ok(health.present(h),'HEALTH_MIGRATION_REQUIRED');
  if(migrations.budgetRequired)assert.deepEqual(budget.present(h),budget.tables,'BUDGET_MIGRATION_REQUIRED');
  if(migrations.extractionRequired)assert.deepEqual(extraction.present(h),extraction.tables,'EXTRACTION_MIGRATION_REQUIRED');
  if(migrations.crmRequired)assert.ok(crm.present(h),'CRM_MIGRATION_REQUIRED');
  if(migrations.problemsRequired)assert.deepEqual(problems.present(h),problems.tables,'PROBLEM_MIGRATION_REQUIRED');
  if(migrations.causalityRequired)assert.deepEqual(causality.present(h),causality.tables,'CAUSAL_MIGRATION_REQUIRED');
  if(migrations.economicRequired)assert.deepEqual(economic.present(h),economic.tables,'ECONOMIC_MIGRATION_REQUIRED');
  if(migrations.exposureRequired)assert.deepEqual(exposure.present(h),exposure.tables,'EXPOSURE_MIGRATION_REQUIRED');
  if(migrations.moneyRequired)assert.deepEqual(money.present(h),money.tables,'MONEY_MIGRATION_REQUIRED');
  if(migrations.detailRequired)assert.deepEqual(detail.present(h),detail.tables,'DETAIL_MIGRATION_REQUIRED');
  if(migrations.workspaceRequired)assert.deepEqual(workspace.present(h),workspace.tables,'WORKSPACE_MIGRATION_REQUIRED');
  if(migrations.priorityRequired)assert.deepEqual(priority.present(h),priority.tables,'PRIORITY_MIGRATION_REQUIRED');
  if(migrations.snapshotsRequired)assert.deepEqual(snapshots.present(h),snapshots.tables,'SNAPSHOT_MIGRATION_REQUIRED');
  schemaOracle(h);
  const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
  const f=seed(h,actors);
  history.seedHistory(h,f);
  if(sync.present(h).length){f.sync=sync.seed(h,f,actors);await t.test('sync008 backend raw authorization',()=>sync.access(h,f.sync,actors));}
  if(health.present(h)){f.health=health.seed(h,f,actors);await t.test('health0010 summary authorization',()=>health.access(h,f.health,actors));}
  if(history.present(h).length)await t.test('source history backend authorization',()=>history.access(h,f,actors));
  if(history.present(h).includes('source_heads'))await t.test('owner selection fence cannot bypass via SQL',()=>history.selectionFence(h,f,actors));
  if(uploads.present(h)){
    f.importUploads=uploads.seedUploads(h,f,actors);
    await t.test('import_uploads owner and backend authorization',()=>uploads.access(h,f.importUploads,actors));
  }
  if(workers.present(h)){
    f.workers=workers.seedWorkers(h,actors);
    for(const [name,oracle] of Object.entries(workers.checks))await t.test('worker delegation '+name,()=>oracle(h,f,actors));
  }
  await t.test("identity tables",()=>identityOracle(h,actors));
  for(const [table] of definitions)await t.test('functional RLS '+table,()=>tableOracle(h,table,f,actors));
  if(crm.present(h)){f.crm=crm.seed(h,f,actors);await t.test('CRM settings0013 authorization and dispatch',()=>crm.access(h,f.crm,actors));}
  if(extraction.present(h).length){f.extraction=extraction.seed(h,f,actors);await t.test('extraction0012 private maps and claims authorization',()=>extraction.access(h,f.extraction,actors));}
  if(budget.present(h).length){f.budget=budget.seed(h,f,actors);await t.test('budget0011 authorization and reconciliation',()=>budget.access(h,f.budget,actors));}
  for(const relation of relations)await t.test(`required FK ${relation.table}.${relation.column}`,()=>fkOracle(h,f,relation));
  if(problems.present(h).length){f.problemVectors=problems.seed(h,f,actors);await t.test('problems0016 authorization',()=>problems.access(h,f.problemVectors,actors));}
  if(causality.present(h).length){f.causality=causality.seed(h,f,actors);await t.test('causality0017 authorization',()=>causality.access(h,f.causality,actors));await t.test('causality0017 scoped contributor helper',()=>causality.contributor(h,f.causality,actors));}
  if(economic.present(h).length){f.economic=economic.seed(h,f,actors);await t.test('economic0018 authorization and append-only',()=>economic.access(h,f.economic,actors));await t.test('economic0018 exact amounts state source and CAS',()=>economic.financial(h,f.economic,actors));}
  if(exposure.present(h).length){f.exposure=exposure.seed(h,f,actors);await t.test('exposure0019 authorization and append-only',()=>exposure.access(h,f.exposure,actors));await t.test('exposure0019 identity and CAS',()=>exposure.identity(h,f.exposure,actors));await t.test('exposure0019 contributor revocation',()=>exposure.contributor(h,f.exposure,actors));}
  if(money.present(h).length){f.money=money.seed(h,f,actors);await t.test('money0020 authorization and append-only',()=>money.access(h,f.money,actors));await t.test('money0020 catalog FX provenance versions and contributors',()=>money.versions(h,f.money,actors));}
  if(snapshots.present(h).length){f.snapshots=snapshots.seed(h,f,actors);await t.test('snapshots0021 private drafts and current authorization',()=>snapshots.visibility(h,f.snapshots,actors));await t.test('snapshots0021 exact money metadata and identity',()=>snapshots.metadata(h,f.snapshots,actors));await t.test('snapshots0021 atomic publication and immutable history',()=>snapshots.integrity(h,f.snapshots,actors));await t.test('snapshots0021 digest timezone independence',()=>snapshots.timezones(h,f.snapshots,actors));await t.test('snapshots0021 withdrawn source privacy',()=>snapshots.withdrawal(h,f.snapshots,actors));}
  if(priority.present(h).length){f.priority=priority.seed(h,f,actors,f.snapshots);await t.test('priority0022 tenant current actors and roles',()=>priority.access(h,f.priority,actors));await t.test('priority0022 exact policy versions and actionability CAS',()=>priority.versions(h,f.priority,actors));await t.test('priority0022 publication integrity rollback and immutable history',()=>priority.integrity(h,f.priority,actors));await t.test('priority0022 scoped metadata head and revocation recovery',()=>priority.heads(h,f.priority,actors));await t.test('priority0022 historical input republished with new version',()=>priority.rollbackPolicy(h,f.priority,actors));}
  if(workspace.present(h).length){f.workspace=await workspace.seed(h,f,actors,f.snapshots);await t.test('workspace0023 tenant roles and current mapping contributors',()=>workspace.access(h,f.workspace,actors));await t.test('workspace0023 mapping and immutable binding integrity',()=>workspace.integrity(h,f.workspace,actors));}
  if(detail.present(h).length){f.detail=await detail.seed(h,f,actors,f.workspace);await t.test('detail0024 tenant roles and private identities',()=>detail.access(h,f.detail,actors));await t.test('detail0024 approved identity CAS cutoff and immutable receipt',()=>detail.integrity(h,f.detail,actors));await t.test('detail0024 complete conversation identity manifest',()=>detail.conversationCompleteness(h,f,actors,f.workspace));}
  for(const fk of foreignKeys(h))await t.test(`discovered FK ${fk.name}`,()=>discoveredFkOracle(h,f,fk));
  await t.test('external identity 42 is tenant scoped and revision deduplicated',()=>{
    assert.equal(h.sql("SELECT count(*) FROM public.conversations WHERE external_id='42'"),'2');
    const duplicate={...f.a.conversations,id:'00000000-0000-4000-8000-000000000099'};
    assert.equal(h.probe(write(insert('conversations',duplicate))).code,'23505','DEDUP_IDENTITY');
    assert.equal(h.probe(write(insert('conversations',{...duplicate,external_id:'43'}))).code,'00000','IDENTITY_POSITIVE');
  });
  await t.test('membership cannot be self-granted or escalated',()=>{
    denied(h.probe(write(insert('memberships',{tenant_id:B,user_id:actors.a.id,role:'owner',status:'active'})),actors.a),'SELF_GRANT');
    denied(h.probe(write(`UPDATE public.memberships SET role='owner' WHERE tenant_id=${q(A)} AND user_id=${q(actors.viewer.id)}`),actors.viewer),'SELF_ESCALATION');
  });
  // Failures here cannot be replaced with SQL-only assertions or a stub server.
  const revokedServices=await serviceOracle(h,f,actors);
  t.diagnostic("REAL_AUTH_STORAGE_RETRIEVAL_COMPLETE: positives, external negatives, forged selector, payload isolation");
  await t.test('old session after membership revocation',async()=>{revokeOracle(h,f,actors);await revokedServices();t.diagnostic("REAL_OLD_SESSION_REVOCATION_COMPLETE: SQL, Storage and retrieval");});
});
