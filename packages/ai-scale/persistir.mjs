#!/usr/bin/env node
// OJO: esto ESCRIBE texto redactado de clientes en la base (message_revisions.redacted_text y extraction_runs.provenance.result con `quote`),
// igual que el flujo oficial. Estados: ok->succeeded, abstención->abstained (CHECK real de extraction_runs). No duplica conversaciones que
// ya tengan una extracción vigente. Usa el boilerplate congelado (boilerplate.json) de cohorte.mjs.
// Persistencia de resultados de la cohorte en las tablas de Vexa (extraction_runs, message_revisions redactadas,
// redaction_maps, issues, evidence_spans). Script `!` de Javier. NO fue ejecutado contra ninguna base: ver INFORME.
//   node persistir.mjs --results resultados.jsonl --input entrada.jsonl --taxonomy taxonomia.json            # DRY-RUN (default): solo conteos y SQL a disco
//   node persistir.mjs ... --run --rollback-test --max 5     # ejecuta en la base dentro de BEGIN..ROLLBACK (verifica constraints/triggers sin dejar nada)
//   node persistir.mjs ... --run --commit --max 5            # CANARIO: escribe de verdad 5 conversaciones
//   node persistir.mjs ... --run --commit                    # todo (por lotes de 25 conversaciones, idempotente)
// Idempotente: ids deterministas + ON CONFLICT DO NOTHING + NOT EXISTS por (conversación, input_hash).
// Guardas: proyecto proyecto-ejemplo y tenant 00000000-0000-4000-8000-000000000000 fijos; solo INSERT; recibo local con conteos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256,validateExtraction} from '../intelligence/index.mjs';
import {redactText} from '../intelligence/redact.mjs';
import {prepareConversation,learnBoilerplate,REDACTION_POLICY} from './preprocess.mjs';
import {configHash,taskKeyFor,DEFAULT_MODEL,loadOrLearnBoilerplate} from './cohorte.mjs';
import {promptHash,schemaHash} from './compact.mjs';
import {TENANT,PROJECT_REF} from './sql.mjs';
import {intOpt} from './cli-util.mjs';

