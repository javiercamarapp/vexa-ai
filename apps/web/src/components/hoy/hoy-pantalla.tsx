'use client';
import {useT,useIdioma} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {RovaqCargando} from '../rovaq-cargando';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from '../workspace/navigation-lifecycle';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {useJson} from '../ui/use-json';
import {Button,LinkButton,Arrow} from '../ui/button';
import {PaqueteReclamo} from './paquete-reclamo';
import {RespuestaEnLinea} from './respuesta-en-linea';
import {PageHeader} from '../ui/page-header';
import {endpointFuga} from '../refunds/use-fuga';
import {Sparkline} from '../ui/sparkline';
import {DeltaChip} from '../ui/stat-card';
import {BarraApilada} from '../ui/mini-charts';
import {SelloProcedencia} from '../confianza/sello-procedencia';
import {ComoSeCalculoProvider,ComoSeCalculoBoton} from '../confianza/como-se-calculo';
import {armarHoy,comoSeCalculo,estadoDe,type KpiHoy} from './hoy-modelo.mjs';
import '../confianza/confianza.css';

type Carga={generatedAt:string;sla:{status:string;[k:string]:unknown};carga:{status:string;[k:string]:unknown}};
type Cfo={status:'ok';report:CfoReport}|{status:'empty'|'timeout'};
const acceptFuga=(j:unknown)=>{const d=(j as {data?:FugaVista})?.data;return d&&typeof d==='object'&&'titular' in d?d:null;};
const acceptCarga=(j:unknown)=>{const d=(j as {data?:Carga})?.data;return d&&typeof d==='object'&&'sla' in d?d:null;};
const acceptCfo=(j:unknown)=>{const d=(j as {data?:Cfo})?.data;return d&&typeof d.status==='string'?d:null;};

const COLOR:Record<string,number>={ingreso:1,reembolsos:2,atorado:4,respuestas24:5};
const KPI_ETIQUETA:Record<string,Clave>={ingreso:'hoy.kpi.ingreso',reembolsos:'hoy.kpi.reembolsos',atorado:'hoy.kpi.atorado',respuestas24:'hoy.kpi.respuestas24'};
const ETIQ:Record<string,Clave>={vencido:'hoy.vencidos',no_reembolsable:'hoy.noReembolsables',rechazado:'hoy.rechazados'};
function Kpi({k,ctx,onRetry}:{k:KpiHoy;ctx:unknown;onRetry:()=>void}){
 const t=useT(),vacio=k.estado!=='ok',nombre=(KPI_ETIQUETA[k.id]?t(KPI_ETIQUETA[k.id]):k.etiqueta),et=(id:string)=>ETIQ[id]?t(ETIQ[id]):id;
 return <li className="hoy-kpi" data-kpi={k.id} aria-busy={k.estado==='cargando'||undefined}>
  <div className="hoy-kpi-top"><span className="hoy-kpi-label">{nombre}</span>{k.estado==='ok'&&k.serie&&k.serie.length>1&&<span className="hoy-kpi-spark"><Sparkline data={k.serie} w={60} h={22} color={COLOR[k.id]} label={(k.serieEtiqueta??t('hoy.tendencia'))+': '+k.serie.join(', ')}/></span>}{k.estado==='ok'&&<ComoSeCalculoBoton entrada={comoSeCalculo(k.como,ctx)}/>}</div>
  {k.estado==='cargando'?<><span className="hoy-skel" data-grande role="status" aria-label={t('hoy.cargando',{kpi:nombre})}/><span className="hoy-skel" style={{width:'80%'}}/></>
   :vacio?<><div className="hoy-kpi-valor" data-vacio>—</div>
    <p className="hoy-kpi-nota" data-una-linea title={k.nota??undefined}>{k.nota??(k.estado==='sin_acceso'?t('hoy.sinAcceso'):t('hoy.noDisponible'))}</p>
    {k.estado!=='sin_acceso'&&<button type="button" className="btn btn-ghost btn-sm hoy-reintentar" onClick={onRetry}>{t('hoy.reintentar')}</button>}</>
   :<><div className="hoy-kpi-valor">{k.valor}</div>
    {k.estados&&k.estados.length>0&&<BarraApilada h={8} base={3} sinLeyenda label={t('hoy.casosPorEstado')+': '+k.estados.map(e=>et(e.id)+' '+e.valor).join(', ')} items={k.estados.map(e=>({label:et(e.id),value:e.valor}))}/>}
    <p className="hoy-kpi-nota" title={k.notaLarga??k.nota??undefined}>{k.variacion&&<DeltaChip delta={{value:k.variacion.texto,dir:k.variacion.dir,good:k.variacion.bueno}} label={k.delta??undefined}/>}{k.variacion?' ':''}{k.nota}</p>
    
    {k.sello&&<SelloProcedencia sello={k.sello} compacto/>}</>}
 </li>;
}

