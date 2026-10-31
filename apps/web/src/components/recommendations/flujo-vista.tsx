'use client';
import type {ReactNode} from 'react';
import type {Recommendation} from '../../../../../packages/recommendations/index.mjs';
import type {FlowEvent,Etapa} from '../../../../../packages/recommendations/flujo.mjs';
import {construirLinea,pasosEtapa,RESULTADO_TXT,PRIORIDAD_TXT,ETAPA_TXT} from '../../../../../packages/recommendations/flujo.mjs';
import {useT,useIdioma} from '../i18n/proveedor';
import type {Clave,Traductor,Idioma} from '../../lib/i18n';
import {fechaCorta,fechaHora} from '../../lib/formato/idioma.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {Stepper} from '../ui/stepper';
import {Timeline} from '../ui/timeline';
import {StatusChip} from '../ui/status-chip';
import {LinkButton,Arrow} from '../ui/button';
import {textoLegible} from '../../lib/legibilidad/recomendaciones-vista.mjs';
import css from './flujo.module.css';

export type FlowItem=Recommendation & {flow?:{available:boolean;role:string;events:FlowEvent[];etapa:Etapa;interventionId:string|null};priorityBase?:string};
export type Miembro={id:string;role:string};
export const ROL_TXT:Record<string,string>={owner:'Administrador del espacio',analyst:'Analista',operator:'Operador',viewer:'Lectura'};
const fechaTxt=(v:string|null|undefined,idioma:Idioma)=>{if(!v)return '';return fechaCorta(v,idioma)??v;};
const horaTxt=(v:string,idioma:Idioma)=>{const h=fechaHora(v,idioma);return h?h+' UTC':v;};
/** Los miembros solo traen id y rol (no nombres ni correos): se muestra el rol y los últimos 4 caracteres del id. */
const ROL_CLAVE:Record<string,Clave>={owner:'conx.e.rol.owner',analyst:'conx.e.rol.analyst',operator:'conx.e.rol.operator',viewer:'conx.e.rol.viewer'};
/** `t` es el traductor del idioma activo (obligatorio: ya no hay llamadores sin traductor). */
export function persona(id:string|null|undefined,miembros:Miembro[],t:Traductor){if(!id)return t('acc.sinAsignar');const m=miembros.find(x=>x.id===id);return (m?(ROL_CLAVE[m.role]?t(ROL_CLAVE[m.role]):ROL_TXT[m.role]??m.role):t('tr.recs.personaEquipo'))+' · '+id.slice(-4);}
const PRIO_CLAVE:Record<string,Clave>={critical:'acc.prioCritical',high:'acc.prioHigh',normal:'acc.prioNormal'};
const RES_CLAVE:Record<string,Clave>={yes:'acc.resSi',no:'acc.resNo',partial:'acc.resParcial'};
const ETAPA_CLAVE:Record<string,Clave>={propuesta:'acc.etPropuesta',ajustada:'acc.etAjustada',aprobada:'acc.etAprobada',en_curso:'acc.etEnCurso',resultado:'acc.etResultado',descartada:'acc.etDescartada'};
/** Prioridad, resultado y etapa en el idioma activo (los textos base de packages/recommendations siguen en español para quien no pasa `t`). */
export const prioridadTxt=(t:Traductor,p:string)=>PRIO_CLAVE[p]?t(PRIO_CLAVE[p]):(PRIORIDAD_TXT[p]??p);
export const resultadoTxt=(t:Traductor,r:string)=>RES_CLAVE[r]?t(RES_CLAVE[r]):(RESULTADO_TXT[r]??r);
export const etapaTono=(e:Etapa):'ok'|'warn'|'bad'|'info'|'neutral'|'muted'=>e==='descartada'?'muted':e==='resultado'?'ok':e==='en_curso'||e==='aprobada'?'info':'neutral';

