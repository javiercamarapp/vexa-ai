#!/usr/bin/env node
// Proyecta costo/tiempo para N conversaciones a partir de las corridas de medir.mjs (sin red, sin llave).
// Modelo: costo(conv) = a + b*chars_fuente, ajustado por mínimos cuadrados sobre cada corrida medida.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const OUT=path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/ia-escala-20261019');
const N=+(process.env.N||102700),MSGS_PER_CONV=293000/102700,MARGIN=1.2,BUDGET=+(process.env.BUDGET||35);
const load=f=>JSON.parse(fs.readFileSync(path.join(OUT,f+'.json'))).records;
const runs={
 'haiku-5.5 | gateway actual':load('cheap-full').filter(r=>r.model==='anthropic/claude-haiku-5.5'),
 'haiku-5.5 | compacto+cache (frío)':[...load('haiku-cc-full'),...load('haiku-cc-full2')].filter(r=>!(r.cached_tokens>4000)),
 'haiku-5.5 | compacto+cache (tibio)':[...load('haiku-cc-full'),...load('haiku-cc-full2'),...load('v-cc-haiku')].filter(r=>r.cached_tokens>4000),
 'haiku-5.5 | compacto (sin cache)':load('v-compact-haiku'),
 'deepseek-v4.1-flash | gateway actual':load('cheap-full').filter(r=>r.model==='deepseek/deepseek-v4.1-flash'),
 'deepseek-v4.1-flash | compacto':load('cheap-compact').filter(r=>r.model==='deepseek/deepseek-v4.1-flash'),
 'mistral-small-3.2 | compacto':load('cheap-compact').filter(r=>r.model.startsWith('mistralai')),
 'gpt-oss-20b | gateway actual':load('cheap-full').filter(r=>r.model==='openai/gpt-oss-20b'),
 'sonnet-5.5 | gateway actual':load('sonnet-subset'),
};
function fit(rs){rs=rs.filter(r=>r.cost_usd!=null);const n=rs.length;const mx=rs.reduce((a,r)=>a+r.in_chars,0)/n,my=rs.reduce((a,r)=>a+r.cost_usd,0)/n;
 const sxx=rs.reduce((a,r)=>a+(r.in_chars-mx)**2,0);const b=sxx?rs.reduce((a,r)=>a+(r.in_chars-mx)*(r.cost_usd-my),0)/sxx:0;return{n,a:my-b*mx,b,mean:my,ms:rs.reduce((a,r)=>a+r.ms,0)/n};}
// Calibración con el piloto real del 14-oct: 4 mensajes = 12,831 tokens de prompt con Haiku; pendiente tokens/char medida en gateway actual.
const hb=load('cheap-full').filter(r=>r.model==='anthropic/claude-haiku-5.5').filter(r=>r.prompt_tokens);
const n=hb.length,mx=hb.reduce((a,r)=>a+r.in_chars,0)/n,my=hb.reduce((a,r)=>a+r.prompt_tokens,0)/n,k=hb.reduce((a,r)=>a+(r.in_chars-mx)*(r.prompt_tokens-my),0)/hb.reduce((a,r)=>a+(r.in_chars-mx)**2,0),F=my-k*mx;
const charsPer4=(12831-F)/k,charsPerMsg=charsPer4/4,charsConv=charsPerMsg*MSGS_PER_CONV;
const scen={'A fixtures (≈391 car./conv)':391,['B calibrado piloto (≈'+Math.round(charsConv)+' car./conv)']:charsConv,'C pesimista (+50 % texto)':charsConv*1.5};
const rows=[];
// Batch API medido: 4 solicitudes compactas costaron US$0.00039/conv vs US$0.00075 síncrono (factor 0.52); estimado, no validado a escala.
const BATCH=0.52;runs['haiku-5.5 | compacto + Batch API (estimado x0.52)']=load('v-compact-haiku').map(r=>({...r,cost_usd:r.cost_usd*BATCH}));
for(const [name,rs] of Object.entries(runs)){const f=fit(rs);const o={opcion:name,muestra:f.n,lat_ms_media:Math.round(f.ms)};
 for(const [sn,ch] of Object.entries(scen)){const c=Math.max(f.a+f.b*ch,0);o[sn]={usd_por_conv:+c.toFixed(6),usd_total_con_margen20:+(c*N*MARGIN).toFixed(2)};}
 rows.push(o);}
// cobertura dentro del presupuesto de extracción
for(const o of rows)for(const sn of Object.keys(scen)){const t=o[sn].usd_total_con_margen20;o[sn].cobertura_en_presupuesto=+Math.min(1,BUDGET/t).toFixed(3);}
console.log(JSON.stringify({N,msgs_por_conv:+MSGS_PER_CONV.toFixed(2),tokens_fijos_haiku:Math.round(F),tokens_por_char_haiku:+k.toFixed(3),chars_por_msg_real_estimado:Math.round(charsPerMsg),presupuesto_extraccion_usd:BUDGET,margen:MARGIN,rows},null,1));
fs.writeFileSync(path.join(OUT,'proyeccion.json'),JSON.stringify({N,BUDGET,MARGIN,F,k,charsConv,rows},null,1));
