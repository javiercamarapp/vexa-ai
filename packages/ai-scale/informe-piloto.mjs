#!/usr/bin/env node
// Informe de calidad/costo del piloto SIN etiquetas y SIN contenido: solo conteos, tasas, categorías de taxonomía e ids.
//   node informe-piloto.mjs [--dir DIR] [--batch piloto-200] [--total 14000]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256} from '../intelligence/index.mjs';
const a=process.argv.slice(2);const opt=(n,d)=>{const i=a.indexOf('--'+n);return i>=0?a[i+1]:d;};
const dir=opt('dir',path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019/cohorte'));
export function pilotReport(recs,{batch,total=null,sample=30}={}){
  const rs=recs.filter(r=>!batch||r.batch===batch);const by=s=>rs.filter(r=>r.status===s);
  const sent=rs.filter(r=>r.status!=='skipped');const ok=by('ok'),ab=by('abstained'),fail=by('failed'),sk=by('skipped');
  const cost=sent.reduce((s,r)=>s+(r.cost_usd??0),0);const per=sent.length?cost/sent.length:0;
  const cats={};for(const r of ok)for(const i of r.issues)cats[i.category]=(cats[i.category]??0)+1;
  const dist={};for(const r of ok){const n=r.issues.length;dist[n]=(dist[n]??0)+1;}
  const sev={};for(const r of ok)for(const i of r.issues)sev[i.severity]=(sev[i.severity]??0)+1;
  const pt=sent.reduce((s,r)=>s+(r.usage?.prompt??0),0),ct=sent.reduce((s,r)=>s+(r.usage?.cached??0),0);
  const pick=(arr,n)=>[...arr].sort((x,y)=>sha256('rev|'+x.conversation_id).localeCompare(sha256('rev|'+y.conversation_id))).slice(0,n).map(r=>r.conversation_id);
  return{lote:batch??'todos',conversaciones:rs.length,omitidas_por_regla:sk.length,enviadas:sent.length,ok:ok.length,abstenciones:ab.length,fallidas:fail.length,
    tasa_validez:sent.length?+((ok.length+ab.length)/sent.length).toFixed(4):null,tasa_abstencion:sent.length?+(ab.length/sent.length).toFixed(4):null,
    fallos_por_causa:fail.reduce((m,r)=>(m[r.reason]=(m[r.reason]??0)+1,m),{}),
    issues_por_conversacion:dist,severidades:sev,categorias_top:Object.entries(cats).sort((x,y)=>y[1]-x[1]).slice(0,15),categorias_distintas:Object.keys(cats).length,
    entidades:ok.reduce((s,r)=>s+r.entities.length,0),
    costo_total_usd:+cost.toFixed(5),costo_por_conversacion_usd:+per.toFixed(6),tasa_cache:pt?+(ct/pt).toFixed(3):null,
    proyeccion_total_usd:total?{conversaciones:total,tras_reglas:Math.round(total*(sent.length/Math.max(1,rs.length))),usd:+(per*total*(sent.length/Math.max(1,rs.length))).toFixed(2)}:null,
    muestra_revision_humana:{abstenciones:pick(ab,10),ok:pick(ok,sample-Math.min(10,ab.length)),nota:'solo ids de conversación; revisar en la app/base y anotar acierto/error por categoría'}};
}
if(import.meta.url===`file://${process.argv[1]}`){
  const recs=fs.readFileSync(path.join(dir,'resultados.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const rep=pilotReport(recs,{batch:opt('batch','piloto-200'),total:+opt('total',0)||null});
  fs.writeFileSync(path.join(dir,'informe-piloto.json'),JSON.stringify(rep,null,1),{mode:0o600});console.log(JSON.stringify(rep,null,1));
}
