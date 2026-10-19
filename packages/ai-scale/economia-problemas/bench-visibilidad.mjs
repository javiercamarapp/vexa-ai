#!/usr/bin/env node
// BENCHMARK LOCAL DE LA CAPA SQL (no es prueba): costo de leer un snapshot económico publicado con un libro de 88,666 filas (manifiesto de ~88 mil referencias),
// con la función/política de 0021 y con la propuesta 0055. Fixture: snapshot y componentes insertados con triggers desactivados (session_replication_role=replica)
// solo para medir la lectura; NO es un snapshot válido para el producto. Postgres desechable; todo sintético.
//   node bench-visibilidad.mjs [--componentes 96] [--ledger full|small]
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {withPg} from './harness.mjs';
import {TENANT_A, OWNER, ANALYST_A, sembrarUsuarios} from './mundo.mjs';
import {prepareMarketplaces} from '../../../scripts/economics/preparar.mjs';
import {syntheticMarketplaceTexts} from '../../economics/synthetic.mjs';
import {psqlFile} from './mundo.mjs';

const a = process.argv.slice(2), opt = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
const COMP = +opt('componentes', 96), LEDGER = opt('ledger', 'full');
const sha = s => createHash('sha256').update(s).digest('hex');
const here = new URL('.', import.meta.url).pathname;

await withPg(async h => {
  const {psql, sock} = h;
  const texts = syntheticMarketplaceTexts();
  const readSynthetic = (root, spec) => { const text = texts.get(spec.rel); return {text, sha: sha(text), bytes: Buffer.from(text)}; };
  psql(`insert into public.organizations(id,name) values('${TENANT_A}','SYN'),('bbbbbbbb-0000-4000-8000-000000000001','SYNB')`); sembrarUsuarios(h);
  const prep = prepareMarketplaces({tenantId: TENANT_A, actorId: OWNER.A, root: 'sintetico', readFile: readSynthetic, unknownCurrency: 'XXX'});
  const files = LEDGER === 'full' ? prep.files : prep.files.slice(0, 13);
  for (const f of files) { const r = psqlFile(sock, f.sql); if (r.status !== 0) throw Error(r.stderr.slice(0, 200)); }
  const n = psql('select count(*) from public.economic_ledger_entries').out; console.log('ledger', n, 'filas');
  const SNAP = '11111111-1111-4111-8111-111111111111';
  const fix = `set session_replication_role=replica;
   insert into public.metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,watermark,status,date_start,date_end,timezone,currency,date_basis,economic_schema_version,as_of,content_hash,input_manifest,component_count,created_by,published_by,published_at,bundle_ref,provenance)
   select '${SNAP}','${TENANT_A}',repeat('a',64),repeat('b',64),'economic-policy-f05-05-v1',now(),'published','2025-10-01','2026-10-02','UTC','USD','order','economic-snapshot-v1',now(),repeat('c',64),
     jsonb_build_object('refs',(select jsonb_agg(jsonb_build_object('table','economic_ledger_entries','id',e.id,'actorId',e.actor_id,'authorized',true,'active',true,'sourceId',e.source_id,'version',e.revision)) from public.economic_ledger_entries e),'models','[]'::jsonb,'watermarks','[]'::jsonb,'selection','{}'::jsonb),
     ${COMP},'${OWNER.A}','${OWNER.A}',now(),'canonical:x','{}'::jsonb;
   insert into public.components(id,tenant_id,snapshot_id,metric,kind,amount_minor,known_subtotal_minor,currency,exponent,known_count,total_count,provenance)
   select gen_random_uuid(),'${TENANT_A}','${SNAP}','m'||g,'observed',1,1,'USD',2,1,1,'{}'::jsonb from generate_series(1,${COMP}) g;
   reset session_replication_role;`;
  let r = psqlFile(sock, fix); if (r.status !== 0) throw Error('fixture: ' + r.stderr.slice(0, 300));
  console.log('manifiesto', (+psql(`select pg_column_size(input_manifest) from public.metric_snapshots`).out / 1048576).toFixed(1), 'MiB;', psql('select jsonb_array_length(input_manifest->\'refs\') from public.metric_snapshots').out, 'referencias;', psql('select count(*) from public.components').out, 'componentes');
  const time = (label, sql) => { const t = Date.now(); const x = spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-At', '-X', '-q', '-c', `begin; set local role vexa_backend; select set_config('request.jwt.claim.sub','${OWNER.A}',true),set_config('vexa.tenant_id','${TENANT_A}',true),set_config('vexa.action','read',true),set_config('statement_timeout','600000',true); ${sql}; rollback;`], {encoding: 'utf8'}); const ms = Date.now() - t; console.log(label.padEnd(58), String(ms).padStart(8), 'ms', x.status === 0 ? '' : 'ERROR ' + x.stderr.slice(0, 120)); return ms; };
  const q = 'select count(*) from public.components';
  console.log('--- 0021 (función y política actuales)');
  time('SELECT 1 fila de metric_snapshots', 'select count(*) from public.metric_snapshots');
  time(`SELECT ${COMP} componentes (política por fila)`, q);
  time('economic_snapshot_digest (hash de contenido)', `select public.economic_snapshot_digest('${TENANT_A}','${SNAP}')`);
  r = h.file(here + 'propuestas/0055_economic_snapshot_visible_rapida.sql'); if (r.status !== 0) throw Error(r.stderr);
  console.log('--- propuesta 0055 (solo la función)');
  time('SELECT 1 fila de metric_snapshots', 'select count(*) from public.metric_snapshots');
  time(`SELECT ${COMP} componentes (política por fila)`, q);
  time('economic_snapshot_digest (hash de contenido)', `select public.economic_snapshot_digest('${TENANT_A}','${SNAP}')`);
  r = h.file(here + 'propuestas/0055b_components_policy_una_vez.sql'); if (r.status !== 0) throw Error(r.stderr);
  console.log('--- propuesta 0055 + 0055b (política de components evaluada una vez)');
  time('SELECT 1 fila de metric_snapshots', 'select count(*) from public.metric_snapshots');
  time(`SELECT ${COMP} componentes`, q);
  time('economic_snapshot_digest (hash de contenido)', `select public.economic_snapshot_digest('${TENANT_A}','${SNAP}')`);
  time('SELECT ledger de la tenant (88 mil filas, RLS)', 'select count(*) from public.economic_ledger_entries');
  time('authorizeCaptured-equivalente: 88 mil economic_contributor_active', `select count(*) from public.economic_ledger_entries e where public.economic_contributor_active(e.tenant_id,e.actor_id)`);
});
