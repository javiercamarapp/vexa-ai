'use client';
import {useEffect,useMemo,useRef} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from '../workspace/navigation-lifecycle';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import type {CfoReport} from '../../../../../packages/cfo-copilot/src/index.mjs';
import {useJson} from '../ui/use-json';
import {LinkButton,Refresh,Arrow} from '../ui/button';
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
const ETIQ:Record<string,string>={vencido:'Vencidos',no_reembolsable:'No reembolsables',rechazado:'Rechazados'};
function Kpi({k,ctx,onRetry}:{k:KpiHoy;ctx:unknown;onRetry:()=>void}){
 const vacio=k.estado!=='ok';
 return <li className="hoy-kpi" data-kpi={k.id} aria-busy={k.estado==='cargando'||undefined}>
  <div className="hoy-kpi-top"><span className="hoy-kpi-label">{k.etiqueta}</span>{k.estado==='ok'&&k.serie&&k.serie.length>1&&<span className="hoy-kpi-spark"><Sparkline data={k.serie} w={60} h={22} color={COLOR[k.id]} label={(k.serieEtiqueta??'Tendencia')+': '+k.serie.join(', ')}/></span>}{k.estado==='ok'&&<ComoSeCalculoBoton entrada={comoSeCalculo(k.como,ctx)}/>}</div>
  {k.estado==='cargando'?<><span className="hoy-skel" data-grande role="status" aria-label={'Cargando '+k.etiqueta}/><span className="hoy-skel" style={{width:'80%'}}/></>
   :vacio?<><div className="hoy-kpi-valor" data-vacio>—</div>
    <p className="hoy-kpi-nota" data-una-linea title={k.nota??undefined}>{k.nota??(k.estado==='sin_acceso'?'Sin acceso':'No disponible ahora')}</p>
    {k.estado!=='sin_acceso'&&<button type="button" className="btn btn-ghost btn-sm hoy-reintentar" onClick={onRetry}>Reintentar</button>}</>
   :<><div className="hoy-kpi-valor">{k.valor}</div>
    {k.estados&&k.estados.length>0&&<BarraApilada h={8} base={3} sinLeyenda label={'Casos por estado: '+k.estados.map(e=>(ETIQ[e.id]??e.id)+' '+e.valor).join(', ')} items={k.estados.map(e=>({label:ETIQ[e.id]??e.id,value:e.valor}))}/>}
    <p className="hoy-kpi-nota" title={k.notaLarga??k.nota??undefined}>{k.variacion&&<DeltaChip delta={{value:k.variacion.texto,dir:k.variacion.dir,good:k.variacion.bueno}} label={k.delta??undefined}/>}{k.variacion?' ':''}{k.nota}</p>
    
    {k.sello&&<SelloProcedencia sello={k.sello} compacto/>}</>}
 </li>;
}

