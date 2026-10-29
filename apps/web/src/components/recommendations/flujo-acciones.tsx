'use client';
import {useRef,useState,type ReactNode} from 'react';
import type {Recommendation} from '../../../../../packages/recommendations/index.mjs';
import {validarAprobacion,validarAjuste,validarDescarte,validarResultado,RESULTADOS,PRIORIDADES,MIN_COMENTARIO,type Problema} from '../../../../../packages/recommendations/flujo.mjs';
import {useT} from '../i18n/proveedor';
import type {Traductor} from '../../lib/i18n';
import {Drawer} from '../ui/overlay';
import {Button} from '../ui/button';
import {ConfirmationDialog} from '../confirmation-dialog';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {textoLegible} from '../../lib/legibilidad/recomendaciones-vista.mjs';
import {persona,prioridadTxt,resultadoTxt,type Miembro} from './flujo-vista';
import css from './flujo.module.css';

export type Operacion=(url:string,body:unknown)=>Promise<boolean>;
type Comun={open:boolean;onClose:()=>void;item:Recommendation;miembros:Miembro[];busy:boolean;operate:Operacion};
const hoyMas=(dias:number)=>new Date(Date.now()+dias*86400000).toISOString().slice(0,10);
/** Una clave de idempotencia por intención: se conserva si la operación falla (se reintenta con la MISMA clave) y se renueva cuando el contenido cambia. */
function useClave(huella:string){const ref=useRef<{h:string;k:string}|null>(null);return ()=>{if(ref.current?.h!==huella)ref.current={h:huella,k:crypto.randomUUID()};return ref.current.k;};}
function Faltan({errores}:{errores:Problema[]}){const t=useT();return errores.length?<p className={css.faltan} role="status" id="faltan-lista">{t('tr.recs.paraContinuar',{lista:errores.map(e=>e.mensaje).join(' ')})}</p>:null;}
function Campo({id,etiqueta,ayuda,children}:{id:string;etiqueta:string;ayuda?:string;children:ReactNode}){return <div className="field"><label htmlFor={id}>{etiqueta}</label>{children}{ayuda&&<small className={css.ayuda}>{ayuda}</small>}</div>;}
const ETAPAS=['tr.recs.eAprobar','tr.recs.eBorradores','tr.recs.eEnCurso','tr.recs.eResultado'] as const;
/** Cabecera fija del flujo: dónde está esta recomendación en el proceso y qué acción se decide (el pie solo trae la decisión). */
function Resumen({item,paso}:{item:Recommendation;paso:number}){const t=useT();return <div className="ov-sticky"><ol className="ov-steps" aria-label={t('tr.recs.etapasAccionAria')}>{ETAPAS.map((e,i)=><li key={e} aria-current={i===paso?'step':undefined}>{i+1} · {t(e)}</li>)}</ol><p className="ov-impact" style={{marginTop:8}}>{textoLegible(item.action)}</p></div>;}
const cancelar=(onClose:()=>void,t:Traductor)=><Button variant="ghost" onClick={onClose}>{t('tr.recs.cancelar')}</Button>;
const opcionesMiembros=(m:Miembro[],t:Traductor)=>m.map(x=><option key={x.id} value={x.id}>{persona(x.id,m,t)}</option>);

