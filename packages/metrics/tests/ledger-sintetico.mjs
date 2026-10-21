// Libro económico SINTÉTICO a escala real (por defecto 85,361 asientos) para medir y probar las vistas económicas acotadas.
// Distribución como la del tenant real: Shopify 883 pedidos, Amazon ~56 mil pedidos USD (+ algunos CAD/MXN), Mirakl US/CA ~4 mil, Walmart ~3 mil reembolsos,
// ~3 mil devoluciones de Amazon sin importe, resto de marketplaces; una fracción con revisiones múltiples y algunas reversiones.
// Se inserta como superusuario con los disparadores de usuario desactivados SOLO en la carga (los asientos son datos de prueba, SYN-*).
import {psqlFile, TENANT_A, OWNER, sembrarUsuarios} from '../../ai-scale/economia-problemas/mundo.mjs';
import {sourcesSql} from '../../economics/emit-sql.mjs';
import {sourceIdFor} from '../../economics/marketplace-map.mjs';

export const BASIS_ORDER = 'marketplace_line_price', BASIS_REFUND = 'marketplace_refund_amount', BASIS_SHOPIFY = 'gross_order_including_tax_shipping';
const REP = 'SYN libro: registro sintético de prueba con procedencia documentada, sin datos de clientes.';
export const FUENTES = (() => {
  const mk = (key, type, label) => ({key, sourceId: sourceIdFor(key), name: label, evidenceType: type, active: true, complete: true, windowStart: '2025-10-01T00:00:00.000Z', windowEnd: '2026-10-06T00:00:00.000Z', watermark: '2026-10-06T00:00:00.000Z', report: REP + ' Fuente ' + key});
  return Object.fromEntries([mk('amazon-pedidos', 'order_export', 'SYN Amazon pedidos'), mk('mirakl-pedidos', 'order_export', 'SYN Mirakl pedidos'), mk('otros-pedidos', 'order_export', 'SYN Otros marketplaces pedidos'), mk('shopify-pedidos', 'order_export', 'SYN Shopify pedidos'),
    mk('walmart-devoluciones', 'payment_ledger', 'SYN Walmart devoluciones'), mk('amazon-devoluciones', 'payment_ledger', 'SYN Amazon devoluciones'), mk('shopify-reembolsos', 'payment_ledger', 'SYN Shopify reembolsos')].map(f => [f.key, f]));
})();

/** Base mínima: organizaciones, usuarios, membresías y fuentes (vía la función real de emisión). Después, `cargarAsientos`. */
export function sembrarBase(h) {
  h.psql(`insert into public.organizations(id,name) values('${TENANT_A}','SYN'),('bbbbbbbb-0000-4000-8000-000000000001','SYNB')`);
  sembrarUsuarios(h);
  const r = psqlFile(h.sock, sourcesSql(TENANT_A, Object.values(FUENTES), OWNER.A));
  if (r.status !== 0) throw Error('fuentes: ' + r.stderr.slice(0, 400));
}

/** Segmentos: [fuente, kind, n, moneda, base, estado dominante, cada-cuántos sin importe]. */
export const SEGMENTOS = [
  ['shopify-pedidos', 'order', 883, 'USD', BASIS_SHOPIFY, 'recorded', 0],
  ['shopify-reembolsos', 'refund', 60, 'USD', BASIS_SHOPIFY, 'settled', 0],
  ['amazon-pedidos', 'order', 54500, 'USD', BASIS_ORDER, 'recorded', 140],
  ['amazon-pedidos', 'order', 700, 'CAD', BASIS_ORDER, 'recorded', 0],
  ['amazon-pedidos', 'order', 600, 'MXN', BASIS_ORDER, 'recorded', 0],
  ['mirakl-pedidos', 'order', 2500, 'USD', BASIS_ORDER, 'recorded', 0],
  ['mirakl-pedidos', 'order', 1500, 'CAD', BASIS_ORDER, 'recorded', 0],
  ['walmart-devoluciones', 'refund', 3000, 'USD', BASIS_REFUND, 'settled', 0],
  ['amazon-devoluciones', 'refund', 3272, 'USD', BASIS_REFUND, 'unknown', 1],
  ['otros-pedidos', 'order', 12000, 'USD', BASIS_ORDER, 'recorded', 0],
];

/**
 * Inserta `total` asientos (por defecto 85,361). Pedidos: ~96 % recorded, ~2 % cancelled, ~1 % pending. Reembolsos Walmart settled. Cada `1/revEvery` entidad recibe
 * una revisión 2 (con importe distinto) y 1/10 de ellas una revisión 3; 40 reversiones de reembolsos Walmart. Se recorta/rellena con revisiones hasta el total exacto.
 */