export function EtapasFlujo({etapa}:{etapa:Etapa}){
 const t=useT();
 if(etapa==='descartada')return <div className={css.etapas}><p className={css.etapaTitulo}>{t('tr.recs.etapa')}</p><StatusChip tone="muted">{t('acc.descartada')}</StatusChip></div>;
 return <div className={css.etapas}><p className={css.etapaTitulo}>{t('tr.recs.etapa')}</p><Stepper label={t('tr.recs.etapasAria')} steps={pasosEtapa(etapa).map(p=>({key:p.clave,label:ETAPA_CLAVE[p.clave==='propuesta'&&etapa==='ajustada'?'ajustada':p.clave]?t(ETAPA_CLAVE[p.clave==='propuesta'&&etapa==='ajustada'?'ajustada':p.clave]):p.etiqueta,state:p.estado}))}/></div>;
}
const ICONO:Record<string,string>={propuesta:'sparkle',ajustada:'settings',responsable:'users',aprobada:'check',approved:'check',adjusted:'settings',started:'play',resolved:'flag',descartada:'x',reabierta:'refresh'};
export function LineaFlujo({item,miembros}:{item:FlowItem;miembros:Miembro[]}){
 const t=useT(),idioma=useIdioma(),filas=construirLinea({item,eventos:item.flow?.events??[],nombre:id=>persona(id,miembros,t)});
 return <details className={css.linea}><summary>{t('tr.recs.lineaTiempo',{n:filas.length})}</summary>
  <Timeline events={filas.map(f=>({key:f.clave,title:f.titulo,icon:ICONO[f.tipo]??'message',meta:<>{f.quien} · <time dateTime={f.cuando}>{horaTxt(f.cuando,idioma)}</time></>,body:f.detalle?textoLegible(f.detalle):undefined}))}/>
 </details>;
}
export function ComparacionBloque({c}:{c:NonNullable<FlowEvent['comparison']>}){
 const t=useT(),fmt=(v:string)=>formatMinorUnits(v,c.moneda,c.exponente);
 return <section aria-label={t('tr.recs.cmpAria')}><dl className={css.comparacion}><div><dt>{t('acc.antes')}</dt><dd>{fmt(c.antesMinor)}</dd></div><div><dt>{t('acc.despues')}</dt><dd>{fmt(c.despuesMinor)}</dd></div><div><dt>{t('tr.recs.cambio')}</dt><dd>{fmt(c.deltaMinor)}</dd></div></dl>
  <p className={css.rotulo}><strong>{c.rotulo}</strong>{c.completa?'':t('tr.recs.cmpIncompleta')}{t('tr.recs.cmpImportes')}</p></section>;
}
/** Bloque «Seguimiento» (aprobada / en curso / con resultado). */
export function SeguimientoBloque({item,miembros,acciones}:{item:FlowItem;miembros:Miembro[];acciones?:ReactNode}){
 const t=useT(),idioma=useIdioma(),evs=item.flow?.events??[],apr=evs.find(e=>e.kind==='approved'),ini=evs.find(e=>e.kind==='started'),res=evs.find(e=>e.kind==='resolved');
 if(!apr)return null;
 const prioridad=prioridadTxt(t,item.priority);
 return <>
  <section className={css.seguimiento} aria-label={t('tr.recs.segAria')}><h4>{t('tr.recs.seguimiento')}</h4>
   <dl className={css.kv}>
    <div><dt>{t('acc.responsable')}</dt><dd>{persona(apr.ownerId,miembros,t)}</dd></div>
    <div><dt>{t('tr.recs.fechaCompromiso')}</dt><dd>{fechaTxt(apr.dueDate,idioma)}</dd></div>
    <div><dt>{t('tr.recs.aprobadaPor')}</dt><dd>{persona(apr.actorId,miembros,t)} · {fechaTxt(apr.createdAt,idioma)}</dd></div>
    <div><dt>{t('tr.recs.puestaCurso')}</dt><dd>{ini?persona(ini.actorId,miembros,t)+' · '+fechaTxt(ini.createdAt,idioma):t('tr.recs.aunNo')}</dd></div>
    <div><dt>{t('tr.recs.prioridad')}</dt><dd>{prioridad}</dd></div>
    <div><dt>{t('tr.recs.intervencion')}</dt><dd>{apr.interventionId?<LinkButton href={'/interventions#intervention-'+apr.interventionId} size="sm" variant="ghost" icon={<Arrow/>}>{t('acc.abrirInterv')}</LinkButton>:t('tr.recs.sinVincular')}</dd></div>
   </dl>
   {apr.comment&&<p className="card-lead">{t('tr.recs.comentarioAprob')}{textoLegible(apr.comment)}</p>}
   {acciones}
  </section>
  {res&&<section className={css.resultado} aria-label={t('tr.recs.resultadoAria')}><h4>{t('tr.recs.resultado')}</h4>
   <p><StatusChip tone={res.outcome==='yes'?'ok':res.outcome==='partial'?'warn':'bad'}>{resultadoTxt(t,res.outcome??'')}</StatusChip></p>
   <p className="card-lead">{textoLegible(res.note??'')}</p>
   <p className={css.rotulo}>{t('tr.recs.registradoPor',{quien:persona(res.actorId,miembros,t),fecha:fechaTxt(res.createdAt,idioma)})}</p>
   {res.comparison?<ComparacionBloque c={res.comparison}/>:<p className={css.rotulo}>{t('tr.recs.sinComparacion')}</p>}
  </section>}
 </>;
}
export {ETAPA_TXT};