/** PROCEDER: responsable + fecha de compromiso (+ comentario). Aprueba, crea la intervención en borrador y habilita los borradores de la acción. No envía nada. */
export function ProcederDrawer({open,onClose,item,miembros,busy,operate}:Comun){
 const t=useT();
 const [owner,setOwner]=useState(item.ownerId??''),[due,setDue]=useState(hoyMas(7)),[comment,setComment]=useState('');
 const errores=validarAprobacion({ownerId:owner,dueDate:due,comment});const clave=useClave(JSON.stringify([item.id,item.version,owner,due,comment]));
 const endpoint='/api/recommendations/'+item.id+'/flow';
 return <Drawer open={open} onClose={onClose} size="md" title={t('tr.recs.procTitulo')} subtitle={etiquetaCategoria(item.title,t)}
  footer={<>{cancelar(onClose,t)}<div className={css.primario}><ConfirmationDialog triggerLabel={t('tr.recs.procBoton')} title={t('tr.recs.procPregunta')} description={t('tr.recs.procDesc',{quien:persona(owner,miembros,t),fecha:due})} confirmLabel={t('tr.recs.procSi')} disabled={busy||errores.length>0} onConfirm={async()=>{if(await operate(endpoint,{operation:'approve',expectedVersion:item.version,ownerId:owner,dueDate:due,comment:comment.trim(),requestKey:clave()}))onClose();}}/></div></>}>
  <div className="ov-form"><Resumen item={item} paso={0}/>
   <p className="ov-impact">{t('tr.recs.procA')} <strong>{t('tr.recs.procB')}</strong>.</p>
   <Campo id={item.id+'-ap-owner'} etiqueta={t('acc.responsable')} ayuda={t('tr.recs.respAyuda')}><select id={item.id+'-ap-owner'} required value={owner} onChange={e=>setOwner(e.target.value)} disabled={busy}><option value="">{t('tr.recs.eligePersona')}</option>{opcionesMiembros(miembros,t)}</select></Campo>
   <Campo id={item.id+'-ap-due'} etiqueta={t('tr.recs.fechaCompromiso')} ayuda={t('tr.recs.fechaAyuda')}><input id={item.id+'-ap-due'} type="date" required min={hoyMas(0)} value={due} onChange={e=>setDue(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-ap-note'} etiqueta={t('tr.recs.comentarioOpc')}><textarea id={item.id+'-ap-note'} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} disabled={busy}/></Campo>
   <Faltan errores={errores}/>
  </div>
 </Drawer>;
}

/** AJUSTAR: acción, razón, supuestos, responsable y prioridad, con comentario obligatorio. Guarda una versión nueva con historial. */
export function AjustarDrawer({open,onClose,item,miembros,busy,operate,prioridad}:Comun & {prioridad:string}){
 const t=useT();
 const [action,setAction]=useState(item.action),[rationale,setRationale]=useState(item.rationale),[supuestos,setSupuestos]=useState(item.preconditions.join('\n')),[owner,setOwner]=useState(item.ownerId??''),[prio,setPrio]=useState(prioridad),[comment,setComment]=useState('');
 const lista=supuestos.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const errores=validarAjuste({action,rationale,preconditions:lista,ownerId:owner||null,priority:prio,comment});const clave=useClave(JSON.stringify([item.id,item.version,action,rationale,lista,owner,prio,comment]));
 const endpoint='/api/recommendations/'+item.id+'/flow';
 return <Drawer open={open} onClose={onClose} size="md" title={t('tr.recs.ajustarTitulo')} subtitle={etiquetaCategoria(item.title,t)}
  footer={<>{cancelar(onClose,t)}<Button type="submit" form={item.id+'-ajuste'} variant="primary" disabled={busy||errores.length>0}>{t('tr.recs.guardarAjuste')}</Button></>}>
  <form id={item.id+'-ajuste'} className="ov-form" aria-label={t('tr.recs.ajustarAria')} onSubmit={e=>{e.preventDefault();if(errores.length||busy)return;void operate(endpoint,{operation:'adjust',expectedVersion:item.version,action,rationale,preconditions:lista,ownerId:owner||null,priority:prio,comment,requestKey:clave()}).then(ok=>{if(ok)onClose();});}}>
<Resumen item={item} paso={0}/>   <p className="ov-impact">{t('tr.recs.ajusteNota')}</p>
   <Campo id={item.id+'-aj-action'} etiqueta={t('acc.accionProp')}><textarea id={item.id+'-aj-action'} required minLength={20} maxLength={2000} value={action} onChange={e=>setAction(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-aj-why'} etiqueta={t('tr.recs.razon')}><textarea id={item.id+'-aj-why'} required minLength={20} maxLength={4000} value={rationale} onChange={e=>setRationale(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-aj-sup'} etiqueta={t('tr.recs.supuestosLinea')} ayuda={t('tr.recs.supuestosAyuda')}><textarea id={item.id+'-aj-sup'} required value={supuestos} onChange={e=>setSupuestos(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-aj-owner'} etiqueta={t('acc.responsable')}><select id={item.id+'-aj-owner'} value={owner} onChange={e=>setOwner(e.target.value)} disabled={busy}><option value="">{t('acc.sinAsignar')}</option>{opcionesMiembros(miembros,t)}</select></Campo>
   <Campo id={item.id+'-aj-prio'} etiqueta={t('tr.recs.prioridad')}><select id={item.id+'-aj-prio'} value={prio} onChange={e=>setPrio(e.target.value)} disabled={busy}>{PRIORIDADES.map(p=><option key={p} value={p}>{prioridadTxt(t,p)}</option>)}</select></Campo>
   <Campo id={item.id+'-aj-note'} etiqueta={t('tr.recs.comentarioCambio')} ayuda={t('tr.recs.minCaracteresExplica',{n:MIN_COMENTARIO})}><textarea id={item.id+'-aj-note'} required minLength={MIN_COMENTARIO} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} disabled={busy}/></Campo>
   <Faltan errores={errores}/>
  </form>
 </Drawer>;
}

/** DESCARTAR (o reabrir): motivo obligatorio. */
export function DescartarDrawer({open,onClose,item,busy,operate,reabrir=false}:Omit<Comun,'miembros'> & {reabrir?:boolean}){
 const t=useT();
 const [reason,setReason]=useState('');const errores=validarDescarte({reason});const endpoint='/api/recommendations/'+item.id;
 return <Drawer open={open} onClose={onClose} size="md" title={reabrir?t('tr.recs.reabrirTitulo'):t('tr.recs.descartarTitulo')} subtitle={etiquetaCategoria(item.title,t)}
  footer={<>{cancelar(onClose,t)}<div className={css.primario}><ConfirmationDialog triggerLabel={reabrir?t('acc.reabrirRec'):t('acc.descartarRec')} title={reabrir?t('tr.recs.reabrirPregunta'):t('tr.recs.descartarPregunta')} description={reabrir?t('tr.recs.reabrirDesc'):t('tr.recs.descartarDesc')} confirmLabel={reabrir?t('tr.recs.reabrirSi'):t('tr.recs.descartarSi')} disabled={busy||errores.length>0} onConfirm={async()=>{if(await operate(endpoint,{operation:'state',expectedVersion:item.version,status:reabrir?'proposed':'dismissed',reason}))onClose();}}/></div></>}>
  <div className="ov-form"><Resumen item={item} paso={0}/>
   <Campo id={item.id+'-ds-reason'} etiqueta={reabrir?t('tr.recs.motivoReabrir'):t('tr.recs.motivoDescartar')} ayuda={t('tr.recs.minCaracteres',{n:MIN_COMENTARIO})}><textarea id={item.id+'-ds-reason'} required minLength={MIN_COMENTARIO} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></Campo>
   <Faltan errores={errores}/>
  </div>
 </Drawer>;
}

/** RESULTADO manual: sí / no / parcial + nota. La comparación antes/después la adjunta el servidor SOLO si la intervención tiene una medición con datos observados. */
export function ResultadoDrawer({open,onClose,item,busy,operate}:Omit<Comun,'miembros'>){
 const t=useT();
 const [outcome,setOutcome]=useState(''),[note,setNote]=useState('');const errores=validarResultado({outcome,note});const clave=useClave(JSON.stringify([item.id,item.version,outcome,note]));
 const endpoint='/api/recommendations/'+item.id+'/flow';
 return <Drawer open={open} onClose={onClose} size="md" title={t('tr.recs.regResTitulo')} subtitle={etiquetaCategoria(item.title,t)}
  footer={<>{cancelar(onClose,t)}<div className={css.primario}><ConfirmationDialog triggerLabel={t('acc.registrarRes')} title={t('tr.recs.regResPregunta')} description={t('tr.recs.regResDesc')} confirmLabel={t('tr.recs.regResSi')} disabled={busy||errores.length>0} onConfirm={async()=>{if(await operate(endpoint,{operation:'resolve',expectedVersion:item.version,outcome,note,requestKey:clave()}))onClose();}}/></div></>}>
  <div className="ov-form"><Resumen item={item} paso={3}/>
   <p className="ov-impact">{t('tr.recs.seResolvioTexto')}</p>
   <fieldset className={css.opciones}><legend>{t('tr.recs.seResolvio')}</legend>{RESULTADOS.map(r=><label key={r} className={css.opcion}><input type="radio" name={item.id+'-resultado'} value={r} checked={outcome===r} onChange={()=>setOutcome(r)} disabled={busy}/>{resultadoTxt(t,r)}</label>)}</fieldset>
   <Campo id={item.id+'-rs-note'} etiqueta={t('tr.recs.notaResultado')} ayuda={t('tr.recs.notaAyuda',{n:MIN_COMENTARIO})}><textarea id={item.id+'-rs-note'} required minLength={MIN_COMENTARIO} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></Campo>
   <p className={css.rotulo}>{t('tr.recs.resA')} <strong>{t('tr.recs.resB')}</strong>. {t('tr.recs.resC')}</p>
   <Faltan errores={errores}/>
  </div>
 </Drawer>;
}

/** EN CURSO: confirmación simple. */
export function IniciarBoton({item,busy,operate}:{item:Recommendation;busy:boolean;operate:Operacion}){
 const t=useT(),clave=useClave(item.id+':'+item.version+':start');
 return <div className={css.peligro}><ConfirmationDialog triggerLabel={t('tr.recs.marcarCurso')} title={t('tr.recs.marcarPregunta')} description={t('tr.recs.marcarDesc')} confirmLabel={t('tr.recs.marcarSi')} disabled={busy} onConfirm={async()=>{await operate('/api/recommendations/'+item.id+'/flow',{operation:'start',expectedVersion:item.version,requestKey:clave()});}}/></div>;
}
