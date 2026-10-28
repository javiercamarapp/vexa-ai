#!/usr/bin/env node
// Auditoría de aislamiento entre tenants de TODAS las tablas del esquema `public`.
// Contra una base PostgreSQL real y desechable (contenedores Supabase locales) con todas las migraciones aplicadas.
// Todo local: ningún acceso a Supabase/Vercel remotos, ni red, ni inferencia.
//
// Uso:   node ops/security/tenant-isolation-audit.mjs [--candidate <dir>] [--json <archivo>] [--md <archivo>] [--extra-migrations <dir>]
//        VEXA_CANDIDATE=<dir> equivale a --candidate (por omisión: la raíz de este checkout).
// Exit:  0 sin hallazgos; 1 con hallazgos (crítica/alta/media/baja); 2 error de infraestructura (no hay veredicto).
//
// Reutiliza launch()/candidateInputs() del harness F01-03 (solo lectura; no se edita). Las clasificaciones son:
//   aislada-probada | aislada-solo-estática | global-intencional | hallazgo
// "No probado" nunca se cuenta como pasado: queda en `notTested` con su razón.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {launch,candidateInputs} from '../../tests/acceptance/support/F01-03/harness.mjs';
import {definitions,q,ident} from '../../tests/acceptance/support/F01-03/matrix.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:undefined;};
const candidate=arg('--candidate')??process.env.VEXA_CANDIDATE??root;
const A='00000000-0000-4000-8000-0000000000a1',B='00000000-0000-4000-8000-0000000000b2';
const SEV=['crítica','alta','media','baja'];

// Tablas SIN columna de tenant (o con tenant = su propia clave) que son globales a propósito. Cada una con justificación.
// Una tabla sin columna de tenant que NO esté aquí es hallazgo.
const GLOBAL_INTENCIONAL={
  organizations:{tenantCol:'id',nota:'Raíz de tenants: su propia clave `id` es el tenant; lectura solo para miembros activos, escritura solo backend.'},
};

// Hallazgos revisados a mano y aceptados con justificación. Se informan aparte y no afectan el exit code.
// Solo por (tabla, código) exactos: cualquier otro hallazgo en la misma tabla sigue contando.
const EXCEPCIONES_REVISADAS=[
  {table:'notification_email_receipts',code:'SIN_COLUMNA_TENANT',nota:'Libro global de eventos firmados del proveedor de correo, sin datos de tenant propios. RLS forzado y REVOKE ALL a public/anon/authenticated/service_role (migración 0030): ningún usuario lo alcanza; se liga a un tenant solo vía idempotency_key -> notification_email_messages.'},
  {table:'notification_reconciliation_evidence',code:'POLITICA_SIN_REFERENCIA_TENANT',nota:'Política restringida al rol interno vexa_notification_verifier (nunca un usuario final) con verified_by=session_user: solo lee evidencia que ese mismo verificador escribió; REVOKE ALL al resto (migración 0029). Sin rol de usuario con acceso.'},
];
const exceptions=[];
const findings=[],notTested=[];
const finding=(severity,table,code,detail)=>findings.push({severity,table,code,detail});
const skip=(table,what,reason)=>notTested.push({table,what,reason});

// ---------- infraestructura ----------
let h;
const closeAll=()=>{try{h?.close();}catch(e){console.error('TEARDOWN:',e.message);process.exitCode=2;}h=undefined;};
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{closeAll();process.exit(130);});

function sqlJson(statement){const out=h.sql(statement);return out===''?null:JSON.parse(out);}
// Ejecuta un lote de sentencias como un rol con claims, cada una en su subtransacción; TODO se revierte (ROLLBACK).
function multiProbe(actor,steps,prelude=''){
  const role=actor===null?'anon':actor==='backend'?'supabase_admin':'authenticated';
  const claims=actor&&actor!=='backend'?{sub:actor.id,role}:{role};
  const body=steps.map(s=>`BEGIN
    ${s.sql}
    INSERT INTO exam_result VALUES(jsonb_build_object('id',${q(s.id)},'code','00000','n',affected));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME, message = MESSAGE_TEXT;
    INSERT INTO exam_result VALUES(jsonb_build_object('id',${q(s.id)},'code',SQLSTATE,'constraint',violated,'message',left(message,300)));
  END;`).join('\n');
  const out=h.sql(`BEGIN; CREATE TEMP TABLE exam_result(value jsonb); GRANT ALL ON exam_result TO ${role};
    ${prelude}
    SET LOCAL ROLE ${role}; DO $exam$ DECLARE affected bigint; violated text; message text; BEGIN
    PERFORM set_config('request.jwt.claims',${q(JSON.stringify(claims))},true);
    PERFORM set_config('request.jwt.claim.sub',${q(claims.sub??'')},true);
    ${body}
    END $exam$; RESET ROLE; SELECT coalesce(jsonb_agg(value),'[]'::jsonb) FROM exam_result; ROLLBACK;`);
  return Object.fromEntries(JSON.parse(out).map(r=>[r.id,r]));
}
const tryExec=(stmt)=>sqlJson(`SELECT zz_audit.try_exec(${q(stmt)})`);

