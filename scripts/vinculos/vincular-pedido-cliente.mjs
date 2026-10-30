#!/usr/bin/env node
// Vinculo PEDIDO -> CLIENTE determinista (solo coincidencias EXACTAS por clave; sin nombres, sin similitud, sin inventar).
// Dry-run por defecto. Escribe solo con --execute y todas las guardas (mismo patron que importar-vinculos.mjs). Reversible. Idempotente.
//
//   node vincular-pedido-cliente.mjs medir  --pares pares-economia.jsonl (--supabase-linked | --pg-socket DIR)         # SELECT: embudo por clave, solo conteos
//   node vincular-pedido-cliente.mjs --pares pares-economia.jsonl (--supabase-linked | --pg-socket DIR)               # DRY-RUN: plan + recibo local 0600
//   node vincular-pedido-cliente.mjs --pares F --supabase-linked --execute --confirmar-proyecto proyecto-ejemplo \
//        --owner <uuid owner activo> --atestacion-archivo F --atestacion-sha256 <sha256 de F> [--max 300]            # escribe (lotes atomicos)
//   node vincular-pedido-cliente.mjs --pares F ... --accion revertir --execute ...                                      # desactiva solo lo creado por este programa
//
// Cadena (todas las llaves son identificadores exactos, ninguna es un nombre):
//   pedido (entity_id del libro) --[pares-economia.jsonl: ticket HubSpot + marketplace + order_id exactos]--> ticket
//   ticket --K1 hecho nativo (ticket_id, contact_id) | K2 vinculo vigente conversacion-cliente | K3 conversations.customer_id--> cliente (customers)
//   Un pedido se liga SOLO si todas las llaves que responden apuntan a UN solo cliente vigente y todos sus tickets coinciden en ese cliente.
// ROTULO: toda coincidencia por ticket es **Inferido** (contacto de soporte del pedido, no prueba de comprador). «Observado» queda reservado a una
//   fuente que traiga el id/correo del comprador en el propio pedido (hoy ninguna). Ingreso bruto; nunca margen.
// Escribe: economic_order_customers (pedido -> customer_key) y workspace_customer_identity_versions (customer_key -> cliente), ambas atestadas por un owner.
// Entrada: pares-economia.jsonl local (0600). Nunca se imprimen ids de pedidos, tickets ni clientes: solo conteos. Recibos locales 0600.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TENANT, PROJECT_REF, sha256, contextoSql, ejecutor, dentroDeTope, lineasDeSalida, textoDeSalida} from './importar-vinculos.mjs';

export const VERSION = 'v1';
export const MARCA = '[vinculo-pedido-cliente ' + VERSION;
export const ROTULO = 'Inferido';
export const KEY_PREFIX = 'hubspot-contacto:';
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const lit = v => v === null || v === undefined ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const scrub = s => String(s ?? '').replace(/postgres(?:ql)?:\/\/\S+/gi, '[url]').replace(/\b\d{9,}\b/g, '[n]');
const T = lit(TENANT) + '::uuid';
const trozos = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const escribir = (f, s) => { fs.writeFileSync(f, s, {mode: 0o600}); fs.chmodSync(f, 0o600); return f; };

// ------------------------------------------------------------------------------------------------ entrada
/** Lee pares-economia.jsonl. Solo pedidos (kind=order). Devuelve {pares:[{ticket,entityId}], descartados:{...}}; ticket numerico exacto, entityId uuid. Sin duplicados. */
export function leerPares(text) {
  const out = [], vistos = new Set(), descartados = {no_pedido: 0, ticket_invalido: 0, entity_invalido: 0, repetido: 0, json_invalido: 0};
  for (const linea of text.split('\n')) {
    if (!linea.trim()) continue;
    let p; try { p = JSON.parse(linea); } catch { descartados.json_invalido++; continue; }
    if (p.kind !== 'order') { descartados.no_pedido++; continue; }
    const ticket = String(p.ticket ?? '').trim(), entityId = String(p.entityId ?? '').trim().toLowerCase();
    if (!/^\d{5,20}$/.test(ticket)) { descartados.ticket_invalido++; continue; }
    if (!UUID.test(entityId)) { descartados.entity_invalido++; continue; }
    const k = ticket + '|' + entityId; if (vistos.has(k)) { descartados.repetido++; continue; } vistos.add(k);
    out.push({ticket, entityId});
  }
  return {pares: out, descartados};
}

