#!/usr/bin/env node
// Prueba local de las compuertas (gates.sql) y de la plantilla: la compuerta es true solo con trabajo reclamable y la parte
// `where <compuerta>` del comando de pg_cron es SQL valido y evita la llamada cuando no hay trabajo (se simula net.http_post con una funcion local).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startLocalPg} from '../lib/localpg.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const results = []; const check = (n, p, d = '') => { results.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + (d ? ' ' + d : '')); };
let pg;
try {
  pg = await startLocalPg({label: 'sched'}); pg.createDb('d'); pg.applySchema('d');
  const A = pg.sql('d', "insert into public.organizations(id,name) values (md5('t')::uuid,'t') returning id");
  const gates = () => Object.fromEntries(pg.sql('d', fs.readFileSync(path.join(here, 'gates.sql'), 'utf8')).split('\n').map(l => l.split('|')));
  const g0 = gates();
  check('sin jobs: ninguna compuerta abierta', Object.values(g0).every(v => v === 'f'), JSON.stringify(g0));
  const ins = (type, state, extra = '') => pg.sql('d', `set session_replication_role=replica; insert into public.jobs(tenant_id,type,state,input_ref,input_hash,version,lease_until,next_attempt_at${extra ? ',cancel_requested_at' : ''}) values ('${A}','${type}','${state}','r',md5(random()::text),'v',${state === 'running' ? "now()-interval '1 minute'" : 'null'},now()-interval '1 second'${extra ? ',now()' : ''})`);
  ins('import', 'queued');
  check('import en cola: abre solo imports', gates().imports === 't' && gates().extraction === 'f');
  ins('extraction', 'running');
  check('extraction running con lease vencida: abre extraction (reclamable)', gates().extraction === 't');
  pg.sql('d', "update public.jobs set lease_until=now()+interval '5 minutes' where type='extraction'");
  check('extraction running con lease VIGENTE: compuerta cerrada (nadie debe reclamar)', gates().extraction === 'f');
  ins('embedding', 'queued', 'cancel');
  check('embedding con cancelacion pedida: compuerta cerrada', gates().problems === 'f');
  pg.sql('d', "update public.jobs set state='succeeded' where type='import'");
  check('import terminado: compuerta cerrada', gates().imports === 'f');
  // Simula net.http_post: cuenta llamadas hechas por el comando con compuerta.
  pg.sql('d', "create table calls(n int); create function http_post_sim() returns int language sql as $$ insert into calls values (1) returning 1 $$");
  const gate = "exists(select 1 from public.jobs where type='import' and cancel_requested_at is null and next_attempt_at<=now() and (state='queued' or (state='running' and lease_until<=now())))";
  const cmd = `select http_post_sim() where ${gate}`;
  pg.sql('d', cmd); check('sin trabajo: el comando NO llama al endpoint', pg.sql('d', 'select count(*) from calls') === '0');
  ins('import', 'queued'); pg.sql('d', cmd); check('con trabajo: el comando llama al endpoint una vez', pg.sql('d', 'select count(*) from calls') === '1');
  const tpl = fs.readFileSync(path.join(here, 'pg_cron-gated.TEMPLATE.sql'), 'utf8');
  check('plantilla: exige aprobacion interactiva y secreto en Vault (no hay literales de secreto)', /sched_approved/.test(tpl) && /vault\.decrypted_secrets/.test(tpl) && !/Bearer [A-Za-z0-9]{20,}/.test(tpl));
} catch (e) { console.error(e); check('infra', false); }
finally { if (pg) await pg.stop(); }
const ok = results.length && results.every(Boolean); console.log(ok ? 'ALL PASS' : 'FAILED'); process.exitCode = ok ? 0 : 1;
