// Cobertura con conteos EXACTOS a escala real: 85,361 asientos del libro, 117,719 hechos de asociaciones HubSpot y 72,720 vínculos activos.
// Postgres local desechable con las migraciones REALES (0001..0055 + 20261021000000), rol vexa_backend y RLS real; datos 100 % sintéticos (SYN).
//   node --test packages/workspace-service/tests/coverage-exactas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withPg, pgAvailable} from '../../metrics/tests/pg-harness.mjs';
import {sembrarBase, cargarAsientos} from '../../metrics/tests/ledger-sintetico.mjs';
import {crearBaseDatos} from '../../ai-scale/economia-problemas/snapshot.mjs';
import {TENANT_A, TENANT_B, OWNER, ANALYST_A, SECOND_OWNER_A, psqlFile} from '../../ai-scale/economia-problemas/mundo.mjs';
import {HERE} from '../../metrics/tests/world.mjs';
import {createProvenanceRepository, rejectionNote} from '../provenance.mjs';

const pg = createRequire(import.meta.url)('pg');
const SKIP = !pgAvailable() && 'sin postgres local';
const MIG = path.join(HERE, '../../../supabase/migrations/20261021000000_association_read_policies_initplan.sql');
const DOWN = path.join(HERE, '../../workspace-service/tests/20261021000000_association_read_policies_initplan.down.sql');
const FACTS = 117719, LINKS = 72720, LEDGER = 85361;
const C = 'cccccccc-0000-4000-8000-0000000000a1', CB = 'cccccccc-0000-4000-8000-0000000000b1';

function sembrarAsociaciones(h) {
  const sql = `set session_replication_role=replica;set statement_timeout=0;
 insert into public.connections(id,tenant_id,source,account_id) values('${C}','${TENANT_A}','hubspot','syn-portal'),('${CB}','${TENANT_B}','hubspot','syn-portal-b');
 insert into public.imports(id,tenant_id,file_hash,mapping_version,state,idempotency_key,total,accepted,rejected,duplicates,pending,connection_id)
  values('f1000000-0000-4000-8000-000000000001','${TENANT_A}',repeat('1',64),'m1','succeeded','k-hs',13507,6471,7036,0,0,'${C}');
 alter table public.native_customer_associations disable trigger user;alter table public.conversation_customer_association_bindings disable trigger user;
 insert into public.native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,resolution_state,reason)
  select md5('f'||i)::uuid,'${TENANT_A}','${C}','hubspot','p1','t'||i,'c'||i,repeat('a',64),'{}'::jsonb,md5('r'||i)::uuid,repeat('b',64),
   case when i<=${LINKS} then 'resolved' when i<=${LINKS + 25000} then 'pending' when i<=${LINKS + 40000} then 'blocked' else 'retained' end,'syn'
  from generate_series(1,${FACTS}) i;
 insert into public.native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,resolution_state,reason)
  select md5('fb'||i)::uuid,'${TENANT_B}','${CB}','hubspot','p1','t'||i,'c'||i,repeat('a',64),'{}'::jsonb,md5('rb'||i)::uuid,repeat('b',64),'resolved','syn' from generate_series(1,50) i;
 insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,active,provenance)
  select '${TENANT_A}',md5('f'||i)::uuid,md5('cv'||i)::uuid,md5('cu'||i)::uuid,'${C}','${C}',gen_random_uuid(),gen_random_uuid(),1,1,1,repeat('a',64),'unique_explicit_bridge',gen_random_uuid(),'${OWNER.A}',true,'{}'::jsonb from generate_series(1,${LINKS}) i;
 insert into public.conversation_customer_association_bindings(tenant_id,fact_id,conversation_id,customer_id,conversation_connection_id,customer_connection_id,conversation_revision_id,customer_revision_id,conversation_head_version,customer_head_version,fact_version,evidence_hash,method,decision_id,actor_id,active,provenance,deactivated_at)
  select '${TENANT_A}',md5('f'||i)::uuid,md5('cvx'||i)::uuid,md5('cux'||i)::uuid,'${C}','${C}',gen_random_uuid(),gen_random_uuid(),1,1,1,repeat('a',64),'owner_decision',gen_random_uuid(),'${OWNER.A}',false,'{}'::jsonb,now() from generate_series(1,1000) i;
 alter table public.native_customer_associations enable trigger user;alter table public.conversation_customer_association_bindings enable trigger user;
 analyze public.native_customer_associations;analyze public.conversation_customer_association_bindings;analyze public.economic_ledger_entries;`;
  const r = psqlFile(h.sock, sql); if (r.status !== 0) throw Error('asociaciones: ' + String(r.stderr).slice(0, 500));
}

