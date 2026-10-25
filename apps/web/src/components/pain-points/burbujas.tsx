'use client';
import {useMemo,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTipPosicion} from '../ui/use-tip-posicion';
import type {PainVista,PuntoPP,TemaPP} from '../../../../../packages/workspace-service/pain-points.d.mts';
import {disponerBurbujas,estadoDe,LINE_H,TEMA_NOTA,type Burbuja,type Cluster,type Modo} from './burbujas-modelo.mjs';
import {etiquetaBurbuja,num,usdCorto,CLASE_NOMBRE} from './modelo.mjs';
import {useWidth} from '../ui/use-width';

const cat=(c:number)=>`var(--chart-${((c-1)%8)+1})`;
const money=(v:number)=>usdCorto(String(Math.round(v*100)));
const fmt=(v:number,modo:Modo)=>modo==='dinero'?money(v):num(Math.round(v));
const money2=(v:number)=>v>=1e6?'$'+(v/1e6).toLocaleString('es-MX',{maximumFractionDigits:2})+' M':money(v);
const pl=(n:number,uno:string,varios:string)=>`${num(n)} ${n===1?uno:varios}`;

/** Mapa de burbujas SVG: UNA escala de área para todo el mapa (r = raíz del valor), un cúmulo por tema, posiciones deterministas. Cada burbuja es un botón; el color es el tema y la clase va en el trazo. */
export function Burbujas({vista,modo,seleccion,onElegir,visibles}:{vista:PainVista;modo:Modo;seleccion:string|null;onElegir:(id:string)=>void;visibles:Set<string>|null}){
 const [ref,w]=useWidth<HTMLDivElement>(),ancho=Math.max(260,w||840);
 const puntos=useMemo(()=>vista.puntos.filter(p=>!visibles||visibles.has(p.tema)),[vista,visibles]);
 const temasVis=useMemo(()=>vista.temas.map(t=>t.id).filter(id=>!visibles||visibles.has(id)),[vista,visibles]);
 const D=useMemo(()=>disponerBurbujas({puntos,modo,ancho,temas:temasVis,escalaDe:vista.puntos}),[puntos,modo,ancho,temasVis,vista]);
 const porId=useMemo(()=>new Map(vista.puntos.map(p=>[p.id,p])),[vista]);
 const tema=(id:string):TemaPP=>vista.temas.find(t=>t.id===id)??{id,nombre:id,c:8};
 const [hover,setHover]=useState<string|null>(null),refs=useRef<Record<string,SVGGElement|null>>({});
 const todas=useMemo(()=>D.clusters.flatMap(c=>c.burbujas),[D]);
 const otro:Modo=modo==='dinero'?'volumen':'dinero';
 function tecla(e:KeyboardEvent,i:number,b:Burbuja){
  const d=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;
  if(d){e.preventDefault();const n=todas[(i+d+todas.length)%todas.length];refs.current[n.id]?.focus();}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();onElegir(b.tipo==='punto'?b.id:b.ids![0]);}
 }
 const tip=hover?todas.find(b=>b.id===hover):null,tp=tip&&tip.tipo==='punto'?porId.get(tip.id):null;
 const hay=D.clusters.length>0;
 const verTip=(b:Burbuja)=>b.tipo==='punto'&&tp?<><b>{tp.nombre}</b><span>{modo==='dinero'?(tp.dinero.sinDato?'Sin dato':'USD '+(Number(BigInt(tp.dinero.minor))/100).toLocaleString('es-MX',{minimumFractionDigits:2})):(tp.volumen.sinDato?'Sin dato':num(tp.volumen.n)+' '+tp.volumen.unidad)}</span><span>{CLASE_NOMBRE[tp.clase]} · {tema(b.tema).nombre}</span></>:<><b>{pl(b.n!,'punto pequeño','puntos pequeños')} · {fmt(b.valor,modo)}{modo==='dinero'?' USD':''}</b>{b.miembros!.slice(0,8).map(m=><span key={m.id}>{m.nombre} · {fmt(m.valor,modo)}</span>)}{b.miembros!.length>8&&<span>y {b.miembros!.length-8} más</span>}<span>{tema(b.tema).nombre}</span></>;
 const refTxt=(v:number)=>modo==='dinero'?money(v):num(v);
 const conc=D.conciliacion;
 return <div className="pp-mapa" ref={ref}>
  <p className="pp-explica">Cada burbuja es un punto de dolor. {modo==='dinero'?'El tamaño es el dinero en USD bruto (devuelto, pendiente o cancelado).':'El tamaño es el volumen de casos; cada burbuja cuenta lo suyo (reembolsos, solicitudes, hilos o contactos).'} Los cúmulos agrupan por tema. Clic abre la evidencia.</p>
  <ul className="pp-leyenda" aria-label="Leyenda del mapa">
   <li className="pp-ley-tam"><span className="pp-ley-t">Tamaño (misma escala en todos los cúmulos):</span>{D.escala.refs.map(r=><span key={r.valor} className="pp-ref"><svg width={Math.ceil(r.r*2)+2} height={Math.ceil(r.r*2)+2} aria-hidden="true"><circle cx={r.r+1} cy={r.r+1} r={r.r} fill="var(--ui-soft)" stroke="var(--ink-8)" strokeWidth={1.5}/></svg><b>{refTxt(r.valor)}</b></span>)}</li>
   <li><i className="pp-l-o"/>Observado: contorno sólido</li><li><i className="pp-l-i"/>Inferido: discontinuo</li><li><i className="pp-l-e"/>Estimado: rayado</li><li><i className="pp-l-g"/>Punteado: varios puntos pequeños juntos (cada uno menos de {fmt(D.escala.valorUmbral,modo)})</li>
  </ul>
  {hay&&<div className="pp-cumulos" style={{gridTemplateColumns:`repeat(${D.cols},minmax(0,1fr))`,gap:D.gap}}>
   {D.clusters.map(c=>{const t=tema(c.id);return <Cumulo key={c.id} c={c} t={t} modo={modo} otro={otro} onElegir={onElegir}>
    <svg className="pp-svg" viewBox={`0 0 ${c.ancho} ${c.alto}`} width="100%" height={c.alto} role="group" aria-labelledby={'pp-c-'+c.id}>
     <defs><pattern id={'pp-r-'+c.id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--ui-surface)"/><rect width="4" height="8" fill={`var(--soft-${t.c})`}/></pattern></defs>
     {c.burbujas.map(b=>{
      const i=todas.indexOf(b),p=b.tipo==='punto'?porId.get(b.id)!:null,sel=seleccion===b.id,L=b.label,H=(L.lineas.length+1)*LINE_H;
      const etiqueta=p?etiquetaBurbuja(p,t.nombre,modo):`${t.nombre}, ${pl(b.n!,'punto pequeño','puntos pequeños')}, suma ${fmt(b.valor,modo)}${modo==='dinero'?' USD':''}: ${b.miembros!.slice(0,5).map(m=>m.nombre).join(', ')}${b.miembros!.length>5?' y más':''}`;
      const dash=b.tipo==='grupo'?'2 3':p?.clase==='I'?'6 3':undefined,fill=p?.clase==='E'?`url(#pp-r-${c.id})`:`var(--soft-${t.c})`;
      return <g key={b.id} ref={el=>{refs.current[b.id]=el;}} className="pp-burbuja" data-sel={sel||undefined} data-tipo={b.tipo} data-valor={b.valor} data-r={b.r} tabIndex={0} role="button" aria-label={etiqueta} aria-pressed={sel} transform={`translate(${b.cx} ${b.cy})`}
       onClick={()=>onElegir(b.tipo==='punto'?b.id:b.ids![0])} onKeyDown={e=>tecla(e,i,b)} onMouseEnter={()=>setHover(b.id)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(b.id)} onBlur={()=>setHover(null)}>
       <circle r={b.r} fill={fill} stroke={sel?'var(--ink-8)':cat(t.c)} strokeWidth={sel?3:1.5} strokeDasharray={dash}/>
       {L.dentro?<text textAnchor="middle" className="pp-txt" fill={`var(--ink-${t.c})`}>{L.lineas.map((l,k)=><tspan key={k} x={0} y={-H/2+LINE_H*k+11}>{l}</tspan>)}<tspan x={0} y={-H/2+LINE_H*L.lineas.length+11} className="pp-val">{L.valor}</tspan></text>
        :<text textAnchor="middle" className="pp-txt" fill={`var(--ink-${t.c})`}><tspan x={0} y={b.r+13}>{L.lineas[0]}</tspan><tspan x={0} y={b.r+13+LINE_H} className="pp-val">{L.valor}</tspan></text>}
      </g>;
     })}
    </svg>
   </Cumulo>;})}
  </div>}
  {D.vacios.length>0&&<ul className="pp-vacios" aria-label={'Temas sin cifra en esta medida'}>
   {D.vacios.map(v=>{const t=tema(v.id),ps=[...v.sinCifra,...v.ceros];return <li key={v.id}><i className="pp-punto" style={{background:cat(t.c)}} aria-hidden="true"/><b>{t.nombre}</b>: sin cifra en {modo==='dinero'?'dinero':'volumen'}{ps.length>0?' · ':''}{ps.map((p,k)=><span key={p.id}>{k>0?' · ':''}<button type="button" className="row-link-inline" onClick={()=>onElegir(p.id)}>{p.nombre}</button>{estadoDe(p,otro)==='valor'?` (sí tiene ${otro})`:''}</span>)}</li>;})}
  </ul>}
  {!hay&&<p className="pp-vacio-txt">Sin puntos de dolor con cifra en este filtro. Cambia de tema o de medida (Dinero / Volumen).</p>}
  {tip&&typeof document!=='undefined'&&createPortal(<TipBurbuja ancla={()=>{const r=refs.current[tip.id]?.getBoundingClientRect();return r?{ax:r.left+r.width/2,ay:r.top+r.height/2,modo:'arriba' as const,sep:r.height/2+8}:null;}}>{verTip(tip)}</TipBurbuja>,document.body)}
  {conc.aplica?<p className="pp-concilia" aria-label="Cómo cuadran las cifras"><b>Cómo cuadra:</b> las burbujas suman {money2(conc.suma!)} porque varios puntos son cortes del mismo dinero (por canal, por SKU, Tracker y Walmart pendiente). Sin repetir son <b>{money2(conc.sinRepetir!)}</b>{conc.items.length>0&&<> = {conc.items.map((x,k)=><span key={x.id}>{k>0?' + ':''}{x.nombre} {money(x.valor)}</span>)}</>}. «Dinero devuelto» es el indicador de arriba; los pedidos cancelados no son reembolsos.</p>
   :<p className="pp-concilia"><b>Cómo cuadra:</b> en Volumen los cúmulos no se suman entre sí: cada uno cuenta cosas distintas (reembolsos, solicitudes, hilos, contactos).</p>}
 </div>;
}
function Cumulo({c,t,modo,otro,onElegir,children}:{c:Cluster;t:TemaPP;modo:Modo;otro:Modo;onElegir:(id:string)=>void;children:ReactNode}){
 const g=c.burbujas.find(b=>b.tipo==='grupo'),r=c.reparte;
 const tot=modo==='dinero'?money(c.total)+' USD':c.unidad?`${num(c.total)} ${c.unidad}`:null;
 const sin=[...c.sinCifra,...c.ceros];
 return <section className="pp-cumulo" aria-labelledby={'pp-c-'+c.id} data-tema={c.id}>
  <header className="pp-cumulo-cab">
   <h3 id={'pp-c-'+c.id} className="pp-cumulo-t" style={{color:`var(--ink-${t.c})`}}>{t.nombre}</h3>
   <p className="pp-cumulo-n"><b>{pl(c.n,'punto','puntos')}</b>{tot?<> · suman {tot}</>:null}</p>
   <p className="pp-cumulo-nota">{TEMA_NOTA[c.id]??''}{r&&<> · {r.pct>=99.5?'suman el 100 %':`son el ${num(r.pct)} %`} {modo==='dinero'?'del dinero devuelto':'de los reembolsos'} ({fmt(r.total,modo)}){r.otros.length>0&&<>; aparte: {r.otros.slice(0,2).map(o=>o.nombre+' '+fmt(o.valor,modo)).join(', ')}</>}</>}</p>
  </header>
  {children}
  {(g||sin.length>0)&&<p className="pp-cumulo-pie">
   {g&&<span><b>{pl(g.n!,'pequeño suma','pequeños suman')} {fmt(g.valor,modo)}:</b> {g.miembros!.slice(0,6).map((m,k)=><span key={m.id}>{k>0?' · ':' '}<button type="button" className="row-link-inline" onClick={()=>onElegir(m.id)}>{m.nombre}</button></span>)}{g.miembros!.length>6?` y ${g.miembros!.length-6} más`:''}. </span>}
   {sin.length>0&&<span><b>Sin cifra en esta medida (no es 0):</b> {sin.map((p,k)=><span key={p.id}>{k>0?' · ':' '}<button type="button" className="row-link-inline" onClick={()=>onElegir(p.id)}>{p.nombre}</button>{estadoDe(p,otro)==='valor'?` (sí tiene ${otro})`:''}</span>)}</span>}
  </p>}
 </section>;
}
export type {PuntoPP};

/** Tooltip de burbuja: portal a <body> con position:fixed (ni el SVG ni la tarjeta lo recortan), centrado sobre la burbuja, volteado debajo si arriba no cabe y acotado al viewport. */
function TipBurbuja({ancla,children}:{ancla:()=>{ax:number;ay:number;modo:'arriba';sep:number}|null;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useTipPosicion(ref,true,ancla);
 return <div ref={ref} className="pp-tip" role="presentation">{children}</div>;
}
