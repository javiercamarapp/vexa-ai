#!/usr/bin/env node
// PASO 2. Agrupa en PROBLEMAS los issues ya persistidos (persistir.mjs) y deja el catálogo que consumen las vistas (Problemas, Resumen, Explorador, Brief).
// Inserta, SOLO con INSERT idempotentes y por lotes: public.embeddings, public.problems, public.problem_embedding_members y public.problem_versions
// (snapshot vector-problem-v1). No usa la cola de jobs ni llama a ninguna API (los vectores salen de cohorte/embeddings.jsonl y embeddings-problemas.jsonl; ver embeber.mjs).
//   node agrupar.mjs --taxonomy t.json --calibrar                                   # distribución de distancias y nº de problemas por umbral (local, sin base, sin red)
//   node agrupar.mjs --taxonomy t.json --threshold 0.30                             # DRY-RUN (default): conteos + SQL a disco
//   node agrupar.mjs --taxonomy t.json --threshold 0.30 --max 5 --run --rollback-test   # BEGIN..ROLLBACK de miembros+versiones de 5 conversaciones (verifica constraints/triggers y no deja nada)
//   node agrupar.mjs --taxonomy t.json --threshold 0.30 --max 5 --run --commit      # CANARIO real de 5 conversaciones
//   node agrupar.mjs --taxonomy t.json --threshold 0.30 --run --commit              # todo (lotes de 25 conversaciones, luego versiones)
// Precondición: persistir.mjs ya dejó extraction_runs 'succeeded' + message_revisions de esas conversaciones (un DO-guard aborta el lote si falta alguna).
// Guardas: proyecto proyecto-ejemplo y tenant ab12cd34-... fijos; lista cerrada de sentencias (solo INSERT/begin/commit/rollback/DO-guard/set_config); recibo local solo con conteos.
// El umbral es de CONFIGURACIÓN (en el producto vive en VEXA_PROBLEMS_CONFIG_JSON); aquí es obligatorio y se imprime en el recibo. Con el MISMO umbral y los mismos vectores el resultado es determinista.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {scrub} from '../openrouter.mjs';
import {intOpt} from '../cli-util.mjs';
import {cargarCohorte,construirFilas,leerVectores,adjuntarVectores,agrupar,resumenAgrupacion,calibrar,sentenciasMiembros,sentenciasVersiones,onlyAllowedStatements,verificacionSql,
  TENANT,PROJECT_REF,MODES,defaultVersion,EMBED_MODEL} from './nucleo.mjs';

const ROOT=process.env.IA_ESCALA_OUT||path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019');

// Plan de SQL a partir de filas con vector. Devuelve {lotes:[stmts[]], versiones:[stmts[]], problemas:[ids]}; cada arreglo empieza con 'begin;' (sin commit/rollback).
export function planSql(rows,{threshold,tenant=TENANT,version,model=EMBED_MODEL,batchSize=25,versionChunk=100,vectorType='extensions.vector',onProgress=null}){
  const g=agrupar(rows,{threshold,tenant,onProgress});
  const filas=rows.map((r,i)=>({...r,problemId:g.asig[i].problemId,founder:g.asig[i].founder}));
  const porConv=[];for(const f of filas){const last=porConv.at(-1);if(last&&last[0].conversationId===f.conversationId)last.push(f);else porConv.push([f]);}
  const lotes=[];
  for(let i=0;i<porConv.length;i+=batchSize)lotes.push(sentenciasMiembros(porConv.slice(i,i+batchSize).flat(),{tenant,model,version,vectorType,threshold}));
  const pids=[...g.problemas.keys()].sort();
  // problemas existentes que ganan miembros también necesitan snapshot nuevo: todos los problemas tocados (fundados o a los que se unió algún miembro)
  const tocados=[...new Set(filas.map(f=>f.problemId))].sort();
  const versiones=[];for(let i=0;i<tocados.length;i+=versionChunk)versiones.push(sentenciasVersiones(tocados.slice(i,i+versionChunk),{tenant,model,version}));
  return{lotes,versiones,problemas:pids,tocados,resumen:resumenAgrupacion(rows,g),grupos:g};
}
export const cerrar=(stmts,commit)=>[...stmts,commit?'commit;':'rollback;'];
export const combinarParaRollback=plan=>['begin;',...plan.lotes.flatMap(s=>s.slice(1)),...plan.versiones.flatMap(s=>s.slice(1)),'rollback;'];