test('rejectionNote: describe los rechazados sin parecer una falla (puro)', () => {
  const t = rejectionNote({total: 13507, incorporated: 6471, rejected: 7036, pending: 0});
  assert.match(t, /6\.471 de 13\.507|6,471 de 13,507/); assert.match(t, /no es una falla de la carga/); assert.match(t, /No quedan filas pendientes/); assert.match(t, /52[.,]1 %/);
  assert.equal(rejectionNote({total: 10, incorporated: 10, rejected: 0, pending: 0}), null);
  assert.match(rejectionNote({total: 10, incorporated: 5, rejected: 2, pending: 3}), /3 pendientes de procesar/);
});

test('cobertura exacta a escala real (libro, hechos y vínculos): Observado, cifras exactas, < 3 s bajo RLS', {skip: SKIP, timeout: 900000}, async t => {
  await withPg(async h => {
    sembrarBase(h); cargarAsientos(h, {total: LEDGER}); sembrarAsociaciones(h);
    const pool = new pg.Pool({host: h.sock, user: 'postgres', database: 't', max: 4}); t.after(() => pool.end());
    const repo = (tenant, user, ms = 10000) => createProvenanceRepository({database: crearBaseDatos({pool, tenantId: tenant, userId: user, statementTimeoutMs: ms})});
    const medir = async (r) => { const t0 = Date.now(); const v = await r.coverage(); return {v, ms: Date.now() - t0, S: Object.fromEntries(v.sources.map(s => [s.key, s]))}; };
    const exactLedger = h.psql(`select count(distinct entity_id) from public.economic_ledger_entries where tenant_id='${TENANT_A}'`).out;
    const polA = () => h.psql(`select qual from pg_policies where policyname='association_fact_read'`).out;
    const antes = await medir(repo(TENANT_A, OWNER.A));
    console.log('# antes de la migración: ' + antes.ms + ' ms · asociaciones ' + antes.S.associations.class + ' ' + antes.S.associations.total + ' · libro ' + antes.S.ledger.class + ' ' + antes.S.ledger.total);

    await t.test('sin la migración nueva: nunca una cifra incompleta rotulada exacta', () => {
      for (const k of ['associations', 'ledger']) { const s = antes.S[k]; assert.ok(['observed', 'estimated'].includes(s.class)); if (s.class === 'observed') assert.ok(s.total === (k === 'associations' ? FACTS : Number(exactLedger)), k + ' observado debe ser exacto'); else assert.ok(s.detail.some(l => /Estimado/.test(l))); }
      assert.ok(antes.ms < 10000, 'dentro del límite de 10 s incluso sin la migración (' + antes.ms + ' ms)');
    });

    const ap = h.file(MIG); assert.equal(ap.status, 0, String(ap.stderr));
    assert.match(polA(), /\( SELECT vexa_member/i);
    const ap2 = h.file(MIG); assert.equal(ap2.status, 0, 'idempotente: segunda aplicación ' + String(ap2.stderr));

    const despues = await medir(repo(TENANT_A, OWNER.A)); const S = despues.S;
    console.log('# después de la migración: ' + despues.ms + ' ms total');
    await t.test('asociaciones: 117,719 hechos y 72,720 vínculos EXACTOS, clase Observado', () => {
      assert.equal(S.associations.class, 'observed'); assert.equal(S.associations.total, FACTS);
      assert.match(S.associations.detail[0], /117[.,]719 hechos/); assert.match(S.associations.detail[0], /resueltos 72[.,]720/);
      assert.match(S.associations.detail[1], /72[.,]720 vínculos activos/); assert.ok(S.associations.detail.includes('Conteo exacto.'));
      assert.ok(!S.associations.detail.some(l => /Estimado/.test(l)));
    });
    await t.test('libro: conteo exacto de entidades, clase Observado', () => {
      assert.equal(S.ledger.class, 'observed'); assert.equal(S.ledger.total, Number(exactLedger)); assert.ok(S.ledger.detail.some(l => new RegExp('Conteo exacto del libro: .* en 85[.,]361 revisiones').test(l)), S.ledger.detail.join('|'));
    });
    await t.test('rendimiento: cobertura completa < 3 s con 85k asientos + 117k hechos + 72k vínculos', () => { assert.ok(despues.ms < 3000, despues.ms + ' ms'); });
    await t.test('HubSpot: 6,471 de 13,507 con nota que no parece falla', () => {
      assert.equal(S.hubspot.total, 13507); assert.equal(S.hubspot.incorporated, 6471); assert.equal(S.hubspot.rejected, 7036); assert.equal(S.hubspot.pending, 0);
      assert.match(S.hubspot.rejectionNote, /no es una falla de la carga/); assert.equal(S.associations.rejectionNote, null);
    });
    await t.test('mismas decisiones de acceso: otra organización, analista, lector; sin sesión miembro', async () => {
      const b = await medir(repo(TENANT_B, OWNER.B)); assert.equal(b.S.associations.total, 50); assert.equal(b.S.ledger.loaded, false);
      const an = await medir(repo(TENANT_A, ANALYST_A)); assert.equal(an.S.associations.total, FACTS);
      const vw = await medir(repo(TENANT_A, SECOND_OWNER_A)); assert.equal(vw.S.associations.total, FACTS);
      await assert.rejects(() => repo(TENANT_B, OWNER.A).coverage(), /organization_not_authorized/);
      const cruzado = h.psql(`select count(*) from public.native_customer_associations`); assert.ok(Number(cruzado.out) > FACTS); // superusuario ve ambas: el aislamiento anterior es de la RLS
    });
    await t.test('si el conteo exacto no alcanza en tiempo: muestra rotulada Estimado (≈ cifra real), nunca cero ni «Observado» falso', async () => {
      const base = crearBaseDatos({pool, tenantId: TENANT_A, userId: OWNER.A, statementTimeoutMs: 10000});
      const lento = {transaction: (a, w) => base.transaction(a, s => w({...s, query: (q, v) => (/native_customer_associations|conversation_customer_association_bindings|economic_ledger_entries/.test(q) && /GROUP BY 1/.test(q) && !/TABLESAMPLE/.test(q))
        ? Promise.reject(Object.assign(new Error('canceling statement due to statement timeout'), {code: '57014'})) : s.query(q, v)}))};
      const r = await medir(createProvenanceRepository({database: lento}));
      for (const k of ['associations', 'ledger']) { const x = r.S[k]; assert.equal(x.class, 'estimated', k); assert.ok(x.detail.some(l => /Estimado con una muestra del 10 %/.test(l)), k); assert.ok(x.total > 0); }
      assert.ok(Math.abs(r.S.associations.total - FACTS) / FACTS < 0.05, String(r.S.associations.total));
      assert.ok(Math.abs(r.S.ledger.total - Number(exactLedger)) / Number(exactLedger) < 0.12, String(r.S.ledger.total));
    });
    await t.test('política original (reversa): sigue correcto, exacto o rotulado, dentro de 10 s; la migración se reaplica sin error', async () => {
      const rb = h.file(DOWN); assert.equal(rb.status, 0, String(rb.stderr)); assert.doesNotMatch(polA(), /\( SELECT vexa_member/i);
      const r = await medir(repo(TENANT_A, OWNER.A)); const a = r.S.associations;
      assert.ok(a.class === 'observed' ? a.total === FACTS : (a.detail.some(l => /Estimado/.test(l)) && Math.abs(a.total - FACTS) / FACTS < 0.05), JSON.stringify([a.class, a.total]));
      assert.ok(r.ms < 10000, r.ms + ' ms'); assert.equal(h.file(MIG).status, 0);
    });
  }, {name: 'cov', shared: '256MB'});
});
