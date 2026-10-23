'use client';
import {useRef,useState,type ReactNode} from 'react';
import type {Recommendation} from '../../../../../packages/recommendations/index.mjs';
import {validarAprobacion,validarAjuste,validarDescarte,validarResultado,RESULTADOS,RESULTADO_TXT,PRIORIDADES,PRIORIDAD_TXT,MIN_COMENTARIO,type Problema} from '../../../../../packages/recommendations/flujo.mjs';
import {Drawer} from '../ui/overlay';
import {Button} from '../ui/button';
import {ConfirmationDialog} from '../confirmation-dialog';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {persona,type Miembro} from './flujo-vista';
import css from './flujo.module.css';

export type Operacion=(url:string,body:unknown)=>Promise<boolean>;
type Comun={open:boolean;onClose:()=>void;item:Recommendation;miembros:Miembro[];busy:boolean;operate:Operacion};
const hoyMas=(dias:number)=>new Date(Date.now()+dias*86400000).toISOString().slice(0,10);
/** Una clave de idempotencia por intención: se conserva si la operación falla (se reintenta con la MISMA clave) y se renueva cuando el contenido cambia. */
function useClave(huella:string){const ref=useRef<{h:string;k:string}|null>(null);return ()=>{if(ref.current?.h!==huella)ref.current={h:huella,k:crypto.randomUUID()};return ref.current.k;};}
function Faltan({errores}:{errores:Problema[]}){return errores.length?<p className={css.faltan} role="status" id="faltan-lista">{'Para continuar: '+errores.map(e=>e.mensaje).join(' ')}</p>:null;}
function Campo({id,etiqueta,ayuda,children}:{id:string;etiqueta:string;ayuda?:string;children:ReactNode}){return <div className={css.campo}><label htmlFor={id}>{etiqueta}</label>{children}{ayuda&&<small className={css.ayuda}>{ayuda}</small>}</div>;}
const opcionesMiembros=(m:Miembro[])=>m.map(x=><option key={x.id} value={x.id}>{persona(x.id,m)}</option>);