// ------------------------------------------------------------------------------------------------ SQL de lectura
const values = pares => pares.map((p, i) => `(${i},${lit(p.ticket)},${lit(p.entityId)}::uuid)`).join(',\n');
const ownerActivo = u => `exists(select 1 from public.memberships m where m.tenant_id=${T} and m.user_id=${u} and m.status='active' and m.role='owner')`;

/** CTEs comunes: ledger vigente + clientes por cada llave. Una fila por (par, cliente candidato). */
function ctes(pares) {
  return `par(idx,ticket,entity_id) as (values
${values(pares)}),
led as (
  select p.idx,p.ticket,p.entity_id,e.id as row_id,e.kind,
    (e.id is not null and e.revision=(select max(v.revision) from public.economic_ledger_entries v where v.tenant_id=${T} and v.entity_id=e.entity_id)) as ultima,
    coalesce(${ownerActivo('e.actor_id')},false) as actor_ok,
    exists(select 1 from (select sv.active,sv.actor_id from public.economic_source_versions sv where sv.tenant_id=${T} and sv.source_id=e.source_id order by sv.version desc limit 1) x
           where x.active and ${ownerActivo('x.actor_id')}) as fuente_ok
  from par p left join lateral (select * from public.economic_ledger_entries z where z.tenant_id=${T} and z.entity_id=p.entity_id order by z.revision desc limit 1) e on true),
-- clientes con revision vigente (cabeza unique|selected, conexion activa): lo que exige el guard de identidad de 0024
cli as (
  select c.id as customer_id,c.external_id,h.selected_revision_id as rev_id
  from public.customers c join public.source_heads h on h.tenant_id=c.tenant_id and h.id=c.id and h.entity_type='customer' and h.state in ('unique','selected')
  join public.connections cn on cn.tenant_id=c.tenant_id and cn.id=h.connection_id and cn.status='active'
  join public.source_revisions r on r.tenant_id=c.tenant_id and r.id=h.selected_revision_id and r.canonical_id=c.id and r.entity_type='customer'
  where c.tenant_id=${T}),
k1_raw as (
  select distinct p.idx,f.contact_id from par p join public.native_customer_associations f on f.tenant_id=${T} and f.ticket_id=p.ticket and f.resolution_state in ('pending','resolved')),
k1 as (select k.idx,'K1'::text as llave,c.customer_id from k1_raw k join cli c on c.external_id=k.contact_id),
k2 as (
  select distinct p.idx,'K2'::text as llave,b.customer_id
  from par p join public.conversations cv on cv.tenant_id=${T} and cv.deleted_at is null and (cv.external_id='hubspot:'||p.ticket or (cv.source='hubspot' and cv.external_id=p.ticket))
  join public.conversation_customer_association_bindings b on b.tenant_id=${T} and b.conversation_id=cv.id and b.active
  join cli c on c.customer_id=b.customer_id),
k3 as (
  select distinct p.idx,'K3'::text as llave,cv.customer_id
  from par p join public.conversations cv on cv.tenant_id=${T} and cv.deleted_at is null and cv.customer_id is not null and (cv.external_id='hubspot:'||p.ticket or (cv.source='hubspot' and cv.external_id=p.ticket))
  join cli c on c.customer_id=cv.customer_id),
cand as (select * from k1 union all select * from k2 union all select * from k3)`;
}

