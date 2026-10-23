'use client';
import type {ReactNode} from 'react';
import type {Recommendation} from '../../../../../packages/recommendations/index.mjs';
import type {FlowEvent,Etapa} from '../../../../../packages/recommendations/flujo.mjs';
import {construirLinea,pasosEtapa,RESULTADO_TXT,PRIORIDAD_TXT,ETAPA_TXT} from '../../../../../packages/recommendations/flujo.mjs';
import {formatMinorUnits} from '../../../../../packages/metrics/money.mjs';
import {Stepper} from '../ui/stepper';
import {Timeline} from '../ui/timeline';
import {StatusChip} from '../ui/status-chip';
import {LinkButton,Arrow} from '../ui/button';
import {textoLegible} from '../../lib/legibilidad/recomendaciones-vista.mjs';
import css from './flujo.module.css';

export type FlowItem=Recommendation & {flow?:{available:boolean;role:string;events:FlowEvent[];etapa:Etapa;interventionId:string|null};priorityBase?:string};
export type Miembro={id:string;role:string};
export const ROL_TXT:Record<string,string>={owner:'Propietario',analyst:'Analista',operator:'Operador',viewer:'Lector'};
const fechaTxt=(v:string|null|undefined)=>{if(!v)return '';const d=new Date(v.length===10?v+'T12:00:00Z':v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});};
const horaTxt=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString('es-MX',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';};
/** Los miembros solo traen id y rol (no nombres ni correos): se muestra el rol y los últimos 4 caracteres del id. */
export function persona(id:string|null|undefined,miembros:Miembro[]){if(!id)return 'Sin asignar';const m=miembros.find(x=>x.id===id);return (m?ROL_TXT[m.role]??m.role:'Persona del equipo')+' · '+id.slice(-4);}
export const etapaTono=(e:Etapa):'ok'|'warn'|'bad'|'info'|'neutral'|'muted'=>e==='descartada'?'muted':e==='resultado'?'ok':e==='en_curso'||e==='aprobada'?'info':'neutral';

export function EtapasFlujo({etapa}:{etapa:Etapa}){
 if(etapa==='descartada')return <div className={css.etapas}><p className={css.etapaTitulo}>Etapa</p><StatusChip tone="muted">Descartada</StatusChip></div>;
 return <div className={css.etapas}><p className={css.etapaTitulo}>Etapa</p><Stepper label="Etapas de la recomendación" steps={pasosEtapa(etapa).map(p=>({key:p.clave,label:p.etiqueta,state:p.estado}))}/></div>;
}
const ICONO:Record<string,string>={propuesta:'sparkle',ajustada:'settings',responsable:'users',aprobada:'check',approved:'check',adjusted:'settings',started:'play',resolved:'flag',descartada:'x',reabierta:'refresh'};
export function LineaFlujo({item,miembros}:{item:FlowItem;miembros:Miembro[]}){
 const filas=construirLinea({item,eventos:item.flow?.events??[],nombre:id=>persona(id,miembros)});
 return <details className={css.linea}><summary>{'Línea de tiempo ('+filas.length+')'}</summary>
  <Timeline events={filas.map(f=>({key:f.clave,title:f.titulo,icon:ICONO[f.tipo]??'message',meta:<>{f.quien} · <time dateTime={f.cuando}>{horaTxt(f.cuando)}</time></>,body:f.detalle?textoLegible(f.detalle):undefined}))}/>
 </details>;
}
export function ComparacionBloque({c}:{c:NonNullable<FlowEvent['comparison']>}){
 const fmt=(v:string)=>formatMinorUnits(v,c.moneda,c.exponente);
 return <section aria-label="Comparación antes y después"><dl className={css.comparacion}><div><dt>Antes</dt><dd>{fmt(c.antesMinor)}</dd></div><div><dt>Después</dt><dd>{fmt(c.despuesMinor)}</dd></div><div><dt>Cambio</dt><dd>{fmt(c.deltaMinor)}</dd></div></dl>
  <p className={css.rotulo}><strong>{c.rotulo}</strong>{c.completa?'':' La medición está incompleta: solo incluye el subtotal conocido de cada periodo.'} Importes de ingreso observados; no se estima margen ni ahorro.</p></section>;
}
/** Bloque «Seguimiento» (aprobada / en curso / con resultado). */
export function SeguimientoBloque({item,miembros,acciones}:{item:FlowItem;miembros:Miembro[];acciones?:ReactNode}){
 const evs=item.flow?.events??[],apr=evs.find(e=>e.kind==='approved'),ini=evs.find(e=>e.kind==='started'),res=evs.find(e=>e.kind==='resolved');
 if(!apr)return null;
 const prioridad=PRIORIDAD_TXT[item.priority]??item.priority;
 return <>
  <section className={css.seguimiento} aria-label="Seguimiento de la intervención"><h4>Seguimiento</h4>
   <dl className={css.kv}>
    <div><dt>Responsable</dt><dd>{persona(apr.ownerId,miembros)}</dd></div>
    <div><dt>Fecha de compromiso</dt><dd>{fechaTxt(apr.dueDate)}</dd></div>
    <div><dt>Aprobada por</dt><dd>{persona(apr.actorId,miembros)} · {fechaTxt(apr.createdAt)}</dd></div>
    <div><dt>Puesta en curso</dt><dd>{ini?persona(ini.actorId,miembros)+' · '+fechaTxt(ini.createdAt):'Aún no'}</dd></div>
    <div><dt>Prioridad</dt><dd>{prioridad}</dd></div>
    <div><dt>Intervención</dt><dd>{apr.interventionId?<LinkButton href={'/interventions#intervention-'+apr.interventionId} size="sm" variant="ghost" icon={<Arrow/>}>Abrir intervención</LinkButton>:'Sin vincular'}</dd></div>
   </dl>
   {apr.comment&&<p className="card-lead">{'Comentario de la aprobación: '}{textoLegible(apr.comment)}</p>}
   {acciones}
  </section>
  {res&&<section className={css.resultado} aria-label="Resultado registrado"><h4>Resultado</h4>
   <p><StatusChip tone={res.outcome==='yes'?'ok':res.outcome==='partial'?'warn':'bad'}>{RESULTADO_TXT[res.outcome??'']??res.outcome}</StatusChip></p>
   <p className="card-lead">{textoLegible(res.note??'')}</p>
   <p className={css.rotulo}>{'Registrado por '+persona(res.actorId,miembros)+' · '+fechaTxt(res.createdAt)+'. Lo escribió una persona: no es una medición automática.'}</p>
   {res.comparison?<ComparacionBloque c={res.comparison}/>:<p className={css.rotulo}>Sin comparación antes/después: la intervención no tiene una medición con datos observados en dos periodos. No se estima ni se supone un efecto.</p>}
  </section>}
 </>;
}
export {ETAPA_TXT};
