// Mundo SINTÉTICO a la escala medida en producción el 22-oct (CLIENTEX): 394 problemas, 14,796 miembros, 8,858 corridas succeeded.
// La evidencia es REAL para el verificador (persistence del flujo de producción: hashes, manifiestos, input_hash); solo los vectores son de relleno ('[0]').
// Todo identificador es sintético (uuid de prueba / SYN-). Ningún dato de clientes.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {conversacion, sembrarUsuarios, TENANT_A, TENANT_B, OWNER, U} from '../../ai-scale/economia-problemas/mundo.mjs';
import {persistenceSql} from '../../ai-scale/persistir.mjs';
import {SEED_SQL} from '../../ai-scale/test-pg.mjs';
import * as N from '../../ai-scale/problemas/nucleo.mjs';
import {cerrar} from '../../ai-scale/problemas/agrupar.mjs';

export {TENANT_A, TENANT_B, OWNER, U};
export const VERSION = N.defaultVersion('mensaje');
const CATS = ['Envío: No recibido', 'Pago: Cobro duplicado', 'Garantía: Batería'];
// Texto de ~2.6 KB poco compresible (como un correo real de soporte), para que el costo de cargar texto de evidencia sea medible.
const cuerpo = n => { let t = ''; for (let k = 0; t.length < 2600; k++) t += [...createHash('sha256').update('SYN' + n + ':' + k).digest()].map(b => String.fromCharCode(97 + b % 26)).join('').replace(/(.{3,9}?)(?=.)/g, '$1 ').slice(0, 64) + ' '; return t; }; // solo letras: la redacción de PII no lo colapsa
const lit = v => "'" + String(v).replace(/'/g, "''") + "'";
const psqlFile = (sock, sql, tx = true) => spawnSync('psql', ['-h', sock, '-U', 'postgres', '-d', 't', '-q', ...(tx ? ['-1'] : []), '-v', 'ON_ERROR_STOP=1', '-f', '-'], {input: sql + '\n', encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
const must = (r, what) => { if (r.status !== 0) throw Error(what + ': ' + String(r.stderr).slice(0, 400)); };

/** n corridas (una conversación de 2 mensajes cada una), `members` miembros repartidos en `problems` problemas. Devuelve ids para las pruebas. */
export function construirEscala(h, {tenant = TENANT_A, runs = 8858, members = 14796, problems = 394, base = 1} = {}) {
  const convs = [];
  for (let i = 0; i < runs; i++) convs.push(conversacion({tenant, n: base + i, cat: CATS[i % 3], text: `SYN reclamo ${base + i}: ` + cuerpo(base + i), ext: 'SYN-' + (base + i), cluster: i % problems}));
  // 1) conversaciones/mensajes/revisiones fuente, por lotes (un solo psql por lote)
  const CH = 400;
  let firstOrg = true;
  for (let a = 0; a < convs.length; a += CH) {
    const stmts = [];
    for (const c of convs.slice(a, a + CH)) {
      const o = {tenant: c.tenant, conn: U(5000000 + c.n), conv: c.conv.conversation_id, csrev: U(6000000 + c.n), msgs: c.conv.messages.map((m, i) => ({id: m.id, rev: m.revision_id, srev: U(7000000 + c.n * 2 + i), role: m.role}))};
      let sql = SEED_SQL(o);
      if (!firstOrg) sql = sql.replace(/^\s*insert into public\.organizations[^\n]*\n/m, ''); firstOrg = false;
      sql = sql.replace("values('" + o.conn + "','" + o.tenant + "','csv','acc')", "values('" + o.conn + "','" + o.tenant + "','csv','acc" + c.n + "')").replaceAll("'c1'", lit(c.ext));
      stmts.push(sql.replace(/;\s*$/, '') + ';');
    }
    must(psqlFile(h.sock, stmts.join('\n')), 'semilla');
  }
  must(psqlFile(h.sock, `update public.source_revisions s set snapshot=jsonb_build_array(jsonb_build_object('table','messages','row',jsonb_build_object('id',m.id,'role',m.role,'conversation_id',m.conversation_id))) from public.messages m where s.entity_type='message' and s.canonical_id=m.id and s.tenant_id=m.tenant_id and s.tenant_id='${tenant}';`), 'snapshot');
  // 2) corridas de extracción con el flujo REAL de persistencia
  for (let a = 0; a < convs.length; a += CH) must(psqlFile(h.sock, persistenceSql(convs.slice(a, a + CH).map(c => c.p), {tenant, commit: true}), false), 'persistir');
  return convs;
}

/** Embeddings + problemas + miembros + versiones (problem_versions por el camino real: contexto owner 'configure'). */
export function construirCatalogo(h, convs, {tenant = TENANT_A, members = 14796, problems = 394, prefijo = 'SYN Problema', offset = 0} = {}) {
  const model = N.EMBED_MODEL, T = lit(tenant) + '::uuid';
  const pid = k => U(8000000 + offset + k), eid = j => U(9000000 + offset * 100 + j);
  const pids = Array.from({length: problems}, (_, k) => pid(k));
  must(psqlFile(h.sock, `insert into public.problems(id,tenant_id,title,provenance,severity,cause_status) values ${pids.map((p, k) => `(${lit(p)},${T},${lit(prefijo + ' ' + k + ' — ' + CATS[k % 3])},'{"kind":"vector-problem-v1"}'::jsonb,'high','unknown')`).join(',')};`), 'problemas');
  // miembro j -> corrida (j % runs), mensaje (j < runs ? cliente : agente); problema = (corrida % problems): todas las corridas tienen al menos 1 miembro
  const runs = convs.length, rows = [];
  for (let j = 0; j < members; j++) { const i = j % runs, c = convs[i], rev = c.conv.messages[j < runs ? 0 : 1].revision_id; rows.push([eid(j), rev, c.p.runId, c.conv.conversation_id, pid(i % problems)]); }
  for (let a = 0; a < rows.length; a += 1500) {
    const part = rows.slice(a, a + 1500), vals = part.map(r => `(${lit(r[0])},${lit(r[1])},${lit(r[2])},${lit(r[3])},${lit(r[4])})`).join(',');
    must(psqlFile(h.sock, `insert into public.embeddings(id,tenant_id,model_id,dim,version,content,embedding,message_revision_id,provenance)
      select v.id::uuid,${T},${lit(model)},${N.EMBED_DIM},${lit(VERSION)},'SYN','[0]'::text,v.rid::uuid,jsonb_build_object('source',${lit(N.SOURCE)},'extractionRunId',v.run,'kind','vector-problem-v1') from (values ${vals}) v(id,rid,run,conv,p);
      insert into public.problem_embedding_members(tenant_id,embedding_id,problem_id,extraction_run_id,conversation_id)
      select ${T},v.id::uuid,v.p::uuid,v.run::uuid,v.conv::uuid from (values ${vals}) v(id,rid,run,conv,p);`), 'miembros');
  }
  for (let a = 0; a < pids.length; a += 100) must(psqlFile(h.sock, cerrar(N.sentenciasVersiones(pids.slice(a, a + 100), {tenant, model, version: VERSION}), true).join('\n'), false), 'versiones');
  return {pids, pid, eid};
}

/** Tenant A a escala de producción y tenant B pequeño (para pruebas negativas de aislamiento). Devuelve {A,B}. */
export function mundoEscala(h, {runs = 8858, members = 14796, problems = 394, runsB = 40, membersB = 60, problemsB = 3} = {}) {
  const convsA = construirEscala(h, {tenant: TENANT_A, runs, base: 1});
  const convsB = construirEscala(h, {tenant: TENANT_B, runs: runsB, base: 100000});
  sembrarUsuarios(h);
  const A = construirCatalogo(h, convsA, {tenant: TENANT_A, members, problems}), B = construirCatalogo(h, convsB, {tenant: TENANT_B, members: membersB, problems: problemsB, prefijo: 'SYN Problema B', offset: 5000});
  must(psqlFile(h.sock, 'analyze;', false), 'analyze'); // estadísticas como en producción (autovacuum)
  return {A: {convs: convsA, ...A}, B: {convs: convsB, ...B}};
}