// ---------- catálogo ----------
const PRIVS=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
function catalogTables(){
  return sqlJson(`SELECT coalesce(jsonb_agg(x ORDER BY x->>'name'),'[]') FROM (SELECT jsonb_build_object(
    'name',c.relname,'kind',c.relkind::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),
    'partition',c.relispartition,
    'cols',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'typname',t.typname,
        'typtype',t.typtype::text,'base',bt.typname,'notnull',a.attnotnull,'hasdef',a.atthasdef,'gen',a.attgenerated::text,'ident',a.attidentity::text,
        'enum',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=a.atttypid),
        'authUpd',has_column_privilege('authenticated',c.oid,a.attnum,'UPDATE'),
        'anonSel',has_column_privilege('anon',c.oid,a.attnum,'SELECT')) ORDER BY a.attnum)
      FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid LEFT JOIN pg_type bt ON bt.oid=t.typbasetype
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
    'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'cmd',p.polcmd::text,'permissive',p.polpermissive,
        'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'public' ELSE pg_get_userbyid(r) END) FROM unnest(p.polroles) r),
        'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))),'[]') FROM pg_policy p WHERE p.polrelid=c.oid),
    'priv',jsonb_build_object(
      'anon',(SELECT coalesce(jsonb_agg(p),'[]') FROM unnest(ARRAY[${PRIVS.map(q)}]) p WHERE has_table_privilege('anon',c.oid,p)),
      'authenticated',(SELECT coalesce(jsonb_agg(p),'[]') FROM unnest(ARRAY[${PRIVS.map(q)}]) p WHERE has_table_privilege('authenticated',c.oid,p)),
      'public',(SELECT coalesce(jsonb_agg(DISTINCT g.privilege_type),'[]') FROM aclexplode(c.relacl) g WHERE g.grantee=0),
      'anonAnyColSelect',has_any_column_privilege('anon',c.oid,'SELECT')),
    'checks',(SELECT coalesce(jsonb_agg(pg_get_constraintdef(k.oid)),'[]') FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='c'),
    'fks',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'parentSchema',pn.nspname,'parent',pc.relname,
        'cols',(SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num),
        'pcols',(SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num))),'[]')
      FROM pg_constraint k JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace WHERE k.conrelid=c.oid AND k.contype='f'),
    'triggers',(SELECT coalesce(jsonb_agg(tg.tgname),'[]') FROM pg_trigger tg WHERE tg.tgrelid=c.oid AND NOT tg.tgisinternal)
  ) x FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')) s`);
}
function catalogFunctions(){
  return sqlJson(`SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'sig',p.oid::regprocedure::text,'secdef',p.prosecdef,
      'config',p.proconfig,'returnsSet',p.proretset,'rettype',format_type(p.prorettype,null),'argnames',p.proargnames,'argtypes',(SELECT jsonb_agg(format_type(t,null)) FROM unnest(p.proargtypes) t),
      'src',p.prosrc,'owner',pg_get_userbyid(p.proowner),'kind',p.prokind::text,
      'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'public',(p.proacl IS NULL OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) g WHERE g.grantee=0 AND g.privilege_type='EXECUTE'))
    ) ORDER BY n.nspname,p.proname),'[]')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema','zz_audit') AND p.prokind IN ('f','p')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
      AND (n.nspname='public' OR pg_get_userbyid(p.proowner) NOT IN ('supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_etl_admin','pgbouncer','postgres','supabase_replication_admin','supabase_read_only_user'))`);
}
function catalogViews(){
  return sqlJson(`SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind::text,'owner',pg_get_userbyid(c.relowner),'options',c.reloptions,
      'invoker',coalesce(c.reloptions @> ARRAY['security_invoker=true'] OR c.reloptions @> ARRAY['security_invoker=on'],false),
      'barrier',coalesce(c.reloptions @> ARRAY['security_barrier=true'],false),
      'anon',(SELECT coalesce(jsonb_agg(p),'[]') FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p WHERE has_table_privilege('anon',c.oid,p)),
      'authenticated',(SELECT coalesce(jsonb_agg(p),'[]') FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p WHERE has_table_privilege('authenticated',c.oid,p)),
      'deps',(SELECT coalesce(jsonb_agg(DISTINCT t.relname||':'||t.relrowsecurity::text),'[]') FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class t ON t.oid=d.refobjid
         WHERE r.ev_class=c.oid AND d.refobjid<>c.oid AND t.relkind IN ('r','p') AND t.relnamespace='public'::regnamespace),
      'hasTenantCol',EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='tenant_id' AND a.attnum>0 AND NOT a.attisdropped))),'[]')
    FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('v','m')`);
}

