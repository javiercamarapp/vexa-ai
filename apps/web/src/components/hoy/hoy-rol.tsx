'use client';
// «Hoy» para operador y lector: solo lo que su rol puede leer. No consulta /api/refunds, /api/workload ni /cfo/data/report (son de propietario y analista),
// así que no hay tarjetas «sin acceso» ni errores 403. Operador: sus intervenciones asignadas y dónde decidir recomendaciones. Lector: problemas y su evidencia redactada.
import {useMemo} from 'react';
import Link from '../workspace/navigation-lifecycle';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {useJson} from '../ui/use-json';
import {PageHeader} from '../ui/page-header';
import {LinkButton,Arrow} from '../ui/button';
import {useOnboarding} from '../onboarding/contexto';
import '../confianza/confianza.css';

export type RolHoy='operator'|'viewer';
type Problema={id:string;label:string;conversationCount:number};
type Intervencion={id:string;title:string;status:string;ownerId:string|null};
const UUID=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
/** Problemas activos de /api/problems (lectura de los cuatro roles). Una forma inesperada se rechaza entera. */
export function aceptarProblemas(json:unknown):Problema[]|null{
 const lista=(json as {problems?:unknown})?.problems;if(!Array.isArray(lista))return null;
 const salida:Problema[]=[];
 for(const p of lista){
  if(!p||typeof p!=='object')return null;const r=p as Record<string,unknown>;
  if(typeof r.id!=='string'||!UUID.test(r.id)||typeof r.label!=='string'||!['active','retired'].includes(String(r.state)))return null;
  const n=typeof r.conversationCount==='number'?r.conversationCount:Array.isArray(r.conversationIds)?r.conversationIds.length:0;
  if(r.state==='active')salida.push({id:r.id,label:r.label,conversationCount:n});
 }
 return salida.sort((a,b)=>b.conversationCount-a.conversationCount||a.label.localeCompare(b.label));
}
/** Intervenciones de /api/interventions (lectura de los cuatro roles). Solo se conservan las ABIERTAS cuyo responsable es la persona. */
export function aceptarIntervenciones(json:unknown,userId:string):Intervencion[]|null{
 const lista=(json as {data?:{items?:unknown}})?.data?.items;if(!Array.isArray(lista))return null;
 const salida:Intervencion[]=[];
 for(const i of lista){
  if(!i||typeof i!=='object')return null;const r=i as Record<string,unknown>;
  if(typeof r.id!=='string'||typeof r.title!=='string'||typeof r.status!=='string')return null;
  if(userId&&r.ownerId===userId&&!['closed','cancelled'].includes(r.status))salida.push({id:r.id,title:r.title,status:r.status,ownerId:userId});
 }
 return salida;
}
const ESTADO:Record<string,Clave>={draft:'interv.sDraft',approved:'interv.sApproved',active:'interv.sActive',measuring:'interv.sMeasuring'};
const MAX_PROBLEMAS=6;

function ListaProblemas({rol}:{rol:RolHoy}){
 const t=useT(),r=useJson<Problema[]>('/api/problems',aceptarProblemas);
 return <section className="hoy-card" aria-labelledby="hoy-rol-prob" data-tour="problemas">
  <h2 id="hoy-rol-prob">{t('hoy.rol.problemasTitulo')}{r.data&&<span> ({r.data.length})</span>}</h2>
  <p className="dc-vacio">{t(rol==='viewer'?'hoy.rol.problemasLector':'hoy.rol.problemasOperador')}</p>
  {r.data===null?<p className="dc-vacio" role="status">{r.busy?t('comun.cargando'):t('hoy.rol.noDisponible')}</p>
   :r.data.length===0?<p className="dc-vacio">{t('hoy.rol.sinProblemas')}</p>
   :<ul className="hoy-lista">{r.data.slice(0,MAX_PROBLEMAS).map(p=><li key={p.id}><Link className="hoy-fila" href={'/problems/'+p.id}><span className="hoy-punto" aria-hidden="true"/><span><p className="hoy-fila-t">{p.label}</p><p className="hoy-fila-d">{t('hoy.rol.conversaciones',{n:p.conversationCount})}</p></span></Link></li>)}</ul>}
  <div className="hoy-acciones"><LinkButton href="/problems" size="sm" icon={<Arrow/>}>{t('hoy.rol.verProblemas')}</LinkButton></div>
 </section>;
}