/** SELECT de solo lectura: embudo por clave (solo conteos). Una fila JSON tras el marcador VINCULO_PC_MEDIDA. */
export function medirSql(pares, {tenant = TENANT} = {}) {
  if (!TENANT || tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  if (!pares.length) throw new Error('SIN_PARES');
  return `begin read only;
with ${ctes(pares)},
res as (select idx,count(distinct customer_id) n_cli,array_agg(distinct llave order by llave) llaves from cand group by idx)
select 'VINCULO_PC_MEDIDA '||json_build_object(
 'pares',(select count(*) from par),
 'pedido_vigente',(select count(*) from led where row_id is not null and kind='order' and ultima and actor_ok and fuente_ok),
 'pedido_inexistente',(select count(*) from led where row_id is null),
 'k1_hecho_nativo_ticket_contacto',(select count(distinct idx) from k1_raw),
 'k1_con_cliente_vigente',(select count(distinct idx) from k1),
 'k2_vinculo_conversacion',(select count(distinct idx) from k2),
 'k3_conversacion_customer_id',(select count(distinct idx) from k3),
 'pares_con_algun_cliente',(select count(*) from res),
 'pares_con_un_cliente',(select count(*) from res where n_cli=1),
 'pares_ambiguos_varios_clientes',(select count(*) from res where n_cli>1),
 'pares_un_cliente_solo_k1',(select count(*) from res where n_cli=1 and llaves=array['K1']),
 'pares_un_cliente_k1_y_otra',(select count(*) from res where n_cli=1 and llaves@>array['K1'] and cardinality(llaves)>1),
 'vinculos_previos_vigentes',(select count(distinct l.entity_id) from public.economic_order_customers l where l.tenant_id=${T} and l.customer_key is not null and l.version=(select max(v.version) from public.economic_order_customers v where v.tenant_id=${T} and v.entity_id=l.entity_id))
)::text as resultado;
rollback;
`;
}

/** SELECT de solo lectura: clasifica cada par. Una fila JSON por par tras el marcador VINCULO_PC_PLAN. */
export function planSql(pares, {accion = 'importar', tenant = TENANT} = {}) {
  if (!TENANT || tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  if (!pares.length) throw new Error('SIN_PARES');
  return `begin read only;
with ${ctes(pares)},
res as (
  select idx,count(distinct customer_id) n_cli,(array_agg(distinct customer_id))[1] customer_id,array_agg(distinct llave order by llave) llaves from cand group by idx),
det as (
  select l.idx,l.entity_id,l.row_id,l.kind,l.ultima,l.actor_ok,l.fuente_ok,coalesce(r.n_cli,0) n_cli,r.customer_id,r.llaves,
    c.external_id as customer_ext,c.rev_id,
    exists(select 1 from k1_raw k where k.idx=l.idx) as hay_k1,
    (select o.version from public.economic_order_customers o where o.tenant_id=${T} and o.entity_id=l.entity_id order by o.version desc limit 1) as prev_version,
    (select o.customer_key from public.economic_order_customers o where o.tenant_id=${T} and o.entity_id=l.entity_id order by o.version desc limit 1) as prev_key,
    (select position(${lit(MARCA)} in o.report)>0 from public.economic_order_customers o where o.tenant_id=${T} and o.entity_id=l.entity_id order by o.version desc limit 1) as prev_nuestro,
    (select i.version from public.workspace_customer_identity_versions i where i.tenant_id=${T} and i.customer_key=${lit(KEY_PREFIX)}||c.external_id order by i.version desc limit 1) as ident_version,
    (select i.customer_id from public.workspace_customer_identity_versions i where i.tenant_id=${T} and i.customer_key=${lit(KEY_PREFIX)}||c.external_id order by i.version desc limit 1) as ident_customer,
    (select i.active from public.workspace_customer_identity_versions i where i.tenant_id=${T} and i.customer_key=${lit(KEY_PREFIX)}||c.external_id order by i.version desc limit 1) as ident_active
  from led l left join res r on r.idx=l.idx left join cli c on c.customer_id=r.customer_id)
select 'VINCULO_PC_PLAN '||json_build_object('idx',idx,'entity_id',entity_id,'row_id',row_id,'customer_id',customer_id,'rev_id',rev_id,'customer_key',case when customer_ext is null then null else ${lit(KEY_PREFIX)}||customer_ext end,
  'llaves',llaves,'prev_version',prev_version,'ident_version',ident_version,'estado',
  ${accion === 'revertir'
    ? `case when prev_version is null then 'sin_vinculo' when prev_key is null then 'ya_inactivo' when not coalesce(prev_nuestro,false) then 'no_creado_por_este_programa' else 'revertir' end`
    : `case when row_id is null then 'pedido_inexistente'
         when kind<>'order' then 'tipo_no_permitido'
         when not (ultima and actor_ok and fuente_ok) then 'pedido_no_vigente'
         when n_cli>1 then 'cliente_ambiguo'
         when n_cli=0 and hay_k1 then 'contacto_sin_cliente_vigente'
         when n_cli=0 then 'ticket_sin_cliente'
         when ident_version is not null and (ident_customer is distinct from customer_id or not ident_active) then 'identidad_previa_distinta'
         when prev_key is not null and prev_key=${lit(KEY_PREFIX)}||customer_ext then 'ya_vigente'
         when prev_key is not null then 'conflicto_con_vinculo_previo'
         else 'nuevo' end`})::text as resultado
from det order by idx;
rollback;
`;
}

// ------------------------------------------------------------------------------------------------ escritura
/** Reporte que se guarda en la base: atestacion del owner + regla aplicada (sin datos de personas ni de pedidos). */
export function textoReporte({atestacion, parSha}) {
  const r = `${String(atestacion).trim()}\n${MARCA} lote=${parSha.slice(0, 12)} rotulo=${ROTULO} regla=pedido->ticket exacto (marketplace+order_id) y ticket->cliente exacto (K1 hecho nativo ticket-contacto, K2 vinculo conversacion-cliente, K3 conversations.customer_id) sin nombres ni similitud; contacto del ticket, no prueba de comprador]`;
  if (r.length < 20 || r.length > 4000) throw new Error('REPORTE_FUERA_DE_RANGO');
  if (/[$\u0000]/.test(r)) throw new Error('REPORT_CARACTER_NO_PERMITIDO');
  return r;
}

/**
 * Lote ATOMICO. items: {entityId,rowId,customerKey|null,expected,customerId,revId,identNueva(bool),identExpected}. activo=false (reversa): customerKey null.
 * Orden: economic_order_customers primero (el guard de identidad exige que el key ya exista), luego la identidad key->cliente.
 */
export function loteSql({owner, items, activo, etiqueta, report, timeoutMs = 60000, lockMs = 10000, setRole = true}) {
  if (!items.length) throw new Error('LOTE_VACIO');
  if (!UUID.test(owner)) throw new Error('OWNER_INVALIDO');
  if (report.length < 20 || report.length > 4000) throw new Error('REPORT_FUERA_DE_RANGO');
  if (/[$\u0000]/.test(report)) throw new Error('REPORT_CARACTER_NO_PERMITIDO');
  for (const it of items) {
    if (![it.entityId, it.rowId].every(x => UUID.test(x)) || !Number.isInteger(it.expected) || it.expected < 0) throw new Error('ITEM_INVALIDO');
    if (activo && (!it.customerKey || it.customerKey.length > 200 || !it.customerKey.startsWith(KEY_PREFIX) || !UUID.test(it.customerId) || !UUID.test(it.revId))) throw new Error('ITEM_INVALIDO');
    if (!activo && it.customerKey) throw new Error('ITEM_INVALIDO');
  }
  const vals = items.map(it => `(${lit(it.entityId)}::uuid,${lit(it.rowId)}::uuid,${lit(it.customerKey)},${it.expected})`).join(',\n');
  const idents = activo ? [...new Map(items.filter(it => it.identNueva).map(it => [it.customerKey, it])).values()] : [];
  const identSql = idents.length ? `
  insert into public.workspace_customer_identity_versions(tenant_id,customer_key,customer_id,customer_revision_id,version,actor_id,active,report,attested)
  select ${T},q.customer_key,q.customer_id,q.rev_id,1,${lit(owner)}::uuid,true,${lit(report)},true
  from (values ${idents.map(it => `(${lit(it.customerKey)},${lit(it.customerId)}::uuid,${lit(it.revId)}::uuid)`).join(',')}) q(customer_key,customer_id,rev_id)
  where not exists(select 1 from public.workspace_customer_identity_versions i where i.tenant_id=${T} and i.customer_key=q.customer_key);` : '';
  return [
    'begin;',
    contextoSql(owner),
    `set local statement_timeout='${Number(timeoutMs)}ms';`,
    `set local lock_timeout='${Number(lockMs)}ms';`,
    `select pg_advisory_xact_lock(hashtextextended(${lit(TENANT)}||':economic-ledger',0));`,
    `select pg_advisory_xact_lock(hashtextextended(${lit(TENANT)}||':economic-relations',0));`,
    ...(setRole ? ['set local role vexa_backend;'] : []),
    `do $lote$
declare n int;
begin
  insert into public.economic_order_customers(tenant_id,entity_id,order_row_id,customer_key,version,actor_id,report,attested)
  select ${T},p.entity_id,p.row_id,p.customer_key,p.expected+1,${lit(owner)}::uuid,${lit(report)},true
  from (values
${vals}) p(entity_id,row_id,customer_key,expected)
  where coalesce((select max(o.version) from public.economic_order_customers o where o.tenant_id=${T} and o.entity_id=p.entity_id),0)=p.expected;
  get diagnostics n=row_count;
  if n<>${items.length} then raise exception 'VINCULO_PC_LOTE_ABORTADO insertados=% esperados=${items.length}',n; end if;${identSql}
end $lote$;`,
    `select 'VINCULO_PC_RESULT ${etiqueta} pares=${items.length} insertados=${items.length}' as resultado;`,
    'commit;',
  ].join('\n') + '\n';
}

/** Lista cerrada de sentencias del archivo que se ejecutara. */
export function soloPermitidas(sql) {
  const plano = sql.replace(/do \$(ctx|lote)\$[\s\S]*?\$\1\$;/g, 'do $$$1$$;');
  const stm = plano.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  const ok = /^(begin( read only)?|commit|rollback|do \$(ctx|lote)\$|set local (statement_timeout|lock_timeout|role vexa_backend)|select pg_advisory_xact_lock|with par\(|select 'VINCULO_PC_(RESULT|OWNER|PLAN|MEDIDA))/i;
  const inserts = sql.match(/insert\s+into\s+[\w.]+/gi) ?? [];
  const sinStr = sql.replace(/'(?:[^']|'')*'/g, "''");
  const permitidas = /^insert\s+into\s+public\.(economic_order_customers|workspace_customer_identity_versions)$/i;
  return stm.every(s => ok.test(s)) && inserts.length <= 2 && inserts.every(i => permitidas.test(i)) && !/\b(delete|update|drop|alter|truncate|grant|revoke|create|copy)\b/i.test(sinStr);
}

// ------------------------------------------------------------------------------------------------ planificacion
const parseFilas = (out, marca) => lineasDeSalida(out).filter(l => l.startsWith(marca + ' ')).map(l => JSON.parse(l.slice(marca.length + 1)));
export const conteo = xs => xs.reduce((o, x) => (o[x.estado] = (o[x.estado] ?? 0) + 1, o), {});

export function planificar({pares, exec, dir, accion}) {
  const res = new Array(pares.length);
  trozos(pares.map((p, i) => ({...p, i})), 1500).forEach((tz, k) => {
    const f = escribir(path.join(dir, `plan-${accion}-${String(k).padStart(3, '0')}.sql`), planSql(tz, {accion}));
    const r = exec.run(f), filas = parseFilas(r.out, 'VINCULO_PC_PLAN');
    if (r.status !== 0 || filas.length !== tz.length) throw new Error(`PLAN_FALLIDO (codigo ${r.status}, filas ${filas.length}/${tz.length}): ${scrub(r.out.split('\n').filter(l => /ERROR/.test(l)).slice(0, 2).join(' | ')).slice(0, 200)}`);
    for (const x of filas) res[tz[x.idx].i] = {ticket: tz[x.idx].ticket, entityId: x.entity_id, rowId: x.row_id, customerId: x.customer_id, revId: x.rev_id, customerKey: x.customer_key, llaves: x.llaves, prevVersion: x.prev_version, identVersion: x.ident_version, estado: x.estado};
  });
  return res;
}

/**
 * Consolida pares -> UN vinculo por pedido. Un pedido con varios tickets solo se liga si todos coinciden en el mismo cliente.
 * Entrada: filas planificadas (estado 'nuevo' o los demas). Salida: {accionables:[por pedido], estadoPorPedido:Map, conteos}.
 */
export function consolidar(plan, {accion = 'importar'} = {}) {
  const porPedido = new Map();
  for (const p of plan) (porPedido.get(p.entityId) ?? porPedido.set(p.entityId, []).get(p.entityId)).push(p);
  const accionables = [], estados = {};
  const cuenta = e => { estados[e] = (estados[e] ?? 0) + 1; };
  const identVistas = new Set();
  for (const [entityId, ps] of porPedido) {
    if (accion === 'revertir') { const r = ps.find(p => p.estado === 'revertir'); if (r) { accionables.push({entityId, rowId: r.rowId, customerKey: null, expected: r.prevVersion ?? 0}); cuenta('revertir'); } else cuenta(ps[0].estado); continue; }
    const nuevos = ps.filter(p => p.estado === 'nuevo');
    const otros = ps.filter(p => p.estado !== 'nuevo');
    if (!nuevos.length) { cuenta(otros.find(p => p.estado === 'ya_vigente')?.estado ?? otros[0].estado); continue; }
    const clientes = new Set(ps.filter(p => p.customerId).map(p => p.customerId));
    const ambiguoEntre = clientes.size > 1;
    const algunoMalo = otros.some(p => ['cliente_ambiguo', 'identidad_previa_distinta', 'conflicto_con_vinculo_previo'].includes(p.estado));
    if (ambiguoEntre || algunoMalo) { cuenta(ambiguoEntre ? 'conflicto_entre_tickets' : otros.find(p => ['cliente_ambiguo', 'identidad_previa_distinta', 'conflicto_con_vinculo_previo'].includes(p.estado)).estado); continue; }
    const n = nuevos[0];
    const identNueva = n.identVersion == null && !identVistas.has(n.customerKey);
    if (identNueva) identVistas.add(n.customerKey);
    accionables.push({entityId, rowId: n.rowId, customerKey: n.customerKey, customerId: n.customerId, revId: n.revId, expected: n.prevVersion ?? 0, identNueva, llaves: n.llaves});
    cuenta('nuevo');
  }
  return {accionables, estados};
}

// ------------------------------------------------------------------------------------------------ CLI
const entero = (v, nombre, def) => { if (v === null || v === undefined) return def; if (!/^[1-9]\d{0,8}$/.test(v)) throw new Error(`--${nombre} debe ser un entero positivo`); return Number(v); };

export async function main(a) {
  const flag = n => a.includes('--' + n), opt = (n, d = null) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  if (flag('help') || !a.length) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }
  const paresFile = opt('pares'); if (!paresFile) throw new Error('Falta --pares pares-economia.jsonl');
  const tenant = opt('tenant', TENANT); if (!TENANT || tenant !== TENANT) throw new Error('TENANT_NO_AUTORIZADO');
  const texto = fs.readFileSync(paresFile, 'utf8'), parSha = sha256(texto);
  const {pares: todos, descartados} = leerPares(texto);
  const medir = a[0] === 'medir';
  const accion = opt('accion', 'importar'); if (!['importar', 'revertir'].includes(accion)) throw new Error('--accion: importar|revertir');
  const execute = flag('execute');
  const recibos = opt('recibos', path.join(os.homedir(), '.vexa-vinculos', 'recibos-pedido-cliente'));
  const dir = path.join(recibos, parSha.slice(0, 12)); fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const max = entero(opt('max'), 'max', 0), chunk = entero(opt('chunk'), 'chunk', 200), topeTotal = entero(opt('tope-total-s'), 'tope-total-s', 600), timeoutMs = entero(opt('timeout-lote-ms'), 'timeout-lote-ms', 60000);
  if (chunk > 250) throw new Error('--chunk maximo 250');
  const pares = max && !medir ? todos.slice(0, max) : todos;
  const resumen = {version: VERSION, rotulo: ROTULO, accion: medir ? 'medir' : accion, modo: medir ? 'solo-lectura' : execute ? 'execute' : 'dry-run', pares_sha256: parSha, pares_validos: todos.length, descartados, considerados: pares.length};

  const tieneTransporte = !!(opt('pg-socket') || flag('supabase-linked'));
  if (!tieneTransporte) {
    if (execute) throw new Error('--execute exige transporte: --supabase-linked o --pg-socket DIR');
    resumen.validacion = 'SOLO FORMA DEL ARCHIVO: NO se midio contra la base.';
    console.log(JSON.stringify(resumen)); return 0;
  }
  const exec = ejecutor({socket: opt('pg-socket'), linked: flag('supabase-linked'), repo: opt('repo', path.join(os.homedir(), 'vexa'))});

  if (medir) {
    const agg = {};
    trozos(pares, 1500).forEach((tz, k) => {
      const f = escribir(path.join(dir, `medir-${String(k).padStart(3, '0')}.sql`), medirSql(tz));
      const r = exec.run(f), filas = parseFilas(r.out, 'VINCULO_PC_MEDIDA');
      if (r.status !== 0 || filas.length !== 1) throw new Error(`MEDIR_FALLIDO (codigo ${r.status}): ${scrub(r.out.split('\n').filter(l => /ERROR/.test(l)).slice(0, 2).join(' | ')).slice(0, 200)}`);
      for (const [c, v] of Object.entries(filas[0])) agg[c] = (c === 'vinculos_previos_vigentes' ? Math.max(agg[c] ?? 0, +v) : (agg[c] ?? 0) + +v);
    });
    resumen.medida = agg;
    resumen.lectura = 'pares_con_un_cliente / pares = techo de pedidos ligables hoy (distintos pedidos pueden repetirse por varios tickets); todo Inferido.';
    escribir(path.join(dir, 'medida.json'), JSON.stringify(resumen, null, 1));
    console.log(JSON.stringify(resumen)); return 0;
  }

  let atestacion = null, owner = null;
  if (execute) {
    if (opt('confirmar-proyecto') !== PROJECT_REF) throw new Error(`--execute exige --confirmar-proyecto ${PROJECT_REF}`);
    owner = opt('owner'); if (!UUID.test(owner ?? '')) throw new Error('Falta --owner <uuid del owner activo>: la atestacion la hace una persona, no el programa.');
    const af = opt('atestacion-archivo'); if (!af || !fs.existsSync(af)) throw new Error('Falta --atestacion-archivo con el texto escrito y firmado por el owner.');
    const raw = fs.readFileSync(af, 'utf8'); atestacion = raw.trim();
    if (atestacion.length < 20 || atestacion.length > 3000) throw new Error('La atestacion debe tener entre 20 y 3000 caracteres.');
    if (/SIN ATESTAR/i.test(atestacion)) throw new Error('El archivo contiene un marcador de «SIN ATESTAR».');
    if (opt('atestacion-sha256') !== sha256(raw)) throw new Error('--atestacion-sha256 no coincide con el archivo: el owner declara el hash del texto que firmo.');
    if (!fs.existsSync(path.join(dir, `dry-run-${accion}.json`))) throw new Error('Falta un dry-run previo de ESTE archivo y accion (recibo dry-run-' + accion + '.json).');
    resumen.atestacion_sha256 = sha256(raw);
    const f = escribir(path.join(dir, 'owner-check.sql'), `begin read only;\nselect 'VINCULO_PC_OWNER '||count(*) from public.memberships where tenant_id=${T} and user_id=${lit(owner)}::uuid and role='owner' and status='active';\nrollback;\n`);
    const r = exec.run(f); if (r.status !== 0 || !/VINCULO_PC_OWNER 1\b/.test(textoDeSalida(r.out))) throw new Error('OWNER_NO_ACTIVO en el tenant fijado');
  }

  const plan = planificar({pares, exec, dir, accion});
  resumen.plan_por_par = conteo(plan);
  const {accionables, estados} = consolidar(plan, {accion});
  resumen.plan_por_pedido = estados; resumen.accionables = accionables.length;
  if (!execute) {
    escribir(path.join(dir, `dry-run-${accion}.json`), JSON.stringify(resumen, null, 1));
    console.log('DRY-RUN. Nada se escribio en la base.', JSON.stringify(resumen)); return 0;
  }

  const inicio = Date.now(), lotes = []; let hechos = 0, k = 0;
  const report = textoReporte({atestacion, parSha});
  for (const lote of trozos(accionables, chunk)) {
    if (!dentroDeTope(inicio, topeTotal)) { resumen.detenido_por_tope_total = true; break; }
    k++; const etiqueta = `${accion}-${String(k).padStart(4, '0')}`;
    const sql = loteSql({owner, items: lote, activo: accion === 'importar', etiqueta, report, timeoutMs, setRole: !flag('sin-set-role')});
    if (!soloPermitidas(sql)) throw new Error('SQL con sentencias no permitidas');
    const f = escribir(path.join(dir, `lote-${etiqueta}.sql`), sql), t0 = Date.now();
    const r = exec.run(f), ok = r.status === 0 && new RegExp(`VINCULO_PC_RESULT ${etiqueta} pares=${lote.length} insertados=${lote.length}`).test(textoDeSalida(r.out));
    const rec = {etiqueta, pedidos: lote.length, ok, ms: Date.now() - t0, sql_sha256: sha256(sql)};
    if (!ok) rec.error = scrub(r.out.split('\n').filter(l => /ERROR|VINCULO_PC_LOTE_ABORTADO|OWNER_NO_ACTIVO|violat/.test(l)).slice(0, 2).join(' | ')).slice(0, 300);
    lotes.push(rec); escribir(path.join(dir, `recibo-${etiqueta}.json`), JSON.stringify(rec, null, 1));
    if (!ok) { resumen.fallo = rec; break; }
    hechos += lote.length; console.log(`${etiqueta} pedidos=${lote.length} ok ms=${rec.ms}`);
  }
  resumen.lotes = lotes.length; resumen.escritos = hechos; resumen.segundos = Math.round((Date.now() - inicio) / 1000);
  escribir(path.join(dir, `recibo-${accion}-final.json`), JSON.stringify({...resumen, lotes}, null, 1));
  console.log(JSON.stringify(resumen));
  return resumen.fallo ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error('ERROR', scrub(e.message).slice(0, 400)); process.exit(1); });