// ---------- análisis estático ----------
const tenantCol=t=>GLOBAL_INTENCIONAL[t.name]?.tenantCol??(t.cols.find(c=>c.name==='tenant_id')?'tenant_id':null);
const writes=l=>l.filter(p=>['INSERT','UPDATE','DELETE','TRUNCATE'].includes(p));
function staticTable(t,info){
  const tc=tenantCol(t);info.tenantCol=tc;
  if(!tc){
    const hasOther=t.cols.find(c=>/^(org|organization|workspace|owner)_?id$/.test(c.name));
    info.noTenantReason=hasOther?`columna alterna ${hasOther.name}`:'sin columna de tenant';
    finding(hasOther?'alta':'alta',t.name,'SIN_COLUMNA_TENANT','Tabla sin tenant_id y no declarada global-intencional'+(hasOther?` (tiene ${hasOther.name}, no es tenant_id canónico)`:''));
  }else{
    const col=t.cols.find(c=>c.name===tc);
    if(!col.notnull)finding('media',t.name,'TENANT_NULLABLE',`${tc} admite NULL: filas huérfanas fuera de todo tenant`);
  }
  if(!t.rls)finding(tc?'crítica':'alta',t.name,'RLS_DESHABILITADO','Row Level Security apagado');
  else if(!t.force)info.noForce=true;
  const authOwner=['postgres','supabase_admin'].includes(t.owner);
  if(t.rls&&!t.force&&tc)finding('baja',t.name,'SIN_FORCE_RLS',`RLS habilitado sin FORCE (dueño ${t.owner}${authOwner?'':' no estándar'}): el dueño de la tabla ignora las políticas`);
  info.policyCount=t.policies.length;
  if(t.rls&&!t.policies.length)info.denyAll=true; // RLS sin políticas = denegar todo a roles no exentos (válido para tablas solo-backend)
  // Grants
  const anon=t.priv.anon,pub=t.priv.public,auth=t.priv.authenticated;
  if(anon.length||t.priv.anonAnyColSelect)finding(tc?'crítica':'alta',t.name,'GRANT_ANON',`anon tiene privilegios [${anon.join(',')||'columna SELECT'}]`);
  if(pub.length)finding(tc?'crítica':'alta',t.name,'GRANT_PUBLIC',`PUBLIC tiene privilegios [${pub.join(',')}]`);
  if(writes(auth).length)info.authWrites=writes(auth);
  // Políticas
  for(const p of t.policies){
    const rolesOpen=(p.roles??[]).some(r=>['public','anon'].includes(r));
    if(rolesOpen&&tc)finding('crítica',t.name,'POLITICA_ROL_ANON',`Política ${p.name} (${p.cmd}) aplica a ${p.roles.join(',')}`);
    const expr=`${p.using??''} ${p.check??''}`;
    const trivial=x=>x!=null&&/^\s*\(?\s*true\s*\)?\s*$/i.test(x);
    if(tc&&(trivial(p.using)||trivial(p.check)))finding('crítica',t.name,'POLITICA_TRIVIAL_TRUE',`Política ${p.name} (${p.cmd}) usa/valida literal TRUE: sin filtro de tenant`);
    else if(tc&&p.permissive&&!/tenant_id|vexa_member|\bid\b|auth\.uid|user_id|vexa_/.test(expr))finding('media',t.name,'POLITICA_SIN_REFERENCIA_TENANT',`Política ${p.name} (${p.cmd}) no menciona tenant/membresía: ${expr.trim().slice(0,120)}`);
  }
}
function staticFks(tables,byName){
  for(const t of tables){
    const tc=tenantCol(t);if(!tc||tc==='id')continue;
    for(const fk of t.fks){
      if(fk.parentSchema!=='public')continue;
      const parent=byName[fk.parent];if(!parent||!tenantCol(parent)||tenantCol(parent)==='id')continue;
      if(!(fk.cols.includes('tenant_id')&&fk.pcols.includes('tenant_id')))
        finding('media',t.name,'FK_SIN_TENANT',`FK ${fk.name} (${fk.cols}) -> ${fk.parent}(${fk.pcols}) no incluye tenant_id: permite apuntar a filas de OTRO tenant`);
    }
  }
}
function staticFunctions(fns,tables){
  const tenantTables=tables.filter(t=>tenantCol(t)&&t.kind!=='v').map(t=>t.name);
  const refsTenantData=src=>tenantTables.filter(n=>new RegExp(`\\b${n}\\b`).test(src));
  for(const f of fns){
    const hasSp=(f.config??[]).some(c=>/^search_path=/.test(c));
    const execPublic=f.public||f.anon;
    const refs=refsTenantData(f.src??'');
    f.refs=refs;
    if(f.secdef&&!hasSp)finding(execPublic?'alta':'media',f.sig,'SECDEF_SIN_SEARCH_PATH',`SECURITY DEFINER sin search_path fijo${execPublic?' y ejecutable por PUBLIC/anon':''}`);
    if(f.secdef&&execPublic&&refs.length)finding('crítica',f.sig,'SECDEF_ANON_LEE_TENANT',`SECURITY DEFINER ejecutable por ${f.anon?'anon':'PUBLIC'} que referencia datos de tenant: ${refs.slice(0,6).join(',')}`);
    else if(f.secdef&&execPublic)finding('media',f.sig,'SECDEF_EJECUTABLE_PUBLICO',`SECURITY DEFINER ejecutable por ${f.anon?'anon':'PUBLIC'} (sin referencia textual a tablas de tenant)`);
    else if(!f.secdef&&execPublic&&refs.length)f.note='SECURITY INVOKER ejecutable por anon: RLS aplica al invocador (sin hallazgo)';
  }
}
function staticViews(views,tables){
  for(const v of views){
    const exposes=v.deps.filter(d=>d.endsWith(':true')).map(d=>d.split(':')[0]);
    if(!v.invoker&&exposes.length)finding(v.hasTenantCol||v.authenticated.length||v.anon.length?'alta':'media',v.name,'VISTA_SIN_SECURITY_INVOKER',`Vista dueña ${v.owner} sin security_invoker sobre tablas con RLS: ${exposes.join(',')} (el dueño evade RLS)`);
    if(v.anon.length)finding('crítica',v.name,'VISTA_GRANT_ANON',`anon tiene [${v.anon.join(',')}] sobre la vista`);
    if(v.authenticated.some(p=>p!=='SELECT'))finding('media',v.name,'VISTA_ESCRITURA_AUTH',`authenticated con [${v.authenticated.join(',')}] sobre la vista`);
  }
}

