'use client';
// Lista de primeros pasos en Hoy: progreso derivado de datos reales (nunca guardado), carga diferida y con caché corta.
// Pasos que dependen de un tercero o que no se pueden derivar se muestran como tales y no cuentan en el progreso.
import {useCallback,useEffect,useState} from 'react';
import {useAutoRefresh} from '../ui/use-auto-refresh';
import Link from '../workspace/navigation-lifecycle';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {calcularChecklist,normalizarSenales,type Senales} from '../../lib/onboarding/prerrequisitos.mjs';
import {useOnboarding} from './contexto';
import './onboarding.css';

const VIDA_MS=60_000;
/** Tope de espera de la lectura: pasado este tiempo se corta y se pinta el error con «Reintentar» (nunca «Calculando…» para siempre). */
export const TOPE_LECTURA_MS=8_000;
const cache=new Map<string,{t:number;senales:Senales|null}>();
type Carga={estado:'cargando'}|{estado:'error'}|{estado:'listo';senales:Senales|null};
/** Lee las señales una vez por minuto y organización; una petición en vuelo se comparte. */
export async function leerSenales(tenant:string,signal:AbortSignal,topeMs=TOPE_LECTURA_MS):Promise<Senales|null>{
 const hit=cache.get(tenant);if(hit&&Date.now()-hit.t<VIDA_MS)return hit.senales;
 const corte=new AbortController(),alCancelar=()=>corte.abort(),tope=setTimeout(()=>corte.abort(),topeMs);
 signal.addEventListener('abort',alCancelar);
 try{
  const r=await fetch('/api/onboarding/estado',{credentials:'same-origin',signal:corte.signal});
  if(!r.ok)throw new Error('estado '+r.status);
  const json=await r.json() as {data?:{senales?:unknown}};
  const senales=normalizarSenales(json.data?.senales);cache.set(tenant,{t:Date.now(),senales});return senales;
 }finally{clearTimeout(tope);signal.removeEventListener('abort',alCancelar);}
}
export function ChecklistHoy(){
 const c=useOnboarding(),t=useT(),[carga,setCarga]=useState<Carga>({estado:'cargando'}),[intento,setIntento]=useState(0);
 const pista=c?.pista??null,tenant=c?.datos.tenantId??'',activo=Boolean(c?.listo&&c.tieneChecklist&&!c.local.descartado);
 const recargar=useCallback(async()=>{// lectura en segundo plano: conserva lo pintado hasta que lleguen los datos nuevos
  cache.delete(tenant);
  try{setCarga({estado:'listo',senales:await leerSenales(tenant,new AbortController().signal)});}catch{/* se conserva lo anterior */}
 },[tenant]);
 useAutoRefresh(recargar,{activo});
 useEffect(()=>{
  if(!activo)return;
  const ctl=new AbortController();
  // Diferido: Hoy pinta primero; el cálculo del avance nunca compite con sus cifras.
  const id=window.setTimeout(()=>{leerSenales(tenant,ctl.signal).then(senales=>setCarga({estado:'listo',senales}),()=>{if(!ctl.signal.aborted)setCarga({estado:'error'});});},400);
  return()=>{window.clearTimeout(id);ctl.abort();};
 },[activo,tenant,pista,intento]);
 const reintentar=()=>{cache.delete(tenant);setCarga({estado:'cargando'});setIntento(n=>n+1);};
 if(!c||!c.listo)return null;
 if(c.pista==='soporte'||c.soporteTerminado)return <AvisoSoporte/>;
 if(!activo||!pista)return null;
 const txt=(k:string,v?:Record<string,string|number>)=>t(k as Clave,v);
 const senales=carga.estado==='listo'?carga.senales:null;
 const lista=calcularChecklist(pista,senales);
 // Con todo lo propio hecho la lista se oculta, salvo que haya pasos en espera de un tercero o con salvedad: esos se siguen diciendo.
 if(carga.estado==='listo'&&lista.completo&&lista.esperan===0&&lista.items.every(i=>!i.nota))return null;
 const item=(i:(typeof lista.items)[number])=><li key={i.id} className="onb-item" data-estado={i.estado} data-siguiente={lista.siguiente===i.id||undefined}>
  <h3><span className="onb-estado">{t(('onb.check.estado.'+i.estado) as Clave)}</span>{txt(i.textos.titulo)}</h3>
  <p>{txt(i.textos.cuerpo)}</p>
  {i.esperaA&&<p>{t('onb.ui.esperando',{quien:txt(i.esperaA)})}</p>}
  {i.nota&&<p>{txt(i.nota)}</p>}
  {lista.siguiente===i.id&&<p><strong>{t('onb.check.siguiente')}</strong></p>}
  {i.href&&i.estado!=='hecho'&&i.estado!=='bloqueado'&&<Link href={i.href}>{t('onb.check.abrir')}</Link>}
 </li>;
 return <section className="onb-lista" aria-labelledby="onb-lista-titulo" data-cargando={carga.estado==='cargando'||undefined} data-tour="checklist">
  <div className="onb-lista-cab"><h2 id="onb-lista-titulo">{t('onb.check.titulo')}</h2>
   {carga.estado==='listo'&&(lista.progreso.total>0||lista.esperan>0)&&<div className="onb-progreso">{lista.progreso.total>0&&<><progress max={lista.progreso.total} value={lista.progreso.hechos} aria-label={t('onb.check.progreso',{hechos:lista.progreso.hechos,total:lista.progreso.total})}/><span>{t('onb.check.progreso',{hechos:lista.progreso.hechos,total:lista.progreso.total})}</span></>}{lista.esperan>0&&<span className="onb-espera">{t('onb.check.esperan',{n:lista.esperan})}</span>}</div>}</div>
  {carga.estado==='cargando'?<p role="status">{t('onb.check.cargando')}</p>
   :carga.estado==='error'?<div role="status"><p>{t('onb.check.noDisponible')}</p><button type="button" onClick={reintentar}>{t('onb.check.reintentar')}</button></div>
   :<>
    <ul className="onb-items">{lista.visibles.map(item)}</ul>
    {lista.plegados.length>0&&<details><summary>{t('onb.check.masTareas')}</summary><ul className="onb-items">{lista.plegados.map(item)}</ul></details>}
   </>}
  <div className="onb-lista-pie"><button type="button" onClick={c.ocultarChecklist}>{t('onb.check.ocultar')}</button><Link href="/setup" className="onb-lista-enlace">{t('onb.setup.verTodo')}</Link></div>
 </section>;
}
/** «Ver como»: solo un aviso informativo de solo lectura; sin lista, sin botones ni enlaces. Si la sesión terminó con la pantalla abierta, lo dice con claridad. */
export function AvisoSoporte(){
 const c=useOnboarding(),t=useT();
 if(!c)return null;
 if(c.pista!=='soporte'&&c.soporteTerminado)return <aside className="onb-aviso" role="alert" aria-labelledby="onb-aviso-titulo" data-terminada=""><h2 id="onb-aviso-titulo">{t('onb.soporte.terminada.titulo')}</h2><p>{t('onb.soporte.terminada.cuerpo')}</p></aside>;
 if(c.pista!=='soporte')return null;
 return <aside className="onb-aviso" role="note" aria-labelledby="onb-aviso-titulo"><h2 id="onb-aviso-titulo">{t('onb.soporte.aviso.titulo',{organizacion:c.datos.organizacion})}</h2><p>{t('onb.soporte.aviso.cuerpo')}</p></aside>;
}
