'use client';
import {useState} from 'react';
import type {BrechasVista,Recomendacion} from '../../../../../packages/workspace-service/brechas.mjs';
import {recomendacionDeBrecha} from '../../../../../packages/workspace-service/brechas-recomendacion.mjs';
import {Card} from '../ui/card';
import {Chip} from '../ui/chip';
import {DataTable,type Column} from '../ui/data-table';
import {KindBadge} from '../ui/kind-badge';
import {Button,LinkButton,Arrow} from '../ui/button';
import {Icon} from '../ui/icons';
import {DonaMini,color} from '../ui/mini-charts';
import {Cascada,Leyenda,ListaBarras,Vacio,type PasoCascada} from '../dinero/partes';
import {NoDisponible} from '../refunds/fuga-partes';
import {Avance} from './gaps-familias';
import {CLAVE_BORRADOR} from './gaps-recs';
import {NOMBRE,mesCorto,mesLargo,num,pct,usd,variacion,TIPO_REC} from './gaps-modelo.mjs';

const big=(m:string)=>Number(BigInt(m)/100n);
const corto=(n:number)=>n>=1_000_000?`US$${(n/1_000_000).toFixed(1)}M`:n>=1000?`US$${Math.round(n/1000)}k`:`US$${n}`;
type Ing=Extract<BrechasVista['ingresos'],{status:'ok'}>;
const CANAL_C:Record<string,number>={amazon:1,walmart:5,bestbuy:4,shopify:3};
const cc=(c:string)=>CANAL_C[c]??8;
const calidadMes=(m:Ing['meses'][number])=>Object.values(m.canales).some(c=>c.calidad==='posible_hueco')?'posible_hueco':Object.values(m.canales).some(c=>c.calidad==='parcial')?'parcial':'completo';

/** Variación del último mes completo contra el anterior completo (ingreso bruto total); null si no hay dos consecutivos. */
export function variacionVentas(ing:Ing|null):number|null{
 if(!ing)return null;const c=ing.meses.filter(m=>calidadMes(m)==='completo');if(c.length<2)return null;
 const a=big(c[c.length-2].totalMinor),b=big(c[c.length-1].totalMinor);return a>0?(b-a)*100/a:null;
}
/** Recorta el ingreso a los últimos `meses` meses (null = todos) y a los canales activos; recalcula totales y participación con BigInt (importes en minor como texto). */
export function filtrarIngresos(ing:Ing,meses:number|null,activos:string[]):Ing{
 const todos=ing.meses.slice().sort((a,b)=>a.mes.localeCompare(b.mes)),ms=(meses?todos.slice(-meses):todos).map(m=>{
  const canales=Object.fromEntries(Object.entries(m.canales).filter(([c])=>activos.includes(c)));
  return {...m,canales,totalMinor:String(Object.values(canales).reduce((a,c)=>a+BigInt(c.activoMinor),0n))};
 }) as Ing['meses'];
 const lin:Record<string,number>={},act:Record<string,bigint>={};
 for(const m of ms)for(const [c,v] of Object.entries(m.canales)){lin[c]=(lin[c]??0)+v.lineas;act[c]=(act[c]??0n)+BigInt(v.activoMinor);}
 const total=Object.values(act).reduce((a,b)=>a+b,0n);
 const canales=ing.canales.filter(c=>activos.includes(c.canal)&&(act[c.canal]??0n)>0n).map(c=>({...c,lineas:lin[c.canal]??0,activoMinor:String(act[c.canal]),participacionPct:total>0n?Math.round(Number(act[c.canal]*1000n/total))/10:0})).sort((a,b)=>b.participacionPct-a.participacionPct) as Ing['canales'];
 return {...ing,meses:ms,canales,activoMinor:String(total)} as Ing;
}
export const serieVentas=(ing:Ing|null)=>ing?ing.meses.filter(m=>calidadMes(m)==='completo').map(m=>big(m.totalMinor)):[];