// ---------- sembrador genérico ----------
const hints=Object.fromEntries(definitions.map(([n,v])=>[n,v]));
const hex=n=>randomBytes(n).toString('hex');
function literalsFromChecks(t,col){
  const out=[];
  for(const def of t.checks)if(def.includes(col.name))for(const m of def.matchAll(/'([^']{1,60})'::/g))out.push(m[1]);
  return [...new Set(out)];
}
function valueFor(t,col,s){
  const nm=col.name,ty=col.typtype==='d'?col.base:col.typname;
  if(col.enum?.length)return q(col.enum[s.pick%col.enum.length])+`::${ident(col.typname)}`;
  const arr=ty.startsWith('_');
  if(arr)return `'{}'::${col.type}`;
  switch(ty){
    case 'uuid':return 'gen_random_uuid()';
    case 'text':case 'varchar':case 'bpchar':case 'citext':case 'name':{
      const lits=literalsFromChecks(t,col);
      if(lits.length)return q(lits[s.pick%lits.length]);
      if(/sha256|hash|digest|checksum/.test(nm))return q(hex(32));
      if(/email/.test(nm))return q(`syn-${hex(4)}@example.test`);
      if(/url|uri/.test(nm))return q(`https://example.test/${hex(4)}`);
      if(/hex|fingerprint|token/.test(nm))return q(hex(32));
      return q('syn-'+hex(6));}
    case 'int2':case 'int4':case 'int8':case 'numeric':case 'float4':case 'float8':return String([1,0,2,10][s.pick%4]);
    case 'bool':return s.pick%2?'true':'false';
    case 'timestamptz':case 'timestamp':return s.pick%2?`now()-interval '1 hour'`:'now()';
    case 'date':return 'current_date';
    case 'time':case 'timetz':return "'12:00'";
    case 'interval':return "interval '1 hour'";
    case 'jsonb':case 'json':return s.pick%2?`'[]'::${ty}`:`'{}'::${ty}`;
    case 'bytea':return `decode('${hex(8)}','hex')`;
    case 'inet':return "'127.0.0.1'::inet";
    case 'tstzrange':return "tstzrange(now()-interval '1 day',now())";
    case 'vector':{const d=Number(/\((\d+)\)/.exec(col.type)?.[1]??3);return q('['+Array.from({length:d},(_,i)=>i===0?1:0).join(',')+']')+'::vector';}
    case 'tsvector':return "to_tsvector('syn')";
    default:return `NULL`;
  }
}
const state={tables:{},byName:{},rows:{},stack:new Set(),okStrat:{},fail:{},users:{}};
function ensureRow(name,tenant,depth=0){
  const key=`${tenant}|${name}`;
  if(state.rows[key])return state.rows[key];
  if(state.fail[key])return null;
  if(name==='organizations'){const r=sqlJson(`SELECT to_jsonb(o) FROM public.organizations o WHERE id=${q(tenant)}`);return state.rows[key]=r;}
  if(state.stack.has(key)){return null;}
  state.stack.add(key);
  try{
    const t=state.byName[name];
    if(!t||t.kind!=='r'&&t.kind!=='p'){state.fail[key]='no es tabla sembrable';return null;}
    const tc=tenantCol(t);
    if(!tc){state.fail[key]='sin columna de tenant';return null;}
    const existing=sqlJson(`SELECT to_jsonb(r) FROM public.${ident(name)} r WHERE ${ident(tc)}=${q(tenant)} LIMIT 1`);
    if(existing){return state.rows[key]=existing;}
    let lastErr=null;
    for(let pick=0;pick<4;pick++)for(const fillNullable of [false,true]){
      const built=buildInsert(t,tenant,{pick,fillNullable});
      if(built.missing){lastErr=`FK padre no sembrable: ${built.missing}`;continue;}
      const r=tryExec(`WITH i AS (${built.sql} RETURNING *) SELECT to_jsonb(i) FROM i`);
      if(r.ok){state.okStrat[name]={pick,fillNullable};return state.rows[key]=r.row;}
      lastErr=`${r.code} ${r.constraint??''} ${r.message??''}`.trim();
      if(r.code==='42501'||r.code==='42P01')break;
    }
    state.fail[key]=lastErr;return null;
  }finally{state.stack.delete(key);}
}
// Construye un INSERT con valores frescos para (tabla, tenant). Los padres se siembran por tenant (misma identidad).
function buildInsert(t,tenant,s){
  const tc=tenantCol(t),vals={};let missing=null;
  const fkCols=new Set(t.fks.flatMap(f=>f.cols));
  for(const fk of t.fks){
    const cols=fk.cols.map(n=>t.cols.find(c=>c.name===n));
    const mustFill=cols.some(c=>c.notnull)||s.fillNullable;
    if(!mustFill)continue;
    if(fk.parentSchema==='auth'&&fk.parent==='users'){for(const c of fk.cols)vals[c]=q(tenant===A?state.users.a:state.users.b);continue;}
    if(fk.parentSchema!=='public'){missing=`${fk.parentSchema}.${fk.parent}`;continue;}
    if(fk.parent===t.name&&!cols.every(c=>c.notnull))continue; // autorreferencia opcional
    const parent=ensureRow(fk.parent,tenant);
    if(!parent){if(cols.some(c=>c.notnull))missing=`${fk.parent} (${state.fail[`${tenant}|${fk.parent}`]??'ciclo'})`;continue;}
    fk.cols.forEach((c,i)=>{vals[c]=parent[fk.pcols[i]]==null?'NULL':q(typeof parent[fk.pcols[i]]==='object'?JSON.stringify(parent[fk.pcols[i]]):parent[fk.pcols[i]]);});
  }
  vals[tc]=q(tenant);
  const hint=hints[t.name]??{};
  for(const col of t.cols){
    if(col.name in vals||col.gen==='s'||col.ident==='a')continue;
    const known=Object.hasOwn(hint,col.name);
    if(known&&!fkCols.has(col.name)){const v=hint[col.name];vals[col.name]=v===null?'NULL':q(typeof v==='object'?JSON.stringify(v):v);continue;}
    if(fkCols.has(col.name))continue;
    if(col.hasdef&&!s.fillNullable)continue;
    if(!col.notnull&&!s.fillNullable)continue;
    if(col.hasdef)continue;
    const v=valueFor(t,col,s);if(v!=='NULL')vals[col.name]=v;
  }
  // Valores de hint con identidad única por intento (evitan colisiones de unique).
  for(const k of ['external_id','account_id','idempotency_key','source_ref','row_ref','deleted_source_key'])if(k in vals&&typeof hint[k]==='string')vals[k]=q('syn-'+hex(6));
  if('sha256' in vals&&typeof hint.sha256==='string')vals.sha256=q(hex(32));
  if(t.name==='memberships'&&!vals.user_id)vals.user_id=q(tenant===A?state.users.a:state.users.b);
  const names=Object.keys(vals);
  return {missing,sql:`INSERT INTO public.${ident(t.name)} (${names.map(ident)}) VALUES (${names.map(n=>vals[n])})`};
}