function MisIntervenciones({userId}:{userId:string}){
 const t=useT(),r=useJson<Intervencion[]>('/api/interventions',j=>aceptarIntervenciones(j,userId));
 return <section className="hoy-card" aria-labelledby="hoy-rol-int" data-tour="mis-intervenciones">
  <h2 id="hoy-rol-int">{t('hoy.rol.intervencionesTitulo')}{r.data&&<span> ({r.data.length})</span>}</h2>
  {r.data===null?<p className="dc-vacio" role="status">{r.busy?t('comun.cargando'):t('hoy.rol.noDisponible')}</p>
   :r.data.length===0?<p className="dc-vacio">{t('hoy.rol.sinIntervenciones')}</p>
   :<ul className="hoy-lista">{r.data.map(i=><li key={i.id}><Link className="hoy-fila" href="/interventions"><span className="hoy-punto" aria-hidden="true"/><span><p className="hoy-fila-t">{i.title}</p><p className="hoy-fila-d">{ESTADO[i.status]?t(ESTADO[i.status]):i.status}</p></span></Link></li>)}</ul>}
  <div className="hoy-acciones"><LinkButton href="/interventions" size="sm" icon={<Arrow/>}>{t('hoy.rol.verIntervenciones')}</LinkButton></div>
 </section>;
}

/** Operador: sus intervenciones, dónde decidir recomendaciones y los problemas. Lector: problemas con evidencia redactada y cuánto fiarse. */
export function HoyRol({rol}:{rol:RolHoy}){
 const t=useT(),c=useOnboarding(),userId=c?.datos.userId??'';
 const nota=useMemo(()=>t(rol==='viewer'?'hoy.rol.notaLector':'hoy.rol.notaOperador'),[rol,t]);
 return <section className="hoy" aria-label={t('hoy.titulo')} data-tour="hoy-rol" data-rol={rol}>
  <div className="hoy-titular"><PageHeader eyebrow={t('hoy.eyebrow')} title={t('hoy.titulo')} description={<span className="hoy-resumen">{nota}</span>}/></div>
  <div className="hoy-cols">
   {rol==='operator'&&<MisIntervenciones userId={userId}/>}
   {rol==='operator'&&<section className="hoy-card" aria-labelledby="hoy-rol-rec"><h2 id="hoy-rol-rec">{t('hoy.rol.recomendacionesTitulo')}</h2><p className="dc-vacio">{t('hoy.rol.recomendacionesCuerpo')}</p>
    <div className="hoy-acciones"><LinkButton href="/recommendations" size="sm" icon={<Arrow/>}>{t('hoy.rol.verRecomendaciones')}</LinkButton></div></section>}
   <ListaProblemas rol={rol}/>
   {rol==='viewer'&&<section className="hoy-card" aria-labelledby="hoy-rol-conf"><h2 id="hoy-rol-conf">{t('hoy.rol.confianzaTitulo')}</h2><p className="dc-vacio">{t('hoy.rol.confianzaCuerpo')}</p>
    <div className="hoy-acciones"><LinkButton href="/confianza" size="sm" icon={<Arrow/>}>{t('hoy.rol.verConfianza')}</LinkButton></div></section>}
  </div>
 </section>;
}

/** Elige la «Hoy» según el rol efectivo de la sesión (en «Ver como» es lector). Propietario y analista conservan la pantalla de cifras. */
export function HoyPorRol({completa}:{completa:React.ReactNode}){
 const rol=useOnboarding()?.datos.rol;
 if(rol==='operator'||rol==='viewer')return <HoyRol rol={rol}/>;
 return <>{completa}</>;
}
