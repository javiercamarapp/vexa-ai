import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setup, q } from './harness.mjs';
const candidate = path.resolve(process.env.VEXA_CANDIDATE ?? process.cwd()), baseline = 'caller checkout', overlay = [];
for (const file of overlay) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(candidate, file.path))).digest('hex'), file.sha256);
const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'vexa-history321-'));
const report = { status: 'running', candidate, baseline, node: process.version, evidence, manualActions: [], steps: [], breakpoints: [], scope: 'SYN local historical continuity; no external provider, production or self-improvement claim' };
console.log('HISTORY321_EVIDENCE:' + evidence);
const save = () => fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let h, ctx;
const step = async (name, operation) => { const entry = { name, status: 'running' }; report.steps.push(entry); save(); try { entry.observed = await operation(); entry.status = 'pass'; } catch (error) { entry.status = 'blocked'; entry.error = { message: error.message, stack: error.stack }; report.breakpoints.push({ step: name, ...entry.error }); } save(); return entry.status === 'pass'; };
const manual = (action) => report.manualActions.push(action);
try {
  h = await setup(candidate, evidence);
  const { syntheticConfig } = await import(pathToFileURL(path.join(candidate, 'support/F04-extraction/config-fixture.mjs')));
  const extractionConfig = syntheticConfig(h.A.tenant);
  const problemConfig = { tenantId: h.A.tenant, modelId: 'synthetic/model', dimensions: 3, version: 'SYN-history321', threshold: 0.2, gateway: { policy: extractionConfig.gateway.policy, candidate: extractionConfig.gateway.modelsByRole.extraction[0], catalog: { ...extractionConfig.gateway.catalog, models: [{ id: 'synthetic/model', dimensions: 3, contextTokens: 200000 }] } } };
  await h.stopWeb(); await h.startWeb(false, { NODE_OPTIONS: '--import ' + path.resolve(new URL('./provider-preload.mjs', import.meta.url).pathname), SYN_HISTORY_PROVIDER_LOG: path.join(evidence, 'provider.jsonl'), VEXA_CRM_CREDENTIALS_JSON: JSON.stringify([{ tenantId: h.A.tenant, source: 'zendesk', accountId: 'SYN-history321', ref: 'syn-history', token: 'SYN-HISTORY-SECRET', subdomain: 'synthetic-vexa' }]), VEXA_EXTRACTION_CONFIG_JSON: JSON.stringify([extractionConfig]), VEXA_AI_RUNTIME: 'enabled', OPENROUTER_API_KEY: 'SYN-HISTORY-AI', VEXA_PROBLEMS_CONFIG_JSON: JSON.stringify([problemConfig]), VEXA_PROBLEMS_RUNTIME: 'enabled', VEXA_OPENROUTER_API_KEY: 'SYN-HISTORY-EMBEDDING' });
  manual('Server configuration: authorized SYN CRM credential, extraction/embedding policies and runtime activation. No real provider credential.');
  const request = async (route, body, expected = 200) => { const r = await h.request(h.A, route, body); assert.equal(r.status, expected, route + ':' + JSON.stringify(r.data)); return r.data; };
  const tick = async (consumer) => { const seen = []; for (let i = 0; i < 4; i++) { const response = await fetch(h.base + '/api/internal/' + consumer, { method: 'POST', headers: { authorization: 'Bearer ' + h.triggerSecret }, signal: AbortSignal.timeout(30000) }); const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); seen.push(body); if (body.data?.state && body.data.state !== 'idle') return body.data; } return { state: 'idle', seen }; };
  let connection, conversation, runId, problem, published, workspace;
  const imported = await step('CRM historical API configuration and hosted worker', async () => {
    manual('Owner POST /api/connections/settings: explicitly choose historical start 2026-09-01 and enable SYN account.');
    connection = (await request('/api/connections/settings', { source: 'zendesk', accountId: 'SYN-history321', credentialRef: 'syn-history', enabled: true, historyFrom: '2026-09-01T00:00:00Z', overlapSeconds: 60, pollSeconds: 300 }, 201)).data.connectionId;
    const result = await tick('crm'); assert.equal(result.state, 'done', JSON.stringify(result));
    const counts = h.json(`SELECT jsonb_build_object('conversations',(SELECT count(*) FROM conversations WHERE connection_id=${q(connection)}),'messages',(SELECT count(*) FROM messages WHERE connection_id=${q(connection)}),'raw',(SELECT count(*) FROM sync_raw_objects WHERE connection_id=${q(connection)}),'mode',(SELECT mode FROM sync_cursors WHERE connection_id=${q(connection)} ORDER BY created_at LIMIT 1))`);
    assert.equal(counts.conversations, 102); assert.equal(counts.messages, 102); assert.equal(counts.mode, 'backfill');
    return { result, counts, rawStorage: 'CRM product stores original/normalized payload in PostgreSQL sync_raw_objects; Storage service runs but this path does not use object storage.' };
  });
  if (imported) await step('No automatic extraction admission after completed backfill', async () => {
    const jobs = Number(h.sql(`SELECT count(*) FROM extraction_requests WHERE tenant_id=${q(h.A.tenant)}`)); assert.equal(jobs, 0); const runtime = await tick('extraction'); assert.equal(runtime.state, 'idle'); return { jobs, runtime: runtime.state, missingLink: 'Backfill completion does not enqueue extraction requests.' };
  });
  const extracted = imported && await step('Explicit API submit of undiscoverable historical ID and durable extraction', async () => {
    conversation ??= h.sql(`SELECT id FROM conversations WHERE connection_id=${q(connection)} LIMIT 1`);
    for (const purpose of ['all', 'extraction']) { manual('Owner configures ' + purpose + ' budget through /api/extraction.'); await request('/api/extraction', { action: 'budget', purpose, limitUsd: '10' }); }
    manual('Owner POST /api/extraction action submit for one conversation; known ID obtained by diagnostic SQL because it is absent from dropdown.');
    const job = (await request('/api/extraction', { action: 'submit', conversationId: conversation, requestKey: randomUUID() }, 202)).data;
    const result = await tick('extraction'); assert.equal(result.state, 'succeeded', JSON.stringify(result));
    const state = await request('/api/extraction'), completed = state.jobs.find((item) => item.id === job.id); assert.ok(completed.runId); runId = completed.runId;
    const reservation = state.reservations.find((item) => item.state === 'uncertain'); assert.ok(reservation); assert.equal(reservation.actualMinor, null); assert.ok(BigInt(reservation.heldMinor) > 0n);
    const evidenceResponse = await request('/api/extraction/' + runId + '/evidence'); fs.writeFileSync(path.join(evidence, 'extraction-evidence.json'), JSON.stringify(evidenceResponse, null, 2));
    return { job: completed, providerCost: { state: reservation.state, actualMinor: reservation.actualMinor, heldMinor: reservation.heldMinor }, citation: evidenceResponse };
  });
  if (extracted) await step('No automatic embedding request after extraction', async () => { const count = Number(h.sql(`SELECT count(*) FROM problem_embedding_requests WHERE tenant_id=${q(h.A.tenant)}`)); assert.equal(count, 0); assert.equal((await tick('problems')).state, 'idle'); return { requests: count, missingLink: 'Completed extraction does not enqueue problem grouping.' }; });
  const grouped = extracted && await step('Explicit grouping API and durable embedding worker', async () => {
    const { createDurableBudgetRepository } = await import(pathToFileURL(path.join(h.built, 'packages/gateway/durable-budget.mjs')));
    manual('Embedding budget configured through existing server repository; no dedicated owner UI found in inspected problems panel.');
    await createDurableBudgetRepository({ database: h.database(), purpose: 'embedding', jobId: randomUUID() }).configure({ purpose: 'embedding', window: 'SYN', limitMinor: '10000000' });
    manual('Owner POST /api/problems operation submit for published extraction.');
    const job = (await request('/api/problems', { operation: 'submit', extractionRunId: runId, requestKey: randomUUID() }, 202)).data;
    const result = await tick('problems'); assert.equal(result.state, 'succeeded', JSON.stringify(result));
    const listed = await request('/api/problems'); problem = listed.problems[0]; assert.ok(problem?.id); const detail = await request('/api/problems/' + problem.id); fs.writeFileSync(path.join(evidence, 'problem.json'), JSON.stringify(detail, null, 2));
    return { job, result, problem, detail };
  });
  const scope = { start: '2026-09-01T00:00:00.000Z', end: '2026-09-20T00:00:00.000Z', timezone: 'UTC', dateBasis: 'occurred_at', currency: 'USD', exponent: 2, basis: 'net_order_excluding_tax_shipping' };
  if (grouped) await step('Publication requires explicit owner action; unknown financial data remains unknown', async () => {
    const initial = Number(h.sql(`SELECT count(*) FROM metric_snapshots WHERE tenant_id=${q(h.A.tenant)}`)); assert.equal(initial, 0);
    const { currency } = await import(pathToFileURL(path.join(candidate, 'support/F05-snapshots/fixtures.mjs')));
    manual('Owner explicitly configures SYN currency units via economics API.'); await request('/api/economics', currency('USD'));
    manual('Owner explicitly stages and publishes a snapshot; no operational money supplied by this CRM narrative.');
    const draft = (await request('/api/economic-snapshots', { operation: 'stage', scope })).data;
    published = (await request('/api/economic-snapshots', { operation: 'publish', snapshotId: draft.id, expectedContentHash: draft.contentHash })).data;
    fs.writeFileSync(path.join(evidence, 'snapshot.json'), JSON.stringify(published, null, 2));
    const query = new URLSearchParams({ date_start: '2026-09-01', date_end: '2026-09-20', timezone: 'UTC', date_basis: 'occurred_at', currency: 'USD', basis: scope.basis, snapshot_id: published.id, resource: 'problems' });
    const response = await request('/api/workspace?' + query); workspace = response.data; fs.writeFileSync(path.join(evidence, 'workspace.json'), JSON.stringify(response, null, 2));
    return { initialSnapshots: initial, snapshotId: published.id, snapshot: published, workspace: response };
  });
  if (grouped) await step('Historical problem visible independently of unknown financial data', async () => {
    const browser = await h.browser(); ctx = await browser.newContext({viewport:{width:390,height:844}}); ctx.setDefaultTimeout(15000);
    await ctx.addCookies(h.cookie(h.A).split('; ').map(value=>{const i=value.indexOf('=');return {name:value.slice(0,i),value:value.slice(i+1),url:h.base};}));
    const page=await ctx.newPage(); await page.goto(h.base+'/problems'); await page.waitForLoadState('networkidle');
    const catalog=page.getByRole('region',{name:'Catálogo actual de problemas'});
    assert.equal(await catalog.count(),1,'HISTORICAL_PROBLEM_WITHOUT_MONEY_MUST_BE_DISCOVERABLE');
    const link=catalog.getByRole('link',{name:problem.label,exact:true}); await link.waitFor();
    assert.equal(await link.getAttribute('href'),'/problems/'+problem.id);
    assert.ok((await catalog.innerText()).includes('sin asociación financiera'));
    await page.screenshot({path:path.join(evidence,'unknown-money-problem-discovered.png'),fullPage:true});
    await link.click(); await page.getByRole('heading',{name:'Detalle del problema',exact:true}).waitFor();
    await page.goto(h.base+'/problems'); await catalog.getByRole('link',{name:problem.label,exact:true}).waitFor();
    h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
    await catalog.getByRole('button',{name:'Actualizar catálogo',exact:true}).click(); await catalog.getByRole('alert').waitFor();
    assert.equal(await catalog.getByRole('link',{name:problem.label,exact:true}).count(),0,'REVOKED_CATALOG_MUST_CLEAR');
    const allOrders=published.components.filter(x=>x.metric==='allOrders'); assert.equal(allOrders.length,1); assert.ok(Object.hasOwn(allOrders[0],'amountMinor')); assert.equal(allOrders[0].amountMinor,null);
    return {problemId:problem.id,unknownRemainsNull:true,revokedSnapshotCleared:true};
  });
  h.verifySources(); report.status = report.breakpoints.length ? 'completed_with_breakpoints' : 'measured_manual_continuity'; if(report.breakpoints.length)process.exitCode=1;
} catch (error) { report.status = 'setup_or_unhandled_failure'; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally { if (ctx) await ctx.close(); if (h) await h.close(); const cleanup = path.join(evidence, 'cleanup.json'); if (fs.existsSync(cleanup)) report.cleanup = JSON.parse(fs.readFileSync(cleanup)); save(); console.log(JSON.stringify({ status: report.status, breakpoints: report.breakpoints.length, evidence })); }