// ---------- pruebas cruzadas ----------
const okCode=r=>r&&r.code==='00000';
const BLOCKED_OK=new Set(['42501','P0001','23514']); // permiso/RLS, RAISE explícito de trigger/función
function crossTest(t,info){
  const name=t.name,tc=tenantCol(t),T=`public.${ident(name)}`,col=ident(tc);
  const isView=t.kind==='v'||t.kind==='m';
  info.dyn={};
  const rowsA=state.rows[`${A}|${name}`],rowsB=state.rows[`${B}|${name}`];
  if(!isView&&(!rowsA||!rowsB)){
    skip(name,'prueba cruzada completa',`no se pudo sembrar fila de ${!rowsA?'A':'B'}: ${state.fail[`${!rowsA?A:B}|${name}`]??'sin detalle'}`);
    info.dyn.seeded=false;return;
  }
  info.dyn.seeded=!isView;
  const readStep=(id,where)=>({id,sql:`SELECT count(*) INTO affected FROM ${T} WHERE ${where};`});
  const upCols=t.cols.filter(c=>c.authUpd&&c.name!==tc&&c.gen!=='s').map(c=>c.name);
  const steps=[
    readStep('read_other',`${col}<>${q(B)}`),
    readStep('read_own',`${col}=${q(B)}`),
    {id:'update_tenantcol',sql:`UPDATE ${T} SET ${col}=${col} WHERE ${col}=${q(A)}; GET DIAGNOSTICS affected=ROW_COUNT;`},
    {id:'delete',sql:`DELETE FROM ${T} WHERE ${col}=${q(A)}; GET DIAGNOSTICS affected=ROW_COUNT;`},
    {id:'steal',sql:`UPDATE ${T} SET ${col}=${q(A)} WHERE ${col}=${q(B)}; GET DIAGNOSTICS affected=ROW_COUNT;`},
  ];
  if(upCols.length)steps.push({id:'update_othercol',sql:`UPDATE ${T} SET ${ident(upCols[0])}=${ident(upCols[0])} WHERE ${col}=${q(A)}; GET DIAGNOSTICS affected=ROW_COUNT;`});
  let insA=null,insB=null;
  if(!isView&&state.okStrat[name]){
    const s=state.okStrat[name];
    insA=buildInsert(t,A,s);insB=buildInsert(t,B,s);
    if(!insA.missing)steps.push({id:'insert_A',sql:`${insA.sql}; GET DIAGNOSTICS affected=ROW_COUNT;`});
    if(!insB.missing)steps.push({id:'insert_B_control',sql:`${insB.sql}; GET DIAGNOSTICS affected=ROW_COUNT;`});
  }else if(!isView){
    skip(name,'INSERT cruzado','no hay estrategia de INSERT válida para fabricar una fila de A como authenticated');
  }
  if(isView){for(const id of ['update_tenantcol','delete','steal','update_othercol'])steps.splice(steps.findIndex(s=>s.id===id),1);}
  const res=multiProbe(state.userB,steps);
  const anonRes=multiProbe(null,[readStep('read_any',`true`),...(!isView&&insA&&!insA.missing?[{id:'insert_A',sql:`${insA.sql}; GET DIAGNOSTICS affected=ROW_COUNT;`}]:[])]);
  info.dyn.B=res;info.dyn.anon=anonRes;
  // veredictos
  const verdict={};
  const MISSING={code:'SIN_RESULTADO',message:'el paso no devolvió resultado'};
  const readOther=res.read_other||MISSING;
  if(okCode(readOther)&&readOther.n>0){verdict.read='FUGA';finding('crítica',name,'FUGA_LECTURA_CRUZADA',`authenticated(B) lee ${readOther.n} fila(s) de otros tenants`);}
  else if(okCode(readOther)||readOther.code==='42501')verdict.read=readOther.code==='42501'?'denegado':'0 filas';
  else{verdict.read='inconcluso';skip(name,'SELECT cruzado',`error ${readOther.code} ${readOther.message}`);}
  const readOwn=res.read_own||MISSING;
  verdict.readOwn=okCode(readOwn)?readOwn.n:readOwn.code;
  const anonRead=anonRes.read_any||MISSING;
  if(okCode(anonRead)&&anonRead.n>0){verdict.anonRead='FUGA';finding('crítica',name,'FUGA_LECTURA_ANON',`anon lee ${anonRead.n} fila(s)`);}
  else verdict.anonRead=okCode(anonRead)?'0 filas':anonRead.code==='42501'?'denegado':'inconcluso:'+anonRead.code;
  if(!/^(0 filas|denegado)$/.test(verdict.anonRead))skip(name,'SELECT anon',verdict.anonRead);
  for(const id of ['update_tenantcol','delete','steal','update_othercol']){
    const r=res[id];if(!r)continue;
    if(okCode(r)&&r.n>0){verdict[id]='VULNERABLE';finding('crítica',name,'ESCRITURA_CRUZADA_'+id.toUpperCase(),`authenticated(B) afectó ${r.n} fila(s) (${id}); la prueba se revierte`);}
    else if(okCode(r))verdict[id]='0 afectadas';
    else if(BLOCKED_OK.has(r.code))verdict[id]='denegado:'+r.code;
    else{verdict[id]='inconcluso:'+r.code;skip(name,id,`${r.code} ${r.constraint??''} ${r.message??''}`);}
  }
  if(res.insert_A){
    let r=res.insert_A;
    if(r.code==='23505'||r.code==='23503'){ // pudo pasar RLS y chocar con unique/FK: reintento sin la fila sembrada de A (prelude como superusuario, todo revertido)
      const re=multiProbe(state.userB,[{id:'insert_A',sql:`${insA.sql}; GET DIAGNOSTICS affected=ROW_COUNT;`}],`DELETE FROM ${T} WHERE ${col}=${q(A)};`);
      r=re.insert_A;verdict.insertRetry=true;
    }
    if(okCode(r)){verdict.insert_A='VULNERABLE';finding('crítica',name,'INSERT_CRUZADO',`authenticated(B) insertó fila con tenant A (${r.n}); la prueba se revierte`);}
    else if(BLOCKED_OK.has(r.code))verdict.insert_A='denegado:'+r.code;
    else{verdict.insert_A='inconcluso:'+r.code;skip(name,'INSERT cruzado',`${r.code} ${r.constraint??''} ${r.message??''}`);}
  }
  if(anonRes.insert_A){const r=anonRes.insert_A;
    if(okCode(r)){verdict.anonInsert='VULNERABLE';finding('crítica',name,'INSERT_ANON',`anon insertó fila (${r.n}); la prueba se revierte`);}
    else if(BLOCKED_OK.has(r.code))verdict.anonInsert='denegado:'+r.code;else{verdict.anonInsert='inconcluso:'+r.code;skip(name,'INSERT anon',`${r.code} ${r.message}`);}}
  verdict.insertControl=res.insert_B_control?(okCode(res.insert_B_control)?'B puede insertar propio':'B no inserta propio:'+res.insert_B_control.code):'n/a';
  info.dyn.verdict=verdict;
}