/** «Hoy»: lo que pasa con el dinero y qué hacer ahora. Cada bloque falla por separado; nada se rellena con ceros. */
export function HoyPantalla(){
 const sp=useSearchParams();
 const fuga=useJson<FugaVista>(endpointFuga(sp?.toString()),acceptFuga),carga=useJson<Carga>('/api/workload',acceptCarga),cfo=useJson<Cfo>('/cfo/data/report',acceptCfo);
 const estado={fuga:estadoDe(fuga.data,fuga),carga:estadoDe(carga.data,carga),cfo:estadoDe(cfo.data?.status==='ok'?cfo.data:null,{...cfo,busy:cfo.busy&&!cfo.data})};
 const v=useMemo(()=>armarHoy({fuga:fuga.data,carga:carga.data,cfo:cfo.data,estado}),[fuga.data,carga.data,cfo.data,estado.fuga,estado.carga,estado.cfo]);// eslint-disable-line react-hooks/exhaustive-deps
 const ocupado=fuga.busy||carga.busy||cfo.busy;
 const recargar=()=>{fuga.reload();carga.reload();cfo.reload();window.dispatchEvent(new Event('vexa:refresh'));};
 // Un KPI que no cargó se reintenta solo en segundo plano (máx. 3 veces, cada 20 s): sin botones, sin recargar la pantalla.
 const intentos=useRef(0),hayFallo=v.kpis.some(k=>k.estado==='no_disponible');
 useEffect(()=>{if(!hayFallo||intentos.current>=3)return;const id=window.setTimeout(()=>{intentos.current++;fuga.reload();carga.reload();cfo.reload();},20000);return()=>window.clearTimeout(id);},[hayFallo,fuga.status,carga.status,cfo.status]);// eslint-disable-line react-hooks/exhaustive-deps
 return <ComoSeCalculoProvider><section className="hoy" aria-label="Hoy">
  <header className="hoy-titular">
   {v.cargando?<><span className="hoy-skel" data-grande role="status" aria-label="Cargando el titular" style={{width:'70%',height:36}}/><span className="hoy-skel" style={{width:'40%'}}/></>
    :<h1 title={v.titular.periodo?'Periodo: '+v.titular.periodo:undefined}>{v.titular.texto}</h1>}
   <div className="hoy-acciones"><LinkButton href="/briefs" icon={<Arrow/>} size="sm">Exportar informe</LinkButton><button type="button" className="btn btn-secondary btn-sm icon-only" aria-label="Actualizar" title="Actualizar" aria-busy={ocupado||undefined} disabled={ocupado} onClick={recargar}><Refresh/></button></div>
  </header>
  {v.vacio&&<div className="hoy-estado" role="status"><strong>Aún no hay datos para mostrar</strong>Ninguna fuente respondió con cifras. Eso no significa que todo esté en cero: revisa <Link href="/confianza">Datos y confianza</Link> o <Link href="/imports">carga un archivo</Link>.</div>}
  <ul className="hoy-kpis" aria-label="Cuatro cifras clave">{v.kpis.map(k=><Kpi key={k.id} k={k} ctx={v.ctxComo} onRetry={recargar}/>)}</ul>
  <div className="hoy-cols">
   <section className="hoy-card" aria-labelledby="hoy-at"><h2 id="hoy-at">Requiere tu atención <span>({v.atencion.length})</span></h2>
    {v.cargando?<span className="hoy-skel" role="status" aria-label="Cargando"/>:v.atencion.length===0?<p className="dc-vacio">Nada urgente con los datos disponibles. Si falta una fuente, aparece en Datos y confianza.</p>
     :<ul className="hoy-lista">{v.atencion.map(a=><li key={a.id}><Link className="hoy-fila" href={a.href} data-dinero={a.dinero?'':undefined}><span className="hoy-punto" aria-hidden="true"/><span><p className="hoy-fila-t">{a.titulo}</p><p className="hoy-fila-d">{a.detalle}</p></span>{a.dinero&&<span className="hoy-fila-m">{a.dinero}</span>}</Link></li>)}</ul>}
   </section>
   {v.barra&&<section className="hoy-card" aria-labelledby="hoy-bar"><div className="hoy-kpi-top"><h2 id="hoy-bar">Observado vs recuperable</h2><ComoSeCalculoBoton entrada={comoSeCalculo('recuperable',v.ctxComo)}/></div>
     <div className="hoy-barra"><div className="hoy-barra-pista" role="img" aria-label={v.barra.observadoEtiqueta+' '+v.barra.observado+'. Recuperable estimado: sin cifra hasta que teclees tus supuestos.'}><span className="hoy-barra-obs"/><span className="hoy-barra-rec"/></div>
      <div className="hoy-barra-leyenda"><span>{v.barra.observadoEtiqueta} <strong>{v.barra.observado}</strong></span><span>{v.barra.recuperableEtiqueta} [E] <strong>sin supuestos</strong></span></div></div>
     <p className="dc-linea">{v.barra.recuperableNota} <Link href={v.barra.href}>Teclear supuestos</Link></p></section>}
   {v.siguiente&&<section className="hoy-card hoy-sig" aria-labelledby="hoy-sig"><h2 id="hoy-sig">Siguiente mejor acción</h2><p className="hoy-sig-t">{v.siguiente.titulo}</p><p>{v.siguiente.detalle}</p>
     <div className="hoy-acciones"><LinkButton href={v.siguiente.href} variant="primary" size="sm" icon={<Arrow/>}>{v.siguiente.cta}</LinkButton><LinkButton href={v.siguiente.secundaria.href} size="sm">{v.siguiente.secundaria.texto}</LinkButton></div></section>}
  </div>
 </section></ComoSeCalculoProvider>;
}