const lit=v=>v===null||v===undefined?'null':"'"+String(v).replace(/'/g,"''")+"'";
const uuidFrom=seed=>{const h=sha256(seed);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
// misma fórmula que packages/intelligence/extraction-repository.mjs
export const derivedId=(source,policy)=>{const h=sha256('vexa-redaction-v1:'+source+':'+policy);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const readJsonl=f=>fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));

// Reconstruye, para una conversación con resultado ok/abstained, todo lo necesario y verifica coherencia con el resultado guardado.
export function buildPersistence({conv,rec,taxonomy,boilerplate,tenant=TENANT,model=DEFAULT_MODEL,provider='azure'}){
  const prep=prepareConversation(conv,{boilerplate});
  if(prep.status!=='ok')throw Error('conversación ya no es procesable');
  const cfg=configHash({model:rec.model,provider:rec.provider,taxonomy});
  if(taskKeyFor(cfg,conv.conversation_id,prep.input_hash)!==rec.task_key)throw Error('task_key no coincide: el texto de entrada o la configuración cambiaron desde la extracción');
  const policyHash=redactText('',REDACTION_POLICY).policyHash;
  const origRev=new Map(conv.messages.map(m=>[m.id,m.revision_id]));
  const redId=new Map(),revs=[],manifest=[];
  for(const r of prep.revisions){
    const orig=origRev.get(r.message_id);if(!orig)throw Error('falta revision_id del mensaje (re-exporte con exportar.mjs)');
    const rid=derivedId(orig,policyHash);redId.set(r.message_id,rid);
    revs.push({tenant_id:tenant,message_revision_id:rid,role:r.role,text:r.text,message_id:r.message_id,original:orig,hash:sha256(r.text)});
    manifest.push({message_revision_id:rid,original_revision_id:orig,hash:sha256(r.text),role:r.role});
  }
  const text=new Map(revs.map(r=>[r.message_revision_id,r.text]));
  const spanOf=e=>{const rid=redId.get(e.message_id);const t=Array.from(text.get(rid)??'');if(!rid||e.end>t.length)throw Error('evidencia fuera de rango');const quote=t.slice(e.start,e.end).join('');
    if(sha256(quote)!==e.quote_hash)throw Error('quote_hash no coincide');return{message_revision_id:rid,start:e.start,end:e.end,quote,quote_hash:e.quote_hash,role:e.role??revs.find(r=>r.message_revision_id===rid).role};};
  const data={issues:rec.issues.map(i=>({category:i.category,severity:i.severity,evidence:i.evidence.map(spanOf)})),sentiment:rec.sentiment,intent:rec.intent,urgency:rec.urgency,
    entities:rec.entities.map(e=>({type:e.type,value:e.value,evidence:e.evidence.map(spanOf)})),abstention:rec.status==='abstained'?{reason:rec.reason}:null};
  const checkRevs=revs.map(r=>({tenant_id:tenant,message_revision_id:r.message_revision_id,role:r.role,text:r.text}));
  if(!validateExtraction(data,checkRevs,{taxonomy,tenantId:tenant}).ok)throw Error('el resultado no pasa validateExtraction de producción');
  const inputHash=sha256(JSON.stringify({revisions:checkRevs,policyHash,taxonomy}));
  const runId=uuidFrom('ia-escala-run:'+rec.task_key);
  return{taxonomy,runId,policyHash,inputHash,revs,manifest,data,promptHash:promptHash(),schemaHash:schemaHash(taxonomy),status:rec.status==='abstained'?'abstained':'succeeded',usage:{prompt_tokens:rec.usage?.prompt??0,completion_tokens:rec.usage?.completion??0},taskKey:rec.task_key,conversationId:conv.conversation_id,model:rec.model,provider:rec.provider};
}
export function persistenceSql(items,{tenant=TENANT,commit=false}={}){
  const T=lit(tenant),out=[`begin;`,`do $g$ begin if not exists (select 1 from public.organizations where id=${T}::uuid) then raise exception 'tenant inesperado'; end if; end $g$;`];
  for(const p of items){
    const C=lit(p.conversationId);
    const NOOFF=`not exists (select 1 from public.extraction_runs o where o.tenant_id=${T}::uuid and o.conversation_id=${C}::uuid and o.status in ('succeeded','abstained') and o.id<>${lit(p.runId)}::uuid)`;
    for(const r of p.revs){
      out.push(`insert into public.message_revisions(id,tenant_id,message_id,revision,text_ref,redacted_text,hash,redaction_version,provenance)
 select ${lit(r.message_revision_id)}::uuid,${T}::uuid,m.id,${lit('redacted:'+r.original+':'+p.policyHash)},${lit('redacted:'+r.message_revision_id)},${lit(r.text)},${lit(r.hash)},${lit(REDACTION_POLICY.version)},${lit(JSON.stringify({original_revision_id:r.original,policy_hash:p.policyHash,offsets:'unicode_code_points'}))}::jsonb
 from public.messages m where m.tenant_id=${T}::uuid and m.id=${lit(r.message_id)}::uuid and m.conversation_id=${C}::uuid and ${NOOFF} on conflict (id) do nothing;`);
      out.push(`insert into public.redaction_maps(tenant_id,original_revision_id,redacted_revision_id,policy_hash,private_map)
 select ${T}::uuid,${lit(r.original)}::uuid,${lit(r.message_revision_id)}::uuid,${lit(p.policyHash)},'[]'::jsonb where ${NOOFF} and exists (select 1 from public.message_revisions z where z.tenant_id=${T}::uuid and z.id=${lit(r.message_revision_id)}::uuid) on conflict (tenant_id,original_revision_id,policy_hash) do nothing;`);
    }
    const prov={policy_hash:p.policyHash,taxonomy:p.taxonomy,input_manifest:p.manifest,offsets:'unicode_code_points',reason:p.data.abstention?.reason??null,quarantined:false,billing_state:'settled',result:p.data,source:'ia-escala-cohorte-v1',task_key:p.taskKey,provider:p.provider};
    out.push(`insert into public.extraction_runs(id,tenant_id,model_id,prompt_hash,schema_hash,input_hash,status,conversation_id,job_id,usage,provenance)
 select ${lit(p.runId)}::uuid,${T}::uuid,${lit(p.model)},${lit(p.promptHash)},${lit(p.schemaHash)},${lit(p.inputHash)},${lit(p.status)},c.id,null,${lit(JSON.stringify(p.usage))}::jsonb,${lit(JSON.stringify(prov))}::jsonb
 from public.conversations c where c.tenant_id=${T}::uuid and c.id=${C}::uuid
 and not exists (select 1 from public.extraction_runs x where x.tenant_id=${T}::uuid and x.conversation_id=c.id and x.input_hash=${lit(p.inputHash)})
 and not exists (select 1 from public.extraction_runs o where o.tenant_id=${T}::uuid and o.conversation_id=c.id and o.status in ('succeeded','abstained') and o.id<>${lit(p.runId)}::uuid) on conflict (id) do nothing;`);
    p.data.issues.forEach((issue,i)=>{const iid=uuidFrom(`ia-escala-issue:${p.runId}:${i}`);
      out.push(`insert into public.issues(id,tenant_id,category,severity,sentiment,intent,urgency,extraction_run_id)
 select ${lit(iid)}::uuid,${T}::uuid,${lit(issue.category)},${lit(issue.severity)},${lit(p.data.sentiment)},${lit(p.data.intent)},${lit(p.data.urgency)},${lit(p.runId)}::uuid
 where exists (select 1 from public.extraction_runs x where x.tenant_id=${T}::uuid and x.id=${lit(p.runId)}::uuid) on conflict (id) do nothing;`);
      issue.evidence.forEach((e,k)=>out.push(`insert into public.evidence_spans(id,tenant_id,"start","end",quote_hash,message_revision_id,issue_id,provenance)
 select ${lit(uuidFrom(`ia-escala-span:${iid}:${k}`))}::uuid,${T}::uuid,${e.start},${e.end},${lit(e.quote_hash)},${lit(e.message_revision_id)}::uuid,${lit(iid)}::uuid,${lit(JSON.stringify({role:e.role,offsets:'unicode_code_points'}))}::jsonb
 where exists (select 1 from public.issues y where y.tenant_id=${T}::uuid and y.id=${lit(iid)}::uuid) on conflict (id) do nothing;`));});
  }
  out.push(commit?'commit;':'rollback;');
  return out.join('\n');
}
// Solo registros ok/abstained (nunca failed/skipped), del más reciente al más antiguo, por conversación presente en la entrada.
export function selectCandidates(records,convs){
  const by=new Map();
  for(const r of records){if(!['ok','abstained'].includes(r.status)||!convs.has(r.conversation_id))continue;(by.get(r.conversation_id)??by.set(r.conversation_id,[]).get(r.conversation_id)).push(r);}
  return [...by.entries()].sort((x,y)=>x[0]<y[0]?-1:1).map(([c,rs])=>[c,rs.reverse()]);
}
export const ALLOWED=/^(begin|commit|rollback|do \$g\$|insert into public\.(message_revisions|redaction_maps|extraction_runs|issues|evidence_spans)\b)/;
export function onlyAllowedStatements(sql){ // verificación estructural: toda sentencia empieza con lo permitido
  return sql.split(/;\n(?=begin|commit|rollback|do \$g\$|insert into)/).every(s=>ALLOWED.test(s.trim()));
}

async function cli(){
  const a=process.argv.slice(2);const flag=n=>a.includes('--'+n);const opt=(n,d)=>{const i=a.indexOf('--'+n);return i>=0?a[i+1]:d;};
  const base=path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019/cohorte');
  const resF=opt('results',path.join(base,'resultados.jsonl')),inF=opt('input',path.join(base,'entrada.jsonl')+','+path.join(base,'entrada-csv.jsonl'));
  const taxonomy=JSON.parse(fs.readFileSync(opt('taxonomy'),'utf8'));
  const ref=opt('project-ref',PROJECT_REF),tenant=opt('tenant',TENANT);
  if(ref!==PROJECT_REF||tenant!==TENANT)throw Error('proyecto/tenant no autorizados');
  const commit=flag('commit'),run=flag('run'),rollbackTest=flag('rollback-test');
  if(run&&commit===rollbackTest)throw Error('con --run indique exactamente uno: --rollback-test o --commit');
  const convs=new Map(inF.split(',').filter(f=>fs.existsSync(f)).flatMap(readJsonl).map(c=>[c.conversation_id,c]));
  let boilerplate;try{boilerplate=loadOrLearnBoilerplate(path.dirname(resF),[],{cfg:configHash({model:DEFAULT_MODEL,provider:'azure',taxonomy}),window:null,allowLearn:false});}catch(e){throw Error('ABORTADO: '+e.message);} // el MISMO archivo congelado que usó cohorte.mjs; nunca se reaprende aquí
  const items=[],bad=[];
  for(const [cid,recs] of selectCandidates(readJsonl(resF),convs)){
    if(items.length>=intOpt(a,'max',Infinity))break;
    let built=null,lastErr=null;
    for(const r of recs){try{built=buildPersistence({conv:convs.get(cid),rec:r,taxonomy,boilerplate});break;}catch(e){lastErr=e;}}
    if(built)items.push(built);else bad.push(lastErr?.message??'sin candidato');
  }
  const counts={conversaciones:items.length,descartadas_por_incoherencia:bad.length,motivos:[...new Set(bad)],runs:items.length,issues:items.reduce((s,p)=>s+p.data.issues.length,0),spans:items.reduce((s,p)=>s+p.data.issues.reduce((q,i)=>q+i.evidence.length,0),0),revisiones_redactadas:items.reduce((s,p)=>s+p.revs.length,0)};
  const outDir=opt('out',path.join(base,'sql-persistencia'));fs.mkdirSync(outDir,{recursive:true,mode:0o700});
  const batchN=intOpt(a,'batch-size',25);const files=[];
  for(let i=0;i<items.length;i+=batchN){const sql=persistenceSql(items.slice(i,i+batchN),{tenant,commit:commit&&run});if(!onlyAllowedStatements(sql))throw Error('SQL con sentencias no permitidas');const f=path.join(outDir,`lote-${String(i/batchN+1).padStart(4,'0')}.sql`);fs.writeFileSync(f,sql,{mode:0o600});files.push(f);}
  if(!run){console.log('DRY-RUN. Nada se ejecutó.',JSON.stringify({...counts,archivos_sql:files.length,directorio:outDir}));return;}
  let done=0;for(const f of files){const r=spawnSync('supabase',['db','query','--linked','--project-ref',ref,'-f',f],{encoding:'utf8',maxBuffer:64*1024*1024});
    if(r.status!==0){console.error(`lote ${path.basename(f)} falló (código ${r.status}); detenido. No se imprime stderr (puede contener contenido).`);process.exit(1);}
    done++;process.stdout.write(`lote ${done}/${files.length} ${commit?'confirmado':'ejecutado y revertido (rollback)'}\n`);}
  const receipt={...counts,modo:commit?'commit':'rollback-test',lotes:done,ts:new Date().toISOString()};
  fs.writeFileSync(path.join(outDir,'recibo-persistencia.json'),JSON.stringify(receipt,null,1),{mode:0o600});console.log(JSON.stringify(receipt));
}
if(import.meta.url===`file://${process.argv[1]}`)cli().catch(e=>{console.error('ERROR',String(e.message).slice(0,200));process.exit(1);});
