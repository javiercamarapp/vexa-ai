#!/usr/bin/env node
// Prueba local de las consultas de diagnostico: (1) todas son de solo lectura (se ejecutan en una transaccion READ ONLY y se rechaza
// cualquier palabra de escritura), (2) devuelven lo esperado sobre un escenario sintetico con job atascado e import viejo.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startLocalPg} from '../lib/localpg.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const results = []; const check = (n, p, d = '') => { results.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + (d ? ' ' + d : '')); };
const files = fs.readdirSync(here).filter(f => /^\d\d-.*\.sql$/.test(f)).sort();
const SKIP = new Set(['05-pg_stat_statements-top.sql']); // requiere la extension; no existe en el Postgres local
let pg;
try {
  pg = await startLocalPg({label: 'diag'}); pg.createDb('d'); pg.applySchema('d');
  pg.file('d', path.join(here, '../backup-restore/synthetic-fixture.sql'), [['na', '300'], ['nc', '30']]);
  const A = pg.sql('d', "select md5('tenant-A')::uuid");
  pg.sql('d', `set session_replication_role=replica; insert into public.connections(id,tenant_id,source,account_id) values (md5('conn-crm')::uuid,'${A}','csv','crm');
    insert into public.imports(id,tenant_id,file_hash,mapping_version,state,idempotency_key,object_path,total,accepted,rejected,duplicates,pending,connection_id,created_at,updated_at,provenance)
    values (md5('imp-old')::uuid,'${A}',repeat('a',64),'crm-canonical-v1','running','k1','p/o',100,40,50,0,10,md5('conn-crm')::uuid,now()-interval '20 days',now()-interval '20 days','{"mapping":{"profile":"crm-canonical-v1"}}'),
           (md5('imp-new')::uuid,'${A}',repeat('b',64),'v1','running','k2','p/n',100,40,50,0,10,md5('conn-crm')::uuid,now(),now(),'{}')`);
  for (const f of files) {
    const text = fs.readFileSync(path.join(here, f), 'utf8');
    const code = text.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    check(`${f}: sin palabras de escritura (insert/update/delete/drop/alter/truncate/create/grant/revoke)`, !/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i.test(code.replace(/'[^']*'/g, "''")));
    if (SKIP.has(f)) { console.log(`SKIP ${f} (requiere pg_stat_statements; no probado localmente)`); continue; }
    const r = pg.psql('d', ['-At', '-c', 'begin read only', '-f', path.join(here, f), '-c', 'rollback'], {allowFail: true});
    check(`${f}: se ejecuta en transaccion READ ONLY sin error`, r.status === 0, (r.stderr || '').split('\n')[0]);
    if (f.startsWith('02-')) check('02: detecta el job running con lease y deadline vencidos', r.stdout.includes('|t|') && /import\|running/.test(r.stdout), '');
    if (f.startsWith('03-')) check('03: lista el import de 20 dias y no el de hoy', r.stdout.includes(pg.sql('d', "select md5('imp-old')::uuid")) && !r.stdout.includes(pg.sql('d', "select md5('imp-new')::uuid")));
    if (f.startsWith('01-')) check('01: cuenta 1 job con lease vencida', /import\|running\|1\|0\|1\|1\|/.test(r.stdout), r.stdout.split('\n')[0]);
  }
} catch (e) { console.error(e); check('infra', false); }
finally { if (pg) await pg.stop(); }
const ok = results.length && results.every(Boolean); console.log(ok ? 'ALL PASS' : 'FAILED'); process.exitCode = ok ? 0 : 1;