async function cli(){
  const a=process.argv.slice(2);const flag=n=>a.includes('--'+n);const opt=(n,d)=>{const i=a.indexOf('--'+n);return i>=0?a[i+1]:d;};
  const base=path.join(ROOT,'cohorte');const out=opt('out',path.join(ROOT,'problemas'));
  const mode=opt('texto','mensaje');if(!MODES.includes(mode))throw Error('--texto debe ser mensaje o quote');
  const resF=opt('results',path.join(base,'resultados.jsonl')),inF=opt('input',path.join(base,'entrada.jsonl')+','+path.join(base,'entrada-csv.jsonl')).split(',');
  const taxonomy=JSON.parse(fs.readFileSync(opt('taxonomy'),'utf8'));
  const ref=opt('project-ref',PROJECT_REF),tenant=opt('tenant',TENANT);
  if(ref!==PROJECT_REF||tenant!==TENANT)throw Error('proyecto/tenant no autorizados');
  const version=opt('embedding-version',defaultVersion(mode));
  const commit=flag('commit'),run=flag('run'),rollbackTest=flag('rollback-test');
  if(run&&commit===rollbackTest)throw Error('con --run indique exactamente uno: --rollback-test o --commit');
  const max=intOpt(a,'max',Infinity);
  if(run&&rollbackTest&&!(max<=50))throw Error('--rollback-test exige --max N (N<=50): se prueba en UNA transacción');
  const excluir=new Set(opt('excluir',null)?fs.readFileSync(opt('excluir'),'utf8').split('\n').map(s=>s.trim()).filter(Boolean):[]);
  const {items,bad}=cargarCohorte({resultsFile:resF,inputFiles:inF,taxonomy,max,excluir,tenant});
  const {rows:todas,descartadasSeveridad,textoInvalido}=construirFilas(items,{mode,tenant,version});
  const vecs=await leerVectores([path.join(base,'embeddings.jsonl'),path.join(out,'embeddings-problemas.jsonl')],{mode,needed:new Set(todas.map(r=>r.taskKey+'|'+r.prepId))});
  const {sinVector,obsoletos}=adjuntarVectores(todas,vecs,{mode});
  const rows=todas.filter(r=>r.vec);
  const base0={conversaciones:items.length,descartadas_por_incoherencia:bad.length,filas_candidatas:todas.length,con_vector:rows.length,sin_vector:sinVector,vectores_obsoletos:obsoletos,descartadas_severidad_desconocida:descartadasSeveridad,texto_invalido:textoInvalido,modo:mode,embedding_version:version};
  if(flag('calibrar')){console.log(JSON.stringify({...base0,calibracion:calibrar(rows,{tenant})}));return;}
  if(opt('emit-verificacion',null)){fs.mkdirSync(path.dirname(opt('emit-verificacion')),{recursive:true});fs.writeFileSync(opt('emit-verificacion'),verificacionSql({tenant,version}));console.log('SQL de verificación (solo lectura) escrito en',opt('emit-verificacion'));return;}
  const thrS=opt('threshold',null);
  if(thrS===null){console.log('Falta --threshold (distancia coseno 0..1). Use --calibrar para elegirlo.',JSON.stringify(base0));return;}
  if(!/^0(\.\d+)?$/.test(thrS))throw Error('--threshold inválido (0 <= umbral < 1)');
  const threshold=Number(thrS);
  if(run&&(sinVector>0||obsoletos>0))throw Error(`faltan vectores (${sinVector} sin vector, ${obsoletos} obsoletos): corra embeber.mjs antes de ejecutar`);
  const t0=Date.now();
  const plan=planSql(rows,{threshold,tenant,version,batchSize:intOpt(a,'batch-size',25),onProgress:(i,n)=>process.stderr.write(`agrupando ${i}/${n}\r`)});
  const todos=[...plan.lotes,...plan.versiones];
  for(const s of todos)if(!onlyAllowedStatements(s))throw Error('SQL con sentencias no permitidas');
  const dir=path.join(out,'sql-problemas');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const files=[];const w=(n,stmts)=>{const f=path.join(dir,n);fs.writeFileSync(f,stmts.join('\n')+'\n',{mode:0o600});files.push(f);return f;};
  const counts={...base0,umbral:threshold,problemas:plan.resumen.problemas,outliers:plan.resumen.outliers,tamano_problema:plan.resumen.tamano,pct_en_problemas_de_mas_de_1:plan.resumen.pctEnProblemasDeMasDe1,lotes_miembros:plan.lotes.length,lotes_versiones:plan.versiones.length,segundos_agrupacion:Math.round((Date.now()-t0)/1000)};
  if(!run){plan.lotes.forEach((s,i)=>w(`lote-${String(i+1).padStart(4,'0')}.sql`,cerrar(s,false)));plan.versiones.forEach((s,i)=>w(`versiones-${String(i+1).padStart(4,'0')}.sql`,cerrar(s,false)));
    console.log('DRY-RUN. Nada se ejecutó.',JSON.stringify({...counts,archivos_sql:files.length,directorio:dir}));return;}
  const exec=f=>spawnSync('supabase',['db','query','--linked','--project-ref',ref,'-f',f],{encoding:'utf8',maxBuffer:64*1024*1024});
  let done=0;
  if(rollbackTest){const f=w('rollback-test.sql',combinarParaRollback(plan));const r=exec(f);
    if(r.status!==0){console.error('rollback-test falló (código '+r.status+'). No se imprime stderr (puede contener contenido).');process.exit(1);}
    done=1;console.log('rollback-test OK: miembros+versiones ejecutados y revertidos');}
  else{
    for(let i=0;i<plan.lotes.length;i++){const f=w(`lote-${String(i+1).padStart(4,'0')}.sql`,cerrar(plan.lotes[i],true));const r=exec(f);
      if(r.status!==0){console.error(`lote ${path.basename(f)} falló (código ${r.status}); detenido. Reanudar es seguro (idempotente).`);process.exit(1);}
      done++;process.stdout.write(`miembros ${done}/${plan.lotes.length} confirmado\n`);}
    for(let i=0;i<plan.versiones.length;i++){const f=w(`versiones-${String(i+1).padStart(4,'0')}.sql`,cerrar(plan.versiones[i],true));const r=exec(f);
      if(r.status!==0){console.error(`versiones ${path.basename(f)} falló (código ${r.status}); detenido. Reanudar es seguro (idempotente).`);process.exit(1);}
      process.stdout.write(`versiones ${i+1}/${plan.versiones.length} confirmado\n`);}
  }
  const receipt={...counts,modo:commit?'commit':'rollback-test',archivos_ejecutados:done,ts:new Date().toISOString()};
  fs.writeFileSync(path.join(out,'recibo-problemas.json'),JSON.stringify(receipt,null,1),{mode:0o600});console.log(JSON.stringify(receipt));
}
if(import.meta.url===`file://${process.argv[1]}`)cli().catch(e=>{console.error('ERROR',scrub(e.message).slice(0,200));process.exit(1);});
