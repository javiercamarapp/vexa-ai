'use client';
import {useId,useMemo,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {NotificationNavigationLink} from '../notifications/navigation-link';
import {WorkspaceIcon} from './icon';
import {useJson} from '../ui/use-json';
import {datosHastaPorFuente,EXPLICACION} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {etiquetaBase} from '../../lib/legibilidad/jerga.mjs';
import {alcanceDeConsulta,consultaConPeriodo,periodoAplica,periodosRapidos,ETIQUETAS_PERIODO,periodoLegible} from '../../lib/workspace/alcance.mjs';
type Organization={id:string;name:string};
export type Theme='light'|'system'|'dark';
type Cortes={libro:string|null;conversaciones:string|null};
/** Solo se lee la fecha de corte de cada fuente de /api/trends; si la forma cambia, la barra dice «no disponible» en vez de adivinar. */
const aceptaCortes=(json:unknown):Cortes|null=>{
 const d=(json as {data?:{ledger?:{completeness?:{dataThrough?:unknown}};conversations?:{completeness?:{dataThrough?:unknown}}}})?.data;
 if(!d||typeof d!=='object'||!d.ledger||!d.conversations)return null;
 const dia=(v:unknown)=>typeof v==='string'&&v?v:null;
 return {libro:dia(d.ledger.completeness?.dataThrough),conversaciones:dia(d.conversations.completeness?.dataThrough)};
};
const CORTO:Record<string,string>={libro:'Libro económico',conversaciones:'Conversaciones'};
const TEMAS=[['light','Claro','☀'],['system','Sistema','▣'],['dark','Oscuro','☾']] as const;
/** Barra fija con el alcance de lo que se ve (periodo, moneda, base, «datos hasta» por fuente) y los controles globales (avisos, tema, organización). Lee el alcance de la URL. */
export function GlobalBar({organizations,tenant,theme,onTheme}:{organizations:Organization[];tenant:string;theme:Theme;onTheme:(value:Theme)=>void}){
 const pathname=usePathname(),router=useRouter(),params=useSearchParams(),raw=params.toString(),uid=useId();
 const [open,setOpen]=useState(false);
 const alcance=useMemo(()=>alcanceDeConsulta(raw),[raw]);
 const cortes=useJson<Cortes>('/api/trends',aceptaCortes);
 const aplica=periodoAplica(pathname);
 const organizacion=organizations.find(o=>o.id===tenant)?.name??'Organización';
 const rapidos=useMemo(()=>periodosRapidos(),[]);
 const moneda=alcance.moneda??'Según el corte',base=alcance.base?etiquetaBase(alcance.base):'Según el corte';
 const periodoTexto=alcance.periodo??(aplica?'Último corte publicado':'No aplica a esta pantalla');
 function cambiar(valor:string){
  if(valor==='ultimo'||valor==='custom')return;
  const par=rapidos[valor as keyof typeof rapidos];if(!par)return;
  router.push(pathname+'?'+consultaConPeriodo(raw,par[0],par[1]).toString());
 }
 const filasCorte=datosHastaPorFuente(cortes.data?{libro:cortes.data.libro,conversaciones:cortes.data.conversaciones}:{}) as {clave:string;etiqueta:string;dia:string|null}[];
 const valorSelect=alcance.hayAlcance?(alcance.clave??'custom'):'ultimo';
 const resumen=[alcance.periodo??(aplica?'Último corte publicado':'Datos y preferencias'),alcance.moneda].filter(Boolean).join(' · ');
 return <div className="global-bar" role="region" aria-label="Alcance y preferencias" data-open={open?'true':undefined}>
  <button type="button" className="gb-summary" aria-expanded={open} aria-controls={uid+'-panel'} onClick={()=>setOpen(v=>!v)}><span className="gb-summary-text"><span className="gb-label">Alcance</span> {resumen}</span><WorkspaceIcon name="chevron"/></button>
  <div className="gb-panel" id={uid+'-panel'}>
   <div className="gb-scope">
   <div className="gb-item">
    <span className="gb-label" id={uid+'-periodo'}>Periodo</span>
    {aplica?<select className="gb-select" aria-labelledby={uid+'-periodo'} value={valorSelect} onChange={e=>cambiar(e.target.value)}>
     {!alcance.hayAlcance&&<option value="ultimo">Último corte publicado</option>}
     {alcance.clave==='custom'&&<option value="custom">{alcance.periodo}</option>}
     {(Object.keys(rapidos) as (keyof typeof rapidos)[]).map(k=><option key={k} value={k}>{ETIQUETAS_PERIODO[k]} · {periodoLegible(rapidos[k][0],rapidos[k][1])}</option>)}
    </select>:<strong title="El periodo no cambia esta pantalla">{periodoTexto}</strong>}
   </div>
   <div className="gb-item"><span className="gb-label">Moneda</span><strong>{moneda}</strong></div>
   <div className="gb-item"><span className="gb-label">Base</span><strong title="Cómo se calcula el importe de cada pedido">{base}</strong></div>
   </div>
   <div className="gb-item gb-cortes" title={EXPLICACION}>
    <span className="gb-label">Datos hasta</span>
    {cortes.busy&&!cortes.data?<span className="gb-muted" role="status">Consultando…</span>
     :cortes.data?<ul>{filasCorte.map(f=><li key={f.clave}><span>{CORTO[f.clave]??f.etiqueta}</span> <strong>{f.dia??'sin fecha de corte'}</strong></li>)}</ul>
     :<span className="gb-muted">No disponible</span>}
   </div>
   <div className="gb-end">
   <fieldset className="gb-theme theme-selector"><legend className="sr-only">Tema de la interfaz</legend>{TEMAS.map(([value,label,icon])=><label key={value} title={'Tema '+label.toLowerCase()}><input type="radio" className="sr-only" name="global-theme" value={value} checked={theme===value} onChange={()=>onTheme(value)}/><span aria-hidden="true">{icon}</span><span className="sr-only">{label}</span></label>)}</fieldset>
   {organizations.length>1?<form className="organization-switch gb-org" action="/auth/organization" method="post"><label className="gb-label" htmlFor={uid+'-org'}>Organización</label><div className="organization-controls"><select id={uid+'-org'} name="tenant_id" defaultValue={tenant}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="submit" title="Cambiar organización" aria-label="Cambiar organización">Ir <span aria-hidden="true">↗</span></button></div></form>
    :<div className="gb-item gb-org"><span className="gb-label">Organización</span><strong title={organizacion}>{organizacion}</strong></div>}
   </div>
  </div>
  <NotificationNavigationLink compact/>
 </div>;
}