// ---------- Ingreso por mes y canal (columnas apiladas con color por canal)
export function GraficoMeses({ing}:{ing:Ing}){
 const max=Math.max(1,...ing.meses.map(m=>big(m.totalMinor)));
 const canales=[...new Set(ing.meses.flatMap(m=>Object.keys(m.canales)))].sort((a,b)=>cc(a)-cc(b));
 const resumen=ing.meses.map(m=>`${mesLargo(m.mes)} ${usd(m.totalMinor)}`).join(', ');
 return <div className="dg-fill">
  <Leyenda items={[...canales.map(c=>({label:NOMBRE[c]??c,c:cc(c)})),{label:'Mes parcial o con posible hueco',hatch:true}]}/>
  <div className="dg-meses" style={{gridTemplateColumns:`repeat(${ing.meses.length},minmax(0,1fr))`}} role="img" aria-label={`Ingreso bruto por mes en dólares: ${resumen}. Los meses parciales o con posible hueco llevan trama.`}>
   {ing.meses.map(m=><div key={m.mes} className="dg-mes" data-q={calidadMes(m)}>
    <span className="dg-mes-v">{corto(big(m.totalMinor))}</span>
    <span className="dg-mes-a">{canales.filter(c=>m.canales[c]).map(c=><i key={c} title={`${NOMBRE[c]??c}: ${usd(m.canales[c].activoMinor)}`} style={{height:`${Math.max(1,big(m.canales[c].activoMinor)*100/max)}%`,background:color(cc(c)-1)}}/>)}</span>
    <span className="dg-mes-m">{mesCorto(m.mes).split(' ')[0]}<small>{mesCorto(m.mes).split(' ')[1]}</small></span></div>)}
  </div>
  <div className="sr-only"><table><caption>Ingreso bruto por mes y canal</caption><thead><tr><th>Mes</th>{canales.map(c=><th key={c}>{NOMBRE[c]??c}</th>)}<th>Total</th></tr></thead>
   <tbody>{ing.meses.map(m=><tr key={m.mes}><th scope="row">{mesLargo(m.mes)}</th>{canales.map(c=><td key={c}>{m.canales[c]?usd(m.canales[c].activoMinor):'sin dato'}</td>)}<td>{usd(m.totalMinor)}</td></tr>)}</tbody></table></div>
 </div>;
}

export function PanelCanales({ing}:{ing:Ing}){
 const cs=ing.canales;
 return <div className="dg-fill">
  <DonaMini label="Ingreso bruto por canal" size={112} sinLeyenda items={cs.slice(0,5).map(c=>({label:NOMBRE[c.canal]??c.canal,value:big(c.activoMinor),c:cc(c.canal)}))} centro={<span className="dg-dona-c"><b>{corto(big(ing.activoMinor))}</b><small>bruto</small></span>}/>
  <ListaBarras label="Participación por canal" max={100} items={cs.map(c=>({key:c.canal,c:cc(c.canal),etiqueta:NOMBRE[c.canal]??c.canal,sub:`${num(c.lineas)} líneas`,valor:c.participacionPct,texto:pct(c.participacionPct),sub2:corto(big(c.activoMinor))}))}/>
 </div>;
}

// ---------- Puente de ventas a ingreso retenido
export function Puente({v}:{v:BrechasVista}){
 const ing=v.ingresos.status==='ok'?v.ingresos:null,r=v.perdidas.reembolsos,c=v.perdidas.cancelaciones,t=v.perdidas.tracker;
 if(!ing||r.status!=='ok'||c.status!=='ok')return <Vacio>El puente necesita pedidos, cancelaciones y reembolsos cargados. No se dibuja con datos faltantes.</Vacio>;
 const activo=big(ing.activoMinor),canc=big(c.canceladoMinor),reem=big(r.activoMinor);
 const pasos:PasoCascada[]=[
  {key:'v',label:'Ventas',valor:activo+canc,texto:corto(activo+canc),tipo:'total',c:1},
  {key:'c',label:'Cancel.',valor:canc,texto:'−'+corto(canc),tipo:'resta',c:2},
  {key:'r',label:'Reembolsos',valor:reem,texto:'−'+corto(reem),tipo:'resta',c:2},
  {key:'i',label:'Retenido',valor:Math.max(0,activo-reem),texto:corto(Math.max(0,activo-reem)),tipo:'total',c:3},
  ...(t.status==='ok'&&t.negadosMinor?[{key:'n',label:'No recuperado',valor:big(t.negadosMinor),texto:corto(big(t.negadosMinor)),tipo:'aparte' as const,c:4}]:[]),
 ];
 const ventas=activo+canc,p=(x:number)=>ventas>0?pct(Math.round(x*1000/ventas)/10):'—';
 return <div className="dg-fill"><Cascada pasos={pasos} label="Puente de ventas brutas a ingreso retenido"/>
  <ul className="dg-res ui-reset" aria-label="Qué parte de las ventas brutas queda">
   <li style={{['--cat' as string]:'var(--chart-3)'}}><i/><span>Se queda</span><b>{p(Math.max(0,activo-reem))}</b></li>
   <li style={{['--cat' as string]:'var(--chart-2)'}}><i/><span>Cancelaciones</span><b>{p(canc)}</b></li>
   <li style={{['--cat' as string]:'var(--chart-2)'}}><i/><span>Reembolsos</span><b>{p(reem)}</b></li></ul>
  <p className="dg-nota">Ingreso bruto, USD. «No recuperado» es una muestra del Tracker (con trama): no se resta otra vez. Las ventanas de pedidos y de reembolsos no coinciden por canal, así que el retenido es una cota, no un cierre contable.</p></div>;
}