// ---------- funciones: prueba dinámica acotada ----------
function probeFunctions(fns){
  for(const f of fns){
    if(!(f.secdef&&(f.authenticated||f.anon||f.public)))continue;
    const names=f.argnames??[];const types=f.argtypes??[];
    const tenantish=n=>/tenant|org/.test(n??'');
    const args=[];let ok=true;
    for(let i=0;i<types.length;i++){
      if(types[i]==='uuid'&&tenantish(names[i]))args.push(`${q(A)}::uuid`);else{ok=false;break;}
    }
    if(!ok){skip(f.sig,'ejecución cruzada de función SECURITY DEFINER',`argumentos no sembrables automáticamente (${types.join(',')})`);continue;}
    if(f.kind!=='f'){skip(f.sig,'ejecución cruzada','procedimiento: no se invoca (efectos)');continue;}
    const call=f.returnsSet?`SELECT count(*) INTO affected FROM ${f.schema}.${ident(f.name)}(${args})`:`PERFORM ${f.schema}.${ident(f.name)}(${args})`;
    const r=multiProbe(state.userB,[{id:'call',sql:`${call}; ${f.returnsSet?'':'affected:=0;'}`}]).call;
    f.dyn=r;
    if(okCode(r)&&f.returnsSet&&r.n>0)finding('crítica',f.sig,'FUNCION_DEVUELVE_DATOS_OTRO_TENANT',`authenticated(B) obtuvo ${r.n} fila(s) pasando el tenant A`);
    else if(okCode(r)&&!f.returnsSet)skip(f.sig,'ejecución cruzada de función',`ejecutó sin error con tenant A como B; el resultado escalar no se inspecciona automáticamente (revisión manual del cuerpo)`);
  }
}

