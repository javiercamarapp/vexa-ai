// Revalida el pipeline COMPACTO completo (preprocesado + prompt compacto + validación de producción) con las 47 fixtures SINTÉTICAS.
// Contenido 100 % inventado: es el único modo que puede enviar texto sin la bandera --yes-send-real-text.
import fs from 'node:fs';
import path from 'node:path';
import {FIXTURES,materialize} from './fixtures.mjs';
import {TAXONOMY} from './taxonomy.mjs';
import {runCohort,DEFAULT_MODEL} from './cohorte.mjs';
import {createClient} from './openrouter.mjs';
import {createLedger} from './spend.mjs';

export const BASELINE={tp:42,fp:3,fn:3,precision:0.933,recall:0.933,neg_fp_cases:0,cite_fail:0,fuente:'cheap-full.json, haiku-5.5 con gateway actual (47 fixtures)'};
const idxOf=id=>{const m=/-m(\d+)$/.exec(id);return m?+m[1]:-1;};
export function scoreFixtures(fixtures,records){
  const by=new Map(records.map(r=>[r.conversation_id,r]));
  const s={n:fixtures.length,tp:0,fp:0,fn:0,support_ok:0,neg_cases:0,neg_fp_cases:0,skipped_by_rule:0,failed:0,cite_fail:0,missing:0};
  for(const f of fixtures){
    const r=by.get(f.id);const neg=f.truth.length===0;if(neg)s.neg_cases++;
    if(!r){s.missing++;s.fn+=f.truth.length;continue;}
    if(r.status==='failed'){s.failed++;if(['invalid_reference','invalid_entity','invalid_output'].includes(r.reason))s.cite_fail++;s.fn+=f.truth.length;continue;}
    if(r.status==='skipped'){s.skipped_by_rule++;
      // regla de notificaciones automáticas: acierto si la verdad era solo "Notificación automática"
      const onlyAuto=f.truth.length>0&&f.truth.every(t=>t[0]==='Otros: Notificación automática');
      if(onlyAuto)s.tp+=f.truth.length;else s.fn+=f.truth.length;continue;}
    const used=new Set();let predN=0;
    for(const it of r.issues){predN++;const t=f.truth.find(([c])=>c===it.category);
      if(t&&!used.has(it.category)){used.add(it.category);s.tp++;if(it.evidence.some(e=>t[1].includes(idxOf(e.message_id))))s.support_ok++;}else s.fp++;}
    s.fn+=f.truth.filter(([c])=>!used.has(c)).length;
    if(neg&&predN>0)s.neg_fp_cases++;
  }
  s.precision=s.tp+s.fp?+(s.tp/(s.tp+s.fp)).toFixed(3):null;s.recall=s.tp+s.fn?+(s.tp/(s.tp+s.fn)).toFixed(3):null;
  return s;
}
export async function runFixtures({limit=47,out,cap=0.5,client=null,provider='azure',concurrency=6}){
  const fx=FIXTURES.slice(0,limit);
  const convs=fx.map(f=>({conversation_id:f.id,messages:materialize(f).map((m,i)=>({id:m.message_revision_id,role:m.role,text:m.text,at:String(1000+i)}))}));
  fs.mkdirSync(out,{recursive:true});
  for(const f of['resultados-fixtures.jsonl','embeddings-fixtures.jsonl'])fs.rmSync(path.join(out,f),{force:true}); // corrida limpia (cuenta como gasto nuevo)
  const ledger=createLedger({dir:out,capTotalUsd0:cap,capBatchUsd0:cap,batchId:'fixtures',file:'gasto-fixtures.jsonl'});
  const c=client??createClient({rps:6});
  const {receipt}=await runCohort({convs,taxonomy:TAXONOMY,outDir:out,client:c,provider,concurrency,ledger,batchId:'fixtures',fileTag:'-fixtures',capTotalUsd0:cap,capBatchUsd0:cap});
  const recs=fs.readFileSync(path.join(out,'resultados-fixtures.jsonl'),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
  const score=scoreFixtures(fx,recs);
  const report={generado:new Date().toISOString(),baseline:BASELINE,compacto:score,recibo:receipt};
  fs.writeFileSync(path.join(out,'informe-fixtures.json'),JSON.stringify(report,null,1));
  console.log(JSON.stringify({baseline:BASELINE,compacto:score,gasto:receipt.gasto,tokens:receipt.tokens,latencia_ms:receipt.latencia_ms,abort:receipt.abort},null,1));
  return report;
}
