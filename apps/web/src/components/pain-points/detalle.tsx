'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PainVista,PuntoPP} from '../../../../../packages/workspace-service/pain-points.d.mts';
import type {EvidenciaVista,FilaEvidencia} from '../../../../../packages/workspace-service/pain-points-evidencia.d.mts';
import {useT} from '../i18n/proveedor';
import type {Clave,Traductor} from '../../lib/i18n';
import {Drawer,OverlaySection} from '../ui/overlay';
import {Button,Download,LinkButton} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Notice} from '../ui/notice';
import {ErrorState} from '../ui/error-state';
import {RovaqCargando} from '../rovaq-cargando';
import {useJson} from '../ui/use-json';
import {LecturaIA} from './lectura-ia';
import {CLASE_KIND,CLASE_NOMBRE,SIN_DATO,dineroTxt,num,periodoTxt,usd,volumenTxt} from './modelo.mjs';

const acepta=(j:unknown)=>{const d=(j as {data?:EvidenciaVista})?.data;return d&&typeof d==='object'&&'estado' in d&&Array.isArray(d.filas)?d:null;};
const importe=(tx:Traductor,f:FilaEvidencia)=>f.importeMinor==null?tx('tr.pp.sinMonto'):usd(f.importeMinor);
const CLASE_CLAVE:Record<string,Clave>={O:'tr.pp.claseO',E:'tr.pp.claseE',I:'tr.pp.claseI'};
const claseTxt=(tx:Traductor,c:string)=>CLASE_CLAVE[c]?tx(CLASE_CLAVE[c]):(CLASE_NOMBRE as Record<string,string>)[c]??c;
const fechaTxt=(f:string|null)=>f??'—';
/** Filas de evidencia: 32 px, sin PII, con total verificable y «cargar más» por cursor. */
function Evidencia({punto}:{punto:PuntoPP}){
 const tx=useT();
 const base='/api/pain-points/'+encodeURIComponent(punto.id)+'/evidence';
 const e=useJson<EvidenciaVista>(punto.evidencia.disponible?base:null,acepta);
 const [extra,setExtra]=useState<FilaEvidencia[]>([]),[next,setNext]=useState<string|null|undefined>(undefined),[cargando,setCargando]=useState(false),[fallo,setFallo]=useState(false);
 const ctl=useRef<AbortController|null>(null);
 const generacion=punto.id+'|'+(e.data?.generatedAt??'');
 const [anterior,setAnterior]=useState(generacion);
 if(anterior!==generacion){setAnterior(generacion);setExtra([]);setNext(undefined);setFallo(false);setCargando(false);}
 useEffect(()=>()=>ctl.current?.abort(),[generacion]);
 const sig=next===undefined?e.data?.nextCursor??null:next;
 const mas=useCallback(async()=>{
  if(!sig)return;ctl.current?.abort();const c=new AbortController();ctl.current=c;setCargando(true);setFallo(false);
  try{const r=await fetch(base+'?cursor='+encodeURIComponent(sig),{cache:'no-store',signal:c.signal});if(!r.ok)throw Error();const d=acepta(await r.json());if(!d)throw Error();if(c.signal.aborted)return;setExtra(x=>[...x,...d.filas]);setNext(d.nextCursor);}
  catch{if(!c.signal.aborted)setFallo(true);}finally{if(!c.signal.aborted)setCargando(false);}
 },[base,sig]);
 if(!punto.evidencia.disponible)return <Notice tone="info">{punto.evidencia.motivo??tx('tr.pp.sinFilasMostrar')}</Notice>;
 if(!e.data&&e.busy)return <RovaqCargando compacto mensaje=""/>;
 if(!e.data)return <ErrorState compact title={tx('vista.noDisponible')} body={tx('tr.pp.noSigFilas')} onRetry={()=>e.reload()}/>;
 const d=e.data;
 if(d.estado==='unavailable')return <ErrorState compact title={tx('vista.noDisponible')} body={d.motivo} onRetry={()=>e.reload()}/>;
 if(d.estado!=='ok'&&d.estado!=='empty')return <Notice tone="info">{d.motivo??tx('tr.pp.sinFilas')}</Notice>;
 const filas=[...d.filas,...extra],v=d.verificacion,t=d.total;
 return <div className="pp-ev">
  {t&&<p className="pp-ev-total" data-ok={v.marca==='✓'||undefined} data-mal={v.marca==='✗'||undefined}>
   <b>{tx('tr.pp.filasN',{n:num(t.n)})}</b>{t.sinMonto>0?tx('tr.pp.sinMontoCuentan',{n:num(t.sinMonto)}):''}{tx('tr.pp.sumaUsd',{usd:usd(t.minor)})}
   <span className="pp-marca" title={v.marca==='✓'?tx('tr.pp.marcaOkTit'):v.marca==='✗'?tx('tr.pp.marcaMalTit'):tx('tr.pp.marcaNingTit')}>{v.marca==='✓'?tx('tr.pp.marcaOk'):v.marca==='✗'?tx('tr.pp.marcaMal',{usd:usd(v.diferenciaMinor ?? '0')}):tx('tr.pp.marcaNing')}</span></p>}
  {d.nota&&<p className="pp-nota">{d.nota}</p>}
  <div className="pp-tabla-wrap" tabIndex={0} role="region" aria-label={tx('tr.pp.filasSustentan')}>
   <table className="pp-tabla pp-tabla-ev"><caption className="sr-only">{tx('tr.pp.capEvidencia',{nombre:punto.nombre,n:filas.length,total:t?num(t.n):'?'})}</caption>
    <thead><tr><th scope="col">{tx('tr.pp.thFecha')}</th><th scope="col">{tx('fuga.thCanal')}</th><th scope="col">{tx('fuga.thSku')}</th><th scope="col">{tx('tr.pp.thEstado')}</th><th scope="col" data-num>{tx('tr.pp.thImporte')}</th><th scope="col">{tx('tr.pp.thRef')}</th></tr></thead>
    <tbody>{filas.map((f,i)=><tr key={i}><td>{fechaTxt(f.fecha)}</td><td>{f.canal??'—'}</td><td className="pp-mono">{f.sku??'—'}</td><td title={f.motivo??undefined}>{f.estado}</td><td data-num>{importe(tx,f)}</td><td className="pp-mono">{f.ref}</td></tr>)}</tbody></table></div>
  <div className="pp-ev-pie"><span>{t?tx('tr.pp.filasPieDe',{n:num(filas.length),total:num(t.n)}):tx('tr.pp.filasPie',{n:num(filas.length)})}</span>{sig&&<Button size="sm" loading={cargando} onClick={mas}>{tx('tr.pp.verMasFilas')}</Button>}{fallo&&<span className="pp-nota">{tx('tr.pp.noCargoPagina')}</span>}</div>
  {d.cruce.length>0&&<div className="pp-cruce"><h4>{tx('tr.pp.mismoSku')}</h4><p className="pp-nota">{tx('tr.pp.unidoSkuMes')}</p>
   <table className="pp-tabla"><caption className="sr-only">{tx('tr.pp.capCruce')}</caption><thead><tr><th scope="col">{tx('fuga.thSku')}</th><th scope="col">{tx('tr.pp.thMes')}</th><th scope="col" data-num>{tx('tr.pp.thLibro')}</th><th scope="col" data-num>{tx('tr.pp.thTracker')}</th></tr></thead>
    <tbody>{d.cruce.slice(0,8).map((c,i)=><tr key={i}><td className="pp-mono">{c.sku}</td><td>{c.mes}</td><td data-num>{num(c.libro.n)} · {usd(c.libro.minor)}</td><td data-num>{num(c.tracker.n)}{c.tracker.negados?tx('tr.pp.negadasN',{n:c.tracker.negados}):''}</td></tr>)}</tbody></table></div>}
 </div>;
}
export function Detalle({punto,vista,onCerrar}:{punto:PuntoPP|null;vista:PainVista;onCerrar:()=>void}){
 const tx=useT();
 const tema=punto?vista.temas.find(t=>t.id===punto.tema):null,pct=punto&&!punto.dinero.sinDato&&punto.padre?vista.puntos.find(p=>p.id===punto.padre):null;
 const parteDe=pct&&!pct.dinero.sinDato&&punto&&!punto.dinero.sinDato?Math.round(Number(BigInt(punto.dinero.minor)*1000n/BigInt(pct.dinero.minor)))/10:null;
 return <Drawer open={Boolean(punto)} onClose={onCerrar} size="md" title={punto?.nombre??tx('tr.pp.puntoDolor')} subtitle={punto&&tema?<>{tema.nombre} · <KindBadge kind={CLASE_KIND[punto.clase]}/></>:undefined}
  footer={punto?.evidencia.disponible?<><Button onClick={onCerrar}>{tx('comun.cerrar')}</Button><LinkButton variant="primary" icon={<Download/>} href={'/api/pain-points/'+encodeURIComponent(punto.id)+'/evidence?format=csv'} download="">{tx('ag.csvAria')}</LinkButton></>:<Button onClick={onCerrar}>{tx('comun.cerrar')}</Button>}>
  {punto&&<div className="pp-detalle">
   <div className="ov-kpis" role="group" aria-label={tx('tr.pp.cifrasAria')}>
    <div className="ov-kpi"><span className="ov-kpi-label">{tx('tr.pp.dineroBruto')}</span><strong className="pp-cifra" data-sin={punto.dinero.sinDato||undefined}>{dineroTxt(punto.dinero)}</strong></div>
    <div className="ov-kpi"><span className="ov-kpi-label">{tx('pp.volumen')}</span><strong className="pp-cifra" data-sin={punto.volumen.sinDato||undefined}>{punto.volumen.sinDato?SIN_DATO:num(punto.volumen.n)}</strong><small>{punto.volumen.sinDato?'':punto.volumen.unidad}</small></div>
    {parteDe!==null&&pct?<div className="ov-kpi"><span className="ov-kpi-label">{tx('tr.pp.parteDe',{id:pct.id})}</span><strong className="pp-cifra">{parteDe} %</strong></div>:<div className="ov-kpi"><span className="ov-kpi-label">{tx('tr.pp.clase')}</span><strong className="pp-cifra pp-cifra-txt">{claseTxt(tx,punto.clase)}</strong></div>}
   </div>
   {punto.dinero.sinDato&&<Notice tone="warn" title={tx('tr.pp.sinDatoNoCero')}>{punto.dinero.motivo}</Notice>}
   {punto.proxy&&<Notice tone="info" title={tx('tr.pp.proxyTitulo')}>{punto.proxy.rotulo}</Notice>}
   {punto.proxies&&<Notice tone="info" title={tx('tr.pp.cercanoHoy')}>{tx('tr.pp.proxiesTexto',{nombres:punto.proxies.map(i=>vista.puntos.find(p=>p.id===i)?.nombre).filter(Boolean).join(' '+tx('tr.pp.y')+' ')})}</Notice>}
   <OverlaySection title={tx('tr.pp.queMide')}><p className="pp-p">{punto.descripcion}</p>
    <dl className="pp-kv"><div><dt>{tx('tr.pp.fuente')}</dt><dd>{punto.fuente.etiqueta}</dd></div><div><dt>{tx('brechas.periodo')}</dt><dd>{periodoTxt(punto.periodo)}</dd></div><div><dt>{tx('tr.pp.cobertura')}</dt><dd>{punto.cobertura?.texto??tx('tr.pp.sinCobertura')}</dd></div><div><dt>{tx('pp.volumen')}</dt><dd>{volumenTxt(punto.volumen)}</dd></div>
     {punto.otrasMonedas.length>0&&<div><dt>{tx('tr.pp.otrasMonedas')}</dt><dd>{punto.otrasMonedas.map(m=>`${num(m.n)} · ${(Number(BigInt(m.minor))/100).toLocaleString('es-MX')} ${m.currency}`).join(' · ')}{tx('tr.pp.noSeSuman')}</dd></div>}</dl></OverlaySection>
   <OverlaySection title={tx('tr.pp.evidenciaT')} description={tx('tr.pp.evidenciaD')}><Evidencia key={punto.id} punto={punto}/></OverlaySection>
   <OverlaySection title={tx('tr.pp.lecturaIA')} description={tx('tr.pp.lecturaIAD')}><LecturaIA key={punto.id} puntoId={punto.id}/></OverlaySection>
   <OverlaySection title={tx('fuga.cComo')}><ul className="pp-lista">{punto.calculo.map((t,i)=><li key={i}>{t}</li>)}</ul></OverlaySection>
   <OverlaySection title={tx('tr.pp.queNoSabemos')}><ul className="pp-lista">{punto.noSabemos.map((t,i)=><li key={i}>{t}</li>)}{punto.solapaCon.length>0&&<li>{tx('tr.pp.comparteDinero',{lista:punto.solapaCon.join(', ')})}</li>}</ul></OverlaySection>
  </div>}
 </Drawer>;
}
