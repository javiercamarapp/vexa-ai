#!/usr/bin/env node
// Agrupación LOCAL idéntica en criterio al runtime de problemas (packages/problems/runtime.mjs): inserción en línea; cada
// embedding se une al vecino más cercano (distancia coseno) si dist <= threshold, si no abre un problema nuevo.
// Entrada: embeddings.jsonl del runner. Salida: problemas.json con SOLO conteos/etiquetas de taxonomía (sin texto).
// La base real ejecuta este mismo criterio con pgvector al persistir; esto sirve para previsualizar y para validar el umbral.
import fs from 'node:fs';
import path from 'node:path';
const dec=b64=>{const b=Buffer.from(b64,'base64');return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
const norm=v=>{let s=0;for(const x of v)s+=x*x;s=Math.sqrt(s)||1;const o=new Float32Array(v.length);for(let i=0;i<v.length;i++)o[i]=v[i]/s;return o;};
export function clusterRows(rows,{threshold=0.25}={}){
  const vecs=[],cl=[];const problems=[];
  const sorted=[...rows].sort((a,b)=>a.message_id<b.message_id?-1:1); // orden estable
  for(const r of sorted){
    const v=norm(dec(r.vec_f32_b64));let best=-1,bd=Infinity;
    for(let i=0;i<vecs.length;i++){const u=vecs[i];let dot=0;for(let k=0;k<v.length;k++)dot+=v[k]*u[k];const d=1-dot;if(d<bd||d===bd&&i<best){bd=d;best=i;}}
    let pid;if(best>=0&&bd<=threshold)pid=cl[best];else{pid=problems.length;problems.push({id:pid,label:r.label,severity:r.severity,members:0,conversations:new Set(),labels:{}});}
    vecs.push(v);cl.push(pid);const p=problems[pid];p.members++;p.conversations.add(r.conversation_id);p.labels[r.label]=(p.labels[r.label]??0)+1;
  }
  return problems.map(p=>({id:p.id,label:p.label,members:p.members,conversations:p.conversations.size,outlier:p.members===1,labels:p.labels}));
}
if(import.meta.url===`file://${process.argv[1]}`){
  const a=process.argv.slice(2);const o=(n,d)=>{const i=a.indexOf('--'+n);return i>=0?a[i+1]:d;};
  const f=o('in');const rows=fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(JSON.parse);
  if(a.includes('--sweep')){for(const t of [0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5]){const P=clusterRows(rows,{threshold:t});console.log(JSON.stringify({threshold:t,problemas:P.length,atipicos:P.filter(p=>p.outlier).length,mayor:Math.max(...P.map(p=>p.members))}));}process.exit(0);}
  const th=+o('threshold',0.25);const P=clusterRows(rows,{threshold:th});
  const out={threshold:th,embeddings:rows.length,problemas:P.length,atipicos:P.filter(p=>p.outlier).length,top:P.sort((x,y)=>y.members-x.members).slice(0,20)};
  fs.writeFileSync(path.join(path.dirname(f),'problemas.json'),JSON.stringify(out,null,1),{mode:0o600});console.log(JSON.stringify({...out,top:out.top.length}));
}
