'use client';
import {useState} from 'react';
export type TemaSugerido={titulo:string;preguntas:readonly string[]};
/** Sugerencias de la portada sin tarjetas grandes: una fila de temas (chips con su color fijo por orden) y, debajo, las preguntas del tema elegido como chips compactos.
 *  Cabe en una pantalla de celular: 1 fila de temas + hasta 3 preguntas de una línea (el texto completo va en el título y se envía íntegro). */
export function TemasRapidos({temas,ask}:{temas:readonly TemaSugerido[];ask:(q:string)=>void}){
 const [i,setI]=useState(0);
 if(temas.length===0)return null;
 const t=temas[Math.min(i,temas.length-1)];
 return <section className="una-sug" aria-label="Preguntas por tema">
  <div className="una-temas" role="group" aria-label="Preguntas por tema">{temas.map((x,k)=><button type="button" key={x.titulo} className="ctl ctl-tema" aria-pressed={k===i} style={{['--cat' as string]:`var(--chart-${(k%8)+1})`}} onClick={()=>setI(k)}><i aria-hidden="true"/><span className="ctl-label">{x.titulo}</span></button>)}</div>
  <div className="una-preguntas" role="group" aria-label={t.titulo} key={t.titulo}>{t.preguntas.slice(0,3).map(q=><button type="button" key={q} className="ctl ctl-q agente-tema-q" title={q} onClick={()=>ask(q)}><span className="ctl-label">{q}</span></button>)}</div>
 </section>;
}