/** «Hoy»: lo que pasa con el dinero y qué hacer ahora. Cada bloque falla por separado; nada se rellena con ceros. */
export function HoyPantalla(){
 const sp=useSearchParams(),t=useT(),idioma=useIdioma();
 const fuga=useJson<FugaVista>(endpointFuga(sp?.toString()),acceptFuga),carga=useJson<Carga>('/api/workload',acceptCarga),cfo=useJson<Cfo>('/cfo/data/report',acceptCfo);
 const estado={fuga:estadoDe(fuga.data,fuga),carga:estadoDe(carga.data,carga),cfo:estadoDe(cfo.data?.status==='ok'?cfo.data:null,{...cfo,busy:cfo.busy&&!cfo.data})};
 const v=useMemo(()=>armarHoy({fuga:fuga.data,carga:carga.data,cfo:cfo.data,estado,idioma}),[fuga.data,carga.data,cfo.data,estado.fuga,estado.carga,estado.cfo,idioma]);// eslint-disable-line react-hooks/exhaustive-deps
 const [verPaquete,setVerPaquete]=useState(false),[pregunta,setPregunta]=useState<string|null>(null),respRef=useRef<HTMLDivElement>(null);
 const preguntar=(q:string)=>{setPregunta(q);setTimeout(()=>respRef.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'}),60);};
 const recargar=()=>{fuga.reload();carga.reload();cfo.reload();window.dispatchEvent(new Event('vexa:refresh'));};
 // Un KPI que no cargó se reintenta solo en segundo plano (máx. 3 veces, cada 20 s): sin botones, sin recargar la pantalla.
 const intentos=useRef(0),hayFallo=v.kpis.some(k=>k.estado==='no_disponible');
 useEffect(()=>{if(!hayFallo||intentos.current>=3)return;const id=window.setTimeout(()=>{intentos.current++;fuga.reload();carga.reload();cfo.reload();},20000);return()=>window.clearTimeout(id);},[hayFallo,fuga.status,carga.status,cfo.status]);// eslint-disable-line react-hooks/exhaustive-deps
 // El logo solo cubre la PRIMERA carga: un reintento en segundo plano no debe volver a tapar la pantalla ya pintada.
 const [yaListo,setYaListo]=useState(false);if(!v.cargando&&!yaListo)setYaListo(true);
 if(v.cargando&&!yaListo)return <RovaqCargando mensaje=""/>;
 return <ComoSeCalculoProvider><section className="hoy" aria-label={t('hoy.titulo')}>
  <div className="hoy-titular"><PageHeader eyebrow={t('hoy.eyebrow')} title={t('hoy.titulo')}
   description={<span className="hoy-resumen" title={v.titular.texto}>{v.titular.partes.map((x,i)=>x.f?<strong key={i}>{x.t}</strong>:<span key={i}>{x.t}</span>)}</span>}
   actions={<>{v.titular.periodo&&<span className="hoy-periodo" title={t('hoy.periodo')}>{v.titular.periodo}</span>}<LinkButton href="/briefs" icon={<Arrow/>} size="sm">{t('hoy.exportar')}</LinkButton></>}/></div>
  {v.vacio&&<div className="hoy-estado" role="status"><strong>{t('hoy.sinDatosTitulo')}</strong>{t('hoy.sinDatosA')} <Link href="/confianza">{t('hoy.sinDatosLink1')}</Link> {t('hoy.sinDatosO')} <Link href="/imports">{t('hoy.sinDatosLink2')}</Link>.</div>}
  <ul className="hoy-kpis" aria-label={t('hoy.cuatroCifras')}>{v.kpis.map(k=><Kpi key={k.id} k={k} ctx={v.ctxComo} onRetry={recargar}/>)}</ul>
  <div className="hoy-cols">
   <section className="hoy-card" aria-labelledby="hoy-at"><h2 id="hoy-at">{t('hoy.atencion')} <span>({v.atencion.length})</span></h2>
    {v.cargando?<span className="hoy-skel" role="status" aria-label={t('comun.cargando')}/>:v.atencion.length===0?<p className="dc-vacio">{t('hoy.nadaUrgente')}</p>
     :<ul className="hoy-lista">{v.atencion.map(a=><li key={a.id}><Link className="hoy-fila" href={a.href} data-dinero={a.dinero?'':undefined}><span className="hoy-punto" aria-hidden="true"/><span><p className="hoy-fila-t">{a.titulo}</p><p className="hoy-fila-d">{a.detalle}</p></span>{a.dinero&&<span className="hoy-fila-m">{a.dinero}</span>}</Link></li>)}</ul>}
   </section>
   {v.barra&&<section className="hoy-card" aria-labelledby="hoy-bar"><div className="hoy-kpi-top"><h2 id="hoy-bar">{t('hoy.observadoVsRec')}</h2><ComoSeCalculoBoton entrada={comoSeCalculo('recuperable',v.ctxComo)}/></div>
     <div className="hoy-barra"><div className="hoy-barra-pista" role="img" aria-label={v.barra.observadoEtiqueta+' '+v.barra.observado+'. '+t('hoy.recSinCifra')}><span className="hoy-barra-obs"/><span className="hoy-barra-rec"/></div>
      <div className="hoy-barra-leyenda"><span>{v.barra.observadoEtiqueta} <strong>{v.barra.observado}</strong></span><span>{v.barra.recuperableEtiqueta} [E] <strong>{t('hoy.sinSupuestos')}</strong></span></div></div>
     <p className="dc-linea">{v.barra.recuperableNota} <Link href={v.barra.href}>{t('hoy.teclear')}</Link></p></section>}
   {v.siguiente&&<section className="hoy-card hoy-sig" aria-labelledby="hoy-sig"><h2 id="hoy-sig">{t('hoy.siguiente')}</h2><p className="hoy-sig-t">{v.siguiente.titulo}</p><p>{v.siguiente.detalle}</p>
     <div className="hoy-acciones">{v.siguiente.accion==='paquete'&&fuga.data?<Button variant="primary" size="sm" icon={<Arrow/>} onClick={()=>setVerPaquete(true)}>{v.siguiente.cta}</Button>:<LinkButton href={v.siguiente.href} variant="primary" size="sm" icon={<Arrow/>}>{v.siguiente.cta}</LinkButton>}{v.siguiente.secundaria.pregunta?<Button size="sm" onClick={()=>preguntar(v.siguiente!.secundaria.pregunta!)}>{v.siguiente.secundaria.texto}</Button>:<LinkButton href={v.siguiente.secundaria.href} size="sm">{v.siguiente.secundaria.texto}</LinkButton>}</div></section>}
  </div>
 <div ref={respRef} className="hoy-resp-wrap">{pregunta&&<RespuestaEnLinea key={pregunta} pregunta={pregunta} onCerrar={()=>setPregunta(null)}/>}</div>{v.siguiente?.accion==='paquete'&&<PaqueteReclamo open={verPaquete} onClose={()=>setVerPaquete(false)} fuga={fuga.data} sku={v.siguiente.sku??""}/>}</section></ComoSeCalculoProvider>;
}