/** PROCEDER: responsable + fecha de compromiso (+ comentario). Aprueba, crea la intervención en borrador y habilita los borradores de la acción. No envía nada. */
export function ProcederDrawer({open,onClose,item,miembros,busy,operate}:Comun){
 const [owner,setOwner]=useState(item.ownerId??''),[due,setDue]=useState(hoyMas(7)),[comment,setComment]=useState('');
 const errores=validarAprobacion({ownerId:owner,dueDate:due,comment});const clave=useClave(JSON.stringify([item.id,item.version,owner,due,comment]));
 const endpoint='/api/recommendations/'+item.id+'/flow';
 return <Drawer open={open} onClose={onClose} width={540} title="Proceder con esta recomendación" subtitle={etiquetaCategoria(item.title)}
  footer={<div className={css.primario}><ConfirmationDialog triggerLabel="Proceder y crear intervención" title="¿Aprobar y crear la intervención?" description={'La recomendación quedará aprobada y asignada a '+persona(owner,miembros)+' con fecha de compromiso '+due+'. Se creará una intervención en borrador. No se envía nada por tu cuenta: los borradores de correo y listas los revisas y envías tú. Lo aprobado ya no se edita.'} confirmLabel="Sí, proceder" disabled={busy||errores.length>0} onConfirm={async()=>{if(await operate(endpoint,{operation:'approve',expectedVersion:item.version,ownerId:owner,dueDate:due,comment:comment.trim(),requestKey:clave()}))onClose();}}/></div>}>
  <div className="stack">
   <p className="card-lead">Al proceder, una persona asume la acción. Rovaq crea la intervención y prepara borradores; <strong>no ejecuta ni envía nada</strong>.</p>
   <Campo id={item.id+'-ap-owner'} etiqueta="Responsable" ayuda="Quien responde por esta acción."><select id={item.id+'-ap-owner'} required value={owner} onChange={e=>setOwner(e.target.value)} disabled={busy}><option value="">Elige una persona</option>{opcionesMiembros(miembros)}</select></Campo>
   <Campo id={item.id+'-ap-due'} etiqueta="Fecha de compromiso" ayuda="Para cuándo debe estar en marcha."><input id={item.id+'-ap-due'} type="date" required min={hoyMas(0)} value={due} onChange={e=>setDue(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-ap-note'} etiqueta="Comentario (opcional)"><textarea id={item.id+'-ap-note'} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} disabled={busy}/></Campo>
   <Faltan errores={errores}/>
  </div>
 </Drawer>;
}

/** AJUSTAR: acción, razón, supuestos, responsable y prioridad, con comentario obligatorio. Guarda una versión nueva con historial. */
export function AjustarDrawer({open,onClose,item,miembros,busy,operate,prioridad}:Comun & {prioridad:string}){
 const [action,setAction]=useState(item.action),[rationale,setRationale]=useState(item.rationale),[supuestos,setSupuestos]=useState(item.preconditions.join('\n')),[owner,setOwner]=useState(item.ownerId??''),[prio,setPrio]=useState(prioridad),[comment,setComment]=useState('');
 const lista=supuestos.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const errores=validarAjuste({action,rationale,preconditions:lista,ownerId:owner||null,priority:prio,comment});const clave=useClave(JSON.stringify([item.id,item.version,action,rationale,lista,owner,prio,comment]));
 const endpoint='/api/recommendations/'+item.id+'/flow';
 return <Drawer open={open} onClose={onClose} width={600} title="Ajustar la recomendación" subtitle={etiquetaCategoria(item.title)}
  footer={<Button type="submit" form={item.id+'-ajuste'} variant="primary" disabled={busy||errores.length>0}>Guardar ajuste</Button>}>
  <form id={item.id+'-ajuste'} className="stack" aria-label="Ajustar recomendación" onSubmit={e=>{e.preventDefault();if(errores.length||busy)return;void operate(endpoint,{operation:'adjust',expectedVersion:item.version,action,rationale,preconditions:lista,ownerId:owner||null,priority:prio,comment,requestKey:clave()}).then(ok=>{if(ok)onClose();});}}>
   <p className="card-lead">Se guarda una versión nueva; la anterior queda en el historial y no se borra.</p>
   <Campo id={item.id+'-aj-action'} etiqueta="Acción propuesta"><textarea id={item.id+'-aj-action'} required minLength={20} maxLength={2000} value={action} onChange={e=>setAction(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-aj-why'} etiqueta="Razón"><textarea id={item.id+'-aj-why'} required minLength={20} maxLength={4000} value={rationale} onChange={e=>setRationale(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-aj-sup'} etiqueta="Supuestos, uno por línea" ayuda="Lo que debe ser cierto para que esta acción tenga sentido."><textarea id={item.id+'-aj-sup'} required value={supuestos} onChange={e=>setSupuestos(e.target.value)} disabled={busy}/></Campo>
   <Campo id={item.id+'-aj-owner'} etiqueta="Responsable"><select id={item.id+'-aj-owner'} value={owner} onChange={e=>setOwner(e.target.value)} disabled={busy}><option value="">Sin asignar</option>{opcionesMiembros(miembros)}</select></Campo>
   <Campo id={item.id+'-aj-prio'} etiqueta="Prioridad"><select id={item.id+'-aj-prio'} value={prio} onChange={e=>setPrio(e.target.value)} disabled={busy}>{PRIORIDADES.map(p=><option key={p} value={p}>{PRIORIDAD_TXT[p]}</option>)}</select></Campo>
   <Campo id={item.id+'-aj-note'} etiqueta="Comentario del cambio (obligatorio)" ayuda={'Explica qué cambias y por qué (mínimo '+MIN_COMENTARIO+' caracteres).'}><textarea id={item.id+'-aj-note'} required minLength={MIN_COMENTARIO} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} disabled={busy}/></Campo>
   <Faltan errores={errores}/>
  </form>
 </Drawer>;
}

/** DESCARTAR (o reabrir): motivo obligatorio. */
export function DescartarDrawer({open,onClose,item,busy,operate,reabrir=false}:Omit<Comun,'miembros'> & {reabrir?:boolean}){
 const [reason,setReason]=useState('');const errores=validarDescarte({reason});const endpoint='/api/recommendations/'+item.id;
 return <Drawer open={open} onClose={onClose} width={500} title={reabrir?'Reabrir la recomendación':'Descartar la recomendación'} subtitle={etiquetaCategoria(item.title)}
  footer={<div className={css.primario}><ConfirmationDialog triggerLabel={reabrir?'Reabrir recomendación':'Descartar recomendación'} title={reabrir?'¿Reabrir esta recomendación?':'¿Descartar esta recomendación?'} description={reabrir?'Volverá a estar propuesta y se podrá aprobar o ajustar. Tu motivo queda en el historial.':'Dejará de estar propuesta. Tu motivo queda en el historial y podrás reabrirla si el problema reaparece.'} confirmLabel={reabrir?'Sí, reabrir':'Sí, descartar'} disabled={busy||errores.length>0} onConfirm={async()=>{if(await operate(endpoint,{operation:'state',expectedVersion:item.version,status:reabrir?'proposed':'dismissed',reason}))onClose();}}/></div>}>
  <div className="stack">
   <Campo id={item.id+'-ds-reason'} etiqueta={reabrir?'Motivo para reabrir (obligatorio)':'Motivo del descarte (obligatorio)'} ayuda={'Mínimo '+MIN_COMENTARIO+' caracteres.'}><textarea id={item.id+'-ds-reason'} required minLength={MIN_COMENTARIO} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></Campo>
   <Faltan errores={errores}/>
  </div>
 </Drawer>;
}

/** RESULTADO manual: sí / no / parcial + nota. La comparación antes/después la adjunta el servidor SOLO si la intervención tiene una medición con datos observados. */
export function ResultadoDrawer({open,onClose,item,busy,operate}:Omit<Comun,'miembros'>){
 const [outcome,setOutcome]=useState(''),[note,setNote]=useState('');const errores=validarResultado({outcome,note});const clave=useClave(JSON.stringify([item.id,item.version,outcome,note]));
 const endpoint='/api/recommendations/'+item.id+'/flow';
 return <Drawer open={open} onClose={onClose} width={540} title="Registrar el resultado" subtitle={etiquetaCategoria(item.title)}
  footer={<div className={css.primario}><ConfirmationDialog triggerLabel="Registrar resultado" title="¿Registrar este resultado?" description="Quedará guardado con tu nombre y la fecha, y no se podrá editar. Es tu valoración; no es una medición automática." confirmLabel="Sí, registrar" disabled={busy||errores.length>0} onConfirm={async()=>{if(await operate(endpoint,{operation:'resolve',expectedVersion:item.version,outcome,note,requestKey:clave()}))onClose();}}/></div>}>
  <div className="stack">
   <p className="card-lead">¿Se resolvió lo que esta recomendación buscaba? Responde con lo que sabes hoy.</p>
   <fieldset className={css.opciones}><legend>¿Se resolvió?</legend>{RESULTADOS.map(r=><label key={r} className={css.opcion}><input type="radio" name={item.id+'-resultado'} value={r} checked={outcome===r} onChange={()=>setOutcome(r)} disabled={busy}/>{RESULTADO_TXT[r]}</label>)}</fieldset>
   <Campo id={item.id+'-rs-note'} etiqueta="Nota del resultado (obligatoria)" ayuda={'Qué pasó y cómo lo sabes (mínimo '+MIN_COMENTARIO+' caracteres).'}><textarea id={item.id+'-rs-note'} required minLength={MIN_COMENTARIO} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/></Campo>
   <p className={css.rotulo}>Si la intervención ya tiene una medición con datos de dos periodos, se adjuntará la comparación antes/después como <strong>asociación temporal, no causa</strong>. Si no, solo queda tu nota: no se inventa ningún efecto.</p>
   <Faltan errores={errores}/>
  </div>
 </Drawer>;
}

/** EN CURSO: confirmación simple. */
export function IniciarBoton({item,busy,operate}:{item:Recommendation;busy:boolean;operate:Operacion}){
 const clave=useClave(item.id+':'+item.version+':start');
 return <div className={css.peligro}><ConfirmationDialog triggerLabel="Marcar en curso" title="¿Marcar como en curso?" description="Indica que el trabajo ya empezó. Queda en la línea de tiempo con tu nombre y la fecha." confirmLabel="Sí, está en curso" disabled={busy} onConfirm={async()=>{await operate('/api/recommendations/'+item.id+'/flow',{operation:'start',expectedVersion:item.version,requestKey:clave()});}}/></div>;
}
