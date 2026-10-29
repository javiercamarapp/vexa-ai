'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useIdioma,useT} from '../i18n/proveedor';
import {numero} from '../../lib/i18n/formato';
import {PageHeader} from '../ui/page-header';
import {Button,Refresh} from '../ui/button';
import {EmptyState} from '../ui/empty-state';
import {Icon} from '../ui/icons';
import {useVista} from '../map/use-vista';
import type {CcoVista} from '../../../../../packages/workspace-service/cco.mjs';
import {TarjetaA,TarjetaB,TarjetaC,TarjetaD,TarjetaE,TarjetaF} from './cco-tarjetas';
import './cco.css';

const forma=(d:unknown)=>typeof d==='object'&&d!==null&&'cards' in d&&'status' in d;

/** Pestaña CCO (/cco): seis preguntas A a F con su estado de datos, lo que sí se puede ver hoy y la lista exacta de lo que falta y a quién pedirlo. */
export function CcoPantalla({organization}:{organization?:string}){
 const t=useT(),idioma=useIdioma();
 const f=useVista<CcoVista>('/api/cco',forma);
 const v=f.data;
 if(!v&&f.busy)return <RovaqCargando mensaje={t('cco.cargando')}/>;
 return <div className="task-page stack cco-page">
  <PageHeader eyebrow={t('cco.eyebrow')} title={t('cco.titulo')} description={<>{t('cco.desc')}{organization?` ${organization}.`:''}</>}/>
  {!v&&!f.busy&&f.error&&<EmptyState art="shield" tone="warn" title={f.error.code==='acceso'?t('vista.sinAcceso'):t('vista.noDisponible')} body={f.error.texto} action={f.error.code==='acceso'?undefined:<Button icon={<Refresh/>} onClick={()=>f.reload()}>{t('vista.reintentar')}</Button>}/>}
  {v&&v.status==='not_installed'&&<EmptyState art="shield" tone="warn" title={t('cco.noInstalado.titulo')} body={t('cco.noInstalado.cuerpo')}/>}
  {v&&v.status==='ok'&&<>
   <p className="cco-resumen" role="note"><Icon name="info" size={16}/><span>{t('cco.provisional')} <b>{t('cco.resumen',{listo:numero(idioma,v.resumen.listo),salvedad:numero(idioma,v.resumen.salvedad),falta:numero(idioma,v.resumen.falta)})}</b></span></p>
   <TarjetaA card={v.cards.A} minimo={v.minimoPorCelda} consultado={v.generatedAt}/>
   <TarjetaB card={v.cards.B} minimo={v.minimoPorCelda} consultado={v.generatedAt}/>
   <TarjetaC card={v.cards.C} minimo={v.minimoPorCelda} consultado={v.generatedAt}/>
   <TarjetaD card={v.cards.D} minimo={v.minimoPorCelda} consultado={v.generatedAt}/>
   <TarjetaE card={v.cards.E} minimo={v.minimoPorCelda} consultado={v.generatedAt}/>
   <TarjetaF card={v.cards.F} minimo={v.minimoPorCelda} consultado={v.generatedAt}/>
  </>}
 </div>;
}