// ---------- Tres columnas
export function ColGano({v}:{v:BrechasVista}){
 if(v.ranking.status!=='ok')return <Vacio>No hay SKUs del vendedor en el libro de pedidos.</Vacio>;
 const it=v.ranking.items.slice(0,7),max=big(it[0].activoMinor);
 return <ListaBarras c={1} label="SKUs que más ingreso dejan" apilado max={max} items={it.map(r=>({key:r.sku,etiqueta:r.sku,sub:r.canales.map(c=>NOMBRE[c.canal]??c.canal).join(' · '),valor:big(r.activoMinor),texto:corto(big(r.activoMinor)),sub2:r.crecimiento?variacion(r.crecimiento.pct):'sin comparar'}))}/>;
}
export function ColPierdo({v,onReintentar}:{v:BrechasVista;onReintentar:()=>void}){
 const t=v.perdidas.tracker;
 if(t.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(t.status!=='ok')return <Vacio>Sin Tracker cargado: no hay motivos que mostrar.</Vacio>;
 const it=[...t.motivos].sort((a,b)=>b.negados-a.negados||b.n-a.n).slice(0,7),max=Math.max(1,...it.map(m=>m.n));
 return <ListaBarras c={2} label="Motivos de solicitudes de reembolso" apilado max={max} items={it.map(m=>({key:m.motivo,etiqueta:m.etiqueta,sub:`${num(m.negados)} negadas o vencidas`,valor:m.n,texto:num(m.n),sub2:m.negadosMinor!=='0'?usd(m.negadosMinor):undefined}))}/>;
}
export function ColPodria({v,irA}:{v:BrechasVista;irA:(id:string)=>void}){
 const recs=v.recomendaciones.items.filter(r=>r.tipo!=='cross_sell');
 const orden=[...recs.filter(r=>r.tipo==='empujar'),...recs.filter(r=>r.tipo!=='empujar')].slice(0,7);
 if(!orden.length)return <Vacio>Ninguna regla se cumple con los datos de hoy. No significa que no haya oportunidades: las reglas piden meses completos y cruce con reembolsos.</Vacio>;
 const max=Math.max(1,...orden.map(r=>r.impacto.usdMinor?big(r.impacto.usdMinor):0));
 return <ListaBarras c={3} label="Candidatos a empujar o revisar" apilado max={max} items={orden.map(r=>({key:r.id,c:r.tipo==='empujar'?3:2,etiqueta:<button type="button" className="dg-sku ui-reset" onClick={()=>irA(r.id)}>{r.titulo}</button>,sub:TIPO_REC[r.tipo]??r.tipo,valor:r.impacto.usdMinor?big(r.impacto.usdMinor):0,texto:r.impacto.usdMinor?corto(big(r.impacto.usdMinor)):'—'}))}/>;
}
export function TresColumnas({v,onReintentar,irA}:{v:BrechasVista;onReintentar:()=>void;irA:(id:string)=>void}){
 return <div className="dg-row" data-split="4-4-4">
  <Card title="Dónde gano" description="SKUs con más ingreso bruto y su cambio mes contra mes" actions={<KindBadge kind="observed"/>}><ColGano v={v}/></Card>
  <Card title="Dónde pierdo y por qué" description="Motivos de las solicitudes de reembolso (Tracker)" actions={<KindBadge kind="observed"/>}><ColPierdo v={v} onReintentar={onReintentar}/></Card>
  <Card title="Dónde podría ganar" description="Candidatos a empujar o a revisar con el canal" actions={<KindBadge kind="inferred"/>}><ColPodria v={v} irA={irA}/></Card>
 </div>;
}

// ---------- Intensidad por SKU y canal
export function Intensidad({v,onReintentar}:{v:BrechasVista;onReintentar:()=>void}){
 const i=v.intensidad;
 if(i.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 const filas=i.status==='ok'?i.filas.filter(f=>f.significativa).sort((a,b)=>(b.intensidadPct??0)-(a.intensidadPct??0)).slice(0,7):[];
 if(!filas.length)return <Vacio>Aún no hay pares SKU-canal con suficiente ingreso y reembolsos en meses completos para medir intensidad.</Vacio>;
 const max=Math.max(1,...filas.map(f=>f.intensidadPct??0));
 return <div className="dg-fill"><ListaBarras c={2} vw max={max} label="Intensidad de reembolso por SKU y canal" items={filas.map(f=>{const med=i.medianaCanal?.[f.canal]??null,alta=med!==null&&med>0&&(f.intensidadPct??0)>=med*v.umbrales.multiplicadorMediana;
  return {key:f.sku+f.canal,etiqueta:f.sku,sub:`${NOMBRE[f.canal]??f.canal} · ${num(f.reembolsos)} reembolsos`,valor:f.intensidadPct??0,marca:med,c:alta?7:2,texto:pct(f.intensidadPct),sub2:alta?`${((f.intensidadPct??0)/(med??1)).toFixed(1)}× la mediana`:undefined};})}/>
  <p className="dg-nota">Intensidad, no tasa por cohorte: reembolsos sin cancelados entre ingreso bruto del mismo SKU, canal y mes. La raya es la mediana del canal ({Object.entries(i.medianaCanal??{}).map(([c,m])=>`${NOMBRE[c]??c} ${pct(m)}`).join(' · ')||'sin datos'}). Violeta = al menos {v.umbrales.multiplicadorMediana}× la mediana.</p></div>;
}

// ---------- Tabla «Cierra esta brecha»
type Borrador=ReturnType<typeof recomendacionDeBrecha>;
export function CierraBrecha({v,onReintentar,supuesto}:{v:BrechasVista;onReintentar:()=>void;supuesto:{id:string;texto:string}|null}){
 const r=v.recomendaciones;
 const [abierto,setAbierto]=useState<string|null>(null),[b,setB]=useState<Borrador|null>(null),[aviso,setAviso]=useState('');
 if(r.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 const rows=[...r.items].sort((a,b2)=>(b2.impacto.usdMinor?big(b2.impacto.usdMinor):0)-(a.impacto.usdMinor?big(a.impacto.usdMinor):0));
 const proceder=(x:Recomendacion)=>{
  const bd=recomendacionDeBrecha(x,{generadoEn:new Date().toISOString(),supuestos:supuesto?.id===x.id?[supuesto.texto]:[]});
  setB(bd);setAbierto(x.id);
  try{sessionStorage.setItem(CLAVE_BORRADOR,JSON.stringify(bd));}catch{/* sin almacenamiento: el texto sigue a la vista */}
  setAviso('Texto preparado. No se envió nada ni se creó ninguna recomendación todavía.');
 };
 const copiar=async()=>{if(!b)return;try{await navigator.clipboard.writeText(b.cuerpo);setAviso('Texto copiado.');}catch{setAviso('No se pudo copiar: selecciona el texto y cópialo a mano.');}};
 const cols:Column<Recomendacion>[]=[
  {key:'b',header:'Brecha',width:'34%',render:x=><span className="dg-lab" id={`rec-${x.id}`}><b>{x.titulo}</b><small>{x.accion}</small></span>},
  {key:'t',header:'Tipo',width:'120px',render:x=><Chip categoria={x.tipo==='empujar'?3:2}>{TIPO_REC[x.tipo]??x.tipo}</Chip>},
  {key:'p',header:'Por qué',render:x=><span className="dg-lab"><small style={{color:'var(--ink)'}}>{x.porque}</small></span>},
  {key:'i',header:'Ingreso en juego',width:'150px',align:'num',render:x=><span className="dg-val">{x.impacto.usdMinor?usd(x.impacto.usdMinor):'—'}<small><KindBadge kind={x.impacto.clase}/></small></span>},
  {key:'a',header:'Acción',width:'130px',render:x=><Button size="sm" variant="primary" aria-expanded={abierto===x.id} onClick={()=>proceder(x)}>Proceder</Button>},
 ];
 return <div className="dg-fill">
  {rows.length===0?<Vacio>Ninguna regla se cumple con los datos de hoy. Eso no significa que no haya oportunidades: las reglas piden ingreso suficiente, meses completos y cruce de reembolsos con ingreso.</Vacio>
   :<DataTable caption="Cierra esta brecha: recomendaciones con evidencia" columns={cols} rows={rows} rowKey={x=>x.id} maxHeight="none"/>}
  {b&&abierto&&<div className="dg-caja" style={{marginTop:12}} role="region" aria-label="Texto preparado">
   <h3>Texto preparado: {rows.find(x=>x.id===abierto)?.titulo}</h3><pre style={{whiteSpace:'pre-wrap',font:'13px/1.5 var(--font-ui)',margin:'0 0 8px'}}>{b.cuerpo}</pre>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Button size="sm" icon={<Icon name="copy" size={14}/>} onClick={copiar}>Copiar texto</Button><LinkButton size="sm" href="/recommendations" icon={<Arrow/>}>Ir a Recomendaciones</LinkButton></div>
   <p className="dg-nota" role="status" aria-live="polite">{aviso}</p></div>}
 </div>;
}

// ---------- Ventas vs quejas por familia
export function Familias({v,onReintentar}:{v:BrechasVista;onReintentar:()=>void}){
 const f=v.familias;
 if(f.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(f.status==='pendiente')return <div className="dg-fill"><Vacio>El análisis del histórico aún no termina: la IA lee cada conversación y anota el producto. Todavía no hay cifras (no es cero).</Vacio><Avance f={f}/></div>;
 const filas=f.filas,maxIng=Math.max(1,...filas.map(x=>big(x.ingresoMinor))),tasas=filas.map(x=>x.por100).filter((x):x is number=>x!==null).sort((a,b)=>a-b);
 const med=tasas.length?tasas[tasas.length>>1]:null,maxT=Math.max(1,...tasas);
 return <div className="dg-fill">
  {f.status==='parcial'&&<Avance f={f}/>}
  <div className="dg-dos" style={{alignItems:'start'}}>
   <div><p className="dg-col-t"><span className="dg-titular" style={{fontSize:13}}>Ingreso bruto (USD)</span></p>
    <ListaBarras c={1} max={maxIng} label="Ingreso por familia" items={filas.map(x=>({key:x.familia,etiqueta:x.etiqueta,sub:`${num(x.skus)} SKUs · #${x.posIngreso}`,valor:big(x.ingresoMinor),texto:corto(big(x.ingresoMinor))}))}/></div>
   <div><p className="dg-col-t"><span className="dg-titular" style={{fontSize:13}}>Conversaciones por cada 100 líneas</span></p>
    <ListaBarras c={7} max={maxT} label="Quejas por cada 100 líneas vendidas" items={filas.map(x=>({key:x.familia,etiqueta:x.etiqueta,sub:`${num(x.conversaciones)} conversaciones · #${x.posQuejas}`,valor:x.por100??0,marca:med,estado:x.por100===null?'parcial':undefined,texto:x.por100===null?'poca base':String(x.por100)}))}/></div>
  </div>
  <p className="dg-nota">«Quejas» = conversaciones de soporte que mencionan la familia (no todas son quejas). Familia = prefijo del SKU; la raya es la mediana. No es una tasa por cliente ni prueba causa.</p>
 </div>;
}
export function PanelFamilias({v}:{v:BrechasVista}){
 const f=v.familias;
 if(f.status==='unavailable'||f.status==='pendiente')return <div className="dg-fill"><Vacio>Disponible cuando termine el análisis del histórico.</Vacio></div>;
 return <div className="dg-fill">
  {f.cobertura&&<ListaBarras c={7} max={100} label="Cobertura del análisis" items={[
   {key:'a',etiqueta:'Conversaciones con familia',sub:`de ${num(f.cobertura.analizadas)} analizadas`,valor:f.cobertura.conFamiliaPct,texto:pct(f.cobertura.conFamiliaPct)},
   {key:'b',etiqueta:'Ingreso en familias con mapa',sub:'cruzable con quejas',valor:f.cobertura.ingresoConMapaPct,texto:pct(f.cobertura.ingresoConMapaPct)}]}/>}
  {f.categorias.length>0&&<><p className="dg-col-t" style={{marginTop:12}}><span className="dg-titular" style={{fontSize:13}}>Categorías mencionadas (sin cruce con ventas)</span></p>
   <ListaBarras c={7} max={Math.max(1,...f.categorias.map(c=>c.conversaciones))} label="Categorías mencionadas" items={f.categorias.slice(0,8).map(c=>({key:c.familia,etiqueta:c.etiqueta,valor:c.conversaciones,texto:num(c.conversaciones)}))}/></>}
 </div>;
}
