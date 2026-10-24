'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PainVista,PuntoPP} from '../../../../../packages/workspace-service/pain-points.d.mts';
import type {EvidenciaVista,FilaEvidencia} from '../../../../../packages/workspace-service/pain-points-evidencia.d.mts';
import {Drawer,OverlaySection} from '../ui/overlay';
import {Button,Download,LinkButton} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Notice} from '../ui/notice';
import {ErrorState} from '../ui/error-state';
import {RovaqCargando} from '../rovaq-cargando';
import {useJson} from '../ui/use-json';
import {CLASE_KIND,CLASE_NOMBRE,SIN_DATO,dineroTxt,num,periodoTxt,usd,volumenTxt} from './modelo.mjs';

const acepta=(j:unknown)=>{const d=(j as {data?:EvidenciaVista})?.data;return d&&typeof d==='object'&&'estado' in d&&Array.isArray(d.filas)?d:null;};
const importe=(f:FilaEvidencia)=>f.importeMinor==null?'Sin monto':usd(f.importeMinor);
const fechaTxt=(f:string|null)=>f??'—';
/** Filas de evidencia: 32 px, sin PII, con total verificable y «cargar más» por cursor. */
function Evidencia({punto}:{punto:PuntoPP}){
 const base='/api/pain-points/'+encodeURIComponent(punto.id)+'/evidence';
 const e=useJson<EvidenciaVista>(punto.evidencia.disponible?base:null,acepta);
 const [extra,setExtra]=useState<FilaEvidencia[]>([]),[next,setNext]=useState<string|null|undefined>(undefined),[cargando,setCargando]=useState(false),[fallo,setFallo]=useState(false);
 const ctl=useRef<AbortController|null>(null);
 useEffect(()=>{setExtra([]);setNext(undefined);setFallo(false);},[punto.id,e.data?.generatedAt]);
 useEffect(()=>()=>ctl.current?.abort(),[]);
 const sig=next===undefined?e.data?.nextCursor??null:next;
 const mas=useCallback(async()=>{
  if(!sig)return;ctl.current?.abort();const c=new AbortController();ctl.current=c;setCargando(true);setFallo(false);
  try{const r=await fetch(base+'?cursor='+encodeURIComponent(sig),{cache:'no-store',signal:c.signal});if(!r.ok)throw Error();const d=acepta(await r.json());if(!d)throw Error();setExtra(x=>[...x,...d.filas]);setNext(d.nextCursor);}
  catch{if(!c.signal.aborted)setFallo(true);}finally{if(!c.signal.aborted)setCargando(false);}
 },[base,sig]);
 if(!punto.evidencia.disponible)return <Notice tone="info">{punto.evidencia.motivo??'Este punto no tiene filas que mostrar.'}</Notice>;
 if(!e.data&&e.busy)return <RovaqCargando compacto mensaje=""/>;
 if(!e.data)return <ErrorState compact title="No disponible ahora" body="No significa que no haya filas: reintenta en un momento." onRetry={()=>e.reload()}/>;
 const d=e.data;
 if(d.estado==='unavailable')return <ErrorState compact title="No disponible ahora" body={d.motivo} onRetry={()=>e.reload()}/>;
 if(d.estado!=='ok'&&d.estado!=='empty')return <Notice tone="info">{d.motivo??'Sin filas.'}</Notice>;
 const filas=[...d.filas,...extra],v=d.verificacion,t=d.total;
 return <div className="pp-ev">
  {t&&<p className="pp-ev-total" data-ok={v.marca==='✓'||undefined} data-mal={v.marca==='✗'||undefined}>
   <b>{num(t.n)} filas</b>{t.sinMonto>0?` (${num(t.sinMonto)} sin monto: cuentan, no suman)`:''} · suma {usd(t.minor)}
   <span className="pp-marca" title={v.marca==='✓'?'La suma de las filas iguala la cifra del punto':v.marca==='✗'?'La suma difiere de la cifra del punto':'No se pudo comprobar ahora'}>{v.marca==='✓'?'✓ coincide con la cifra':v.marca==='✗'?`✗ difiere en ${usd(v.diferenciaMinor ?? '0')}`:'— sin comprobar'}</span></p>}
  {d.nota&&<p className="pp-nota">{d.nota}</p>}
  <div className="pp-tabla-wrap" tabIndex={0} role="region" aria-label="Filas que sustentan la cifra">
   <table className="pp-tabla pp-tabla-ev"><caption className="sr-only">Evidencia de {punto.nombre}: {filas.length} de {t?num(t.n):'?'} filas, sin datos personales</caption>
    <thead><tr><th scope="col">Fecha</th><th scope="col">Canal</th><th scope="col">SKU</th><th scope="col">Estado</th><th scope="col" data-num>Importe</th><th scope="col">Ref.</th></tr></thead>
    <tbody>{filas.map((f,i)=><tr key={i}><td>{fechaTxt(f.fecha)}</td><td>{f.canal??'—'}</td><td className="pp-mono">{f.sku??'—'}</td><td title={f.motivo??undefined}>{f.estado}</td><td data-num>{importe(f)}</td><td className="pp-mono">{f.ref}</td></tr>)}</tbody></table></div>
  <div className="pp-ev-pie"><span>{num(filas.length)}{t?` de ${num(t.n)}`:''} filas</span>{sig&&<Button size="sm" loading={cargando} onClick={mas}>Ver más filas</Button>}{fallo&&<span className="pp-nota">No se pudo cargar la página. Reintenta.</span>}</div>
  {d.cruce.length>0&&<div className="pp-cruce"><h4>Mismo SKU y mes en el otro origen</h4><p className="pp-nota">Unido por SKU y mes: no es la misma orden.</p>
   <table className="pp-tabla"><caption className="sr-only">Cruce del libro y el Tracker por SKU y mes</caption><thead><tr><th scope="col">SKU</th><th scope="col">Mes</th><th scope="col" data-num>Libro</th><th scope="col" data-num>Tracker</th></tr></thead>
    <tbody>{d.cruce.slice(0,8).map((c,i)=><tr key={i}><td className="pp-mono">{c.sku}</td><td>{c.mes}</td><td data-num>{num(c.libro.n)} · {usd(c.libro.minor)}</td><td data-num>{num(c.tracker.n)}{c.tracker.negados?` (${c.tracker.negados} negadas)`:''}</td></tr>)}</tbody></table></div>}
 </div>;
}
export function Detalle({punto,vista,onCerrar}:{punto:PuntoPP|null;vista:PainVista;onCerrar:()=>void}){
 const tema=punto?vista.temas.find(t=>t.id===punto.tema):null,pct=punto&&!punto.dinero.sinDato&&punto.padre?vista.puntos.find(p=>p.id===punto.padre):null;
 const parteDe=pct&&!pct.dinero.sinDato&&punto&&!punto.dinero.sinDato?Math.round(Number(BigInt(punto.dinero.minor)*1000n/BigInt(pct.dinero.minor)))/10:null;
 return <Drawer open={Boolean(punto)} onClose={onCerrar} size="md" title={punto?.nombre??'Punto de dolor'} subtitle={punto&&tema?<>{tema.nombre} · <KindBadge kind={CLASE_KIND[punto.clase]}/></>:undefined}
  footer={punto?.evidencia.disponible?<><Button onClick={onCerrar}>Cerrar</Button><LinkButton variant="primary" icon={<Download/>} href={'/api/pain-points/'+encodeURIComponent(punto.id)+'/evidence?format=csv'} download="">Descargar CSV</LinkButton></>:<Button onClick={onCerrar}>Cerrar</Button>}>
  {punto&&<div className="pp-detalle">
   <div className="ov-kpis" role="group" aria-label="Cifras del punto">
    <div className="ov-kpi"><span className="ov-kpi-label">Dinero (bruto)</span><strong className="pp-cifra" data-sin={punto.dinero.sinDato||undefined}>{dineroTxt(punto.dinero)}</strong></div>
    <div className="ov-kpi"><span className="ov-kpi-label">Volumen</span><strong className="pp-cifra" data-sin={punto.volumen.sinDato||undefined}>{punto.volumen.sinDato?SIN_DATO:num(punto.volumen.n)}</strong><small>{punto.volumen.sinDato?'':punto.volumen.unidad}</small></div>
    {parteDe!==null&&pct?<div className="ov-kpi"><span className="ov-kpi-label">Parte de {pct.id}</span><strong className="pp-cifra">{parteDe} %</strong></div>:<div className="ov-kpi"><span className="ov-kpi-label">Clase</span><strong className="pp-cifra pp-cifra-txt">{CLASE_NOMBRE[punto.clase]}</strong></div>}
   </div>
   {punto.dinero.sinDato&&<Notice tone="warn" title="Sin dato: no es cero">{punto.dinero.motivo}</Notice>}
   {punto.proxy&&<Notice tone="info" title="Proxy, no chargeback">{punto.proxy.rotulo}</Notice>}
   {punto.proxies&&<Notice tone="info" title="Lo más cercano que hay hoy">{punto.proxies.map(i=>vista.puntos.find(p=>p.id===i)?.nombre).filter(Boolean).join(' y ')} son proxies observados; no se llaman chargebacks.</Notice>}
   <OverlaySection title="Qué mide"><p className="pp-p">{punto.descripcion}</p>
    <dl className="ov-kv pp-kv"><div><dt>Fuente</dt><dd>{punto.fuente.etiqueta}</dd></div><div><dt>Periodo</dt><dd>{periodoTxt(punto.periodo)}</dd></div><div><dt>Cobertura</dt><dd>{punto.cobertura?.texto??'Sin cobertura'}</dd></div><div><dt>Volumen</dt><dd>{volumenTxt(punto.volumen)}</dd></div>
     {punto.otrasMonedas.length>0&&<div><dt>Otras monedas</dt><dd>{punto.otrasMonedas.map(m=>`${num(m.n)} · ${(Number(BigInt(m.minor))/100).toLocaleString('es-MX')} ${m.currency}`).join(' · ')} (no se suman)</dd></div>}</dl></OverlaySection>
   <OverlaySection title="Evidencia" description="Sin nombres, correos ni direcciones. La suma de la columna se compara con la cifra."><Evidencia key={punto.id} punto={punto}/></OverlaySection>
   <OverlaySection title="Cómo se calculó"><ul className="pp-lista">{punto.calculo.map((t,i)=><li key={i}>{t}</li>)}</ul></OverlaySection>
   <OverlaySection title="Qué no sabemos"><ul className="pp-lista">{punto.noSabemos.map((t,i)=><li key={i}>{t}</li>)}{punto.solapaCon.length>0&&<li>Comparte dinero con {punto.solapaCon.join(', ')}: no se suman entre sí.</li>}</ul></OverlaySection>
  </div>}
 </Drawer>;
}