// ---------- clasificación ----------
function classify(infoByTable){
  for(const [name,info] of Object.entries(infoByTable)){
    const mine=findings.filter(f=>f.table===name);
    if(GLOBAL_INTENCIONAL[name]&&info.dyn?.verdict&&!mine.length){info.class='global-intencional';info.just=GLOBAL_INTENCIONAL[name].nota;continue;}
    if(mine.length){info.class='hallazgo';continue;}
    const v=info.dyn?.verdict;
    const complete=v&&v.read&&!/inconcluso/.test(JSON.stringify(v))&&!notTested.some(n=>n.table===name);
    info.class=complete?'aislada-probada':'aislada-solo-estática';
  }
}

// ---------- main ----------
async function main(){
  const migrations=candidateInputs(candidate);
  const extra=arg('--extra-migrations');
  if(extra)for(const f of fs.readdirSync(extra).filter(x=>/\.sql$/.test(x)).sort())migrations.push(fs.readFileSync(path.join(extra,f),'utf8'));
  h=await launch({services:true});
  for(const [i,m] of migrations.entries()){try{h.sql(m);}catch(e){throw new Error(`MIGRACION_${i}_FALLO: ${e.message}`);}}
  h.sql("NOTIFY pgrst, 'reload schema';");
  const tablesAll=catalogTables();
  const tables=tablesAll.filter(t=>['r','p'].includes(t.kind)&&!t.partition);
  const viewsCat=tablesAll.filter(t=>['v','m'].includes(t.kind));
  const fns=catalogFunctions(),views=catalogViews();
  for(const t of tablesAll)state.byName[t.name]=t;
  const info=Object.fromEntries(tablesAll.map(t=>[t.name,{kind:t.kind}]));
  for(const t of tables)staticTable(t,info[t.name]);
  staticFks(tables,state.byName);staticFunctions(fns,tablesAll);staticViews(views,tablesAll);
  for(const v of viewsCat){const i=info[v.name];i.tenantCol=tenantCol(v);i.isView=true;}

  // siembra
  h.sql("CREATE SCHEMA zz_audit; CREATE FUNCTION zz_audit.try_exec(stmt text) RETURNS jsonb LANGUAGE plpgsql AS $f$ DECLARE r jsonb; c text; m text; BEGIN BEGIN EXECUTE stmt INTO r; RETURN jsonb_build_object('ok',true,'row',r); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS c=CONSTRAINT_NAME,m=MESSAGE_TEXT; RETURN jsonb_build_object('ok',false,'code',SQLSTATE,'constraint',c,'message',left(m,300)); END; END $f$;");
  state.userA=await h.user();state.userB=await h.user();state.users={a:state.userA.id,b:state.userB.id};
  h.sql(`INSERT INTO public.organizations(id,name) VALUES (${q(A)},'SYN A'),(${q(B)},'SYN B');`);
  for(const [tenant,u] of [[A,state.userA],[B,state.userB]])h.sql(`INSERT INTO public.memberships(tenant_id,user_id,role,status) VALUES (${q(tenant)},${q(u.id)},'owner','active');`);
  const tenantTables=tables.filter(t=>tenantCol(t)&&t.rls!==undefined);
  for(const t of tenantTables)for(const tenant of [A,B])ensureRow(t.name,tenant);
  // pruebas cruzadas
  for(const t of tenantTables){try{crossTest(t,info[t.name]);}catch(e){skip(t.name,'prueba cruzada','excepción del auditor: '+e.message);if(process.env.AUDIT_DEBUG)console.error(t.name,e.stack);}}
  for(const v of viewsCat){
    if(tenantCol(v)){crossTest(v,info[v.name]);}
    else skip(v.name,'prueba cruzada de vista','la vista no expone tenant_id; revisar security_invoker (estático)');
  }
  for(const t of tables)if(!tenantCol(t)&&!GLOBAL_INTENCIONAL[t.name])skip(t.name,'prueba cruzada','sin columna de tenant');
  probeFunctions(fns);
  classify(info);

  // reporte
  const report={generatedAt:new Date().toISOString(),candidate,counts:{tables:tables.length,views:viewsCat.length,functions:fns.length},
    classes:{},findings,notTested,tables:{},functions:fns.map(({src,...f})=>f),views};
  for(const [n,i] of Object.entries(info)){report.classes[i.class??'n/a']=(report.classes[i.class??'n/a']??0)+1;report.tables[n]=i;}
  for(let i=findings.length-1;i>=0;i--){const e=EXCEPCIONES_REVISADAS.find(x=>x.table===findings[i].table&&x.code===findings[i].code);if(e){exceptions.push({...findings[i],nota:e.nota});findings.splice(i,1);}}
  report.exceptions=exceptions;
  report.findingsBySeverity=Object.fromEntries(SEV.map(s=>[s,findings.filter(f=>f.severity===s).length]));
  return report;
}

let report;
try{
  report=await main();
}catch(e){
  console.error('INFRA/ERROR:',e.message);if(process.env.AUDIT_DEBUG)console.error(e.stack);closeAll();process.exit(2);
}
closeAll();
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(report,null,2));
console.log(`Tablas public: ${report.counts.tables} | vistas: ${report.counts.views} | funciones auditadas: ${report.counts.functions}`);
console.log('Clasificación:',JSON.stringify(report.classes));
console.log('Hallazgos por severidad:',JSON.stringify(report.findingsBySeverity));
for(const s of SEV)for(const f of findings.filter(x=>x.severity===s))console.log(`[${s}] ${f.table} ${f.code}: ${f.detail}`);
for(const e of report.exceptions)console.log(`[excepción revisada] ${e.table} ${e.code}`);
console.log(`No probado: ${report.notTested.length} (ver --json)`);
process.exit(findings.length?1:0);