export function cargarAsientos(h, {total = 85361, scale = 1} = {}) {
  const {sock} = h;
  const f = k => FUENTES[k].sourceId;
  const seg = SEGMENTOS.map(([k, kind, n, cur, basis, st, nullEvery], idx) => {
    const m = Math.max(1, Math.round(n * scale));
    const status = kind === 'order' ? `case when i%50=0 then 'cancelled' when i%97=0 then 'pending' when ${nullEvery ? `i%${nullEvery}=0` : 'false'} then 'unknown' else 'recorded' end` : `'${st}'`;
    const amount = `case when ${nullEvery ? `i%${nullEvery}=0` : 'false'} then null else 100 + (abs(hashtextextended(i::text||'${idx}',0))%90000) end`;
    return `insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested)
 select '${TENANT_A}',md5('${k}|${kind}|${cur}|'||i)::uuid,'${f(k)}',1,1,'${OWNER.A}',
  ts+interval '1 day','SYN-${k}-${cur}-'||i,'${kind}',ts,'${cur}',2,'${basis}',${amount},${status},'{}'::jsonb,'${REP}',repeat('a',64),true
 from (select i,timestamptz '2025-10-02 00:00:00+00'+ (abs(hashtextextended(i::text||'t${idx}',0))%360)*interval '1 day' + (abs(hashtextextended(i::text||'h${idx}',0))%86400)*interval '1 second' ts from generate_series(1,${m}) i) g;`;
  }).join('\n');
  const sql = `set session_replication_role=replica;set statement_timeout=0;
 alter table public.economic_ledger_entries disable trigger user;
 ${seg}
 -- reversiones de reembolsos Walmart (importe negativo, nunca superior al original)
 insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,reversal_of,details,report,report_hash,attested)
 select tenant_id,md5('rev|'||entity_id::text)::uuid,source_id,1,1,actor_id,recorded_at+interval '1 hour','SYN-rev-'||external_id,'reversal',effective_at+interval '1 hour',currency,exponent,basis,-(amount_minor/4)::bigint,'settled',entity_id,'{}'::jsonb,report,report_hash,true
 from (select * from public.economic_ledger_entries where kind='refund' and source_id='${f('walmart-devoluciones')}' and amount_minor is not null order by entity_id limit ${Math.max(1, Math.round(40 * scale))}) r;
 -- revisiones: 1/14 de las entidades base reciben rev 2 (distinto importe) y 1/10 de ellas rev 3
 create temp table _base as select * from public.economic_ledger_entries where revision=1 and kind<>'reversal';
 create temp table _need as select greatest(0,${total}-(select count(*) from public.economic_ledger_entries)) n;
 insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,details,report,report_hash,attested)
 select tenant_id,entity_id,source_id,source_version,2,actor_id,recorded_at+interval '2 days',external_id,kind,effective_at,currency,exponent,basis,case when amount_minor is null then null else amount_minor+7 end,status,order_id,details,report,report_hash,true
 from (select * from _base where abs(hashtextextended(entity_id::text,1))%14=0 order by entity_id limit (select n from _need)) r;
 insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,details,report,report_hash,attested)
 select tenant_id,entity_id,source_id,source_version,3,actor_id,recorded_at+interval '3 days',external_id,kind,effective_at,currency,exponent,basis,case when amount_minor is null then null else amount_minor+3 end,status,order_id,details,report,report_hash,true
 from public.economic_ledger_entries e where revision=2 and abs(hashtextextended(entity_id::text,2))%10=0 and (select count(*) from public.economic_ledger_entries)<${total};
 -- relleno exacto con más revisiones 2 de entidades aún sin revisión
 insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,recorded_at,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,details,report,report_hash,attested)
 select tenant_id,entity_id,source_id,source_version,2,actor_id,recorded_at+interval '2 days',external_id,kind,effective_at,currency,exponent,basis,case when amount_minor is null then null else amount_minor+11 end,status,order_id,details,report,report_hash,true
 from (select b.* from _base b where not exists(select 1 from public.economic_ledger_entries x where x.entity_id=b.entity_id and x.revision=2) order by b.entity_id limit greatest(0,${total}-(select count(*) from public.economic_ledger_entries))) r;
 alter table public.economic_ledger_entries enable trigger user;
 drop table _base,_need;
 analyze public.economic_ledger_entries;`;
  const r = psqlFile(sock, sql);
  if (r.status !== 0) throw Error('asientos: ' + String(r.stderr).slice(0, 600));
  return Number(h.psql('select count(*) from public.economic_ledger_entries').out);
}
