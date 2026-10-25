'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CorridaIA,EstadoIA,LecturaIA} from '../../../../../packages/workspace-service/pain-points-ia.d.mts';
import {Button} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Notice} from '../ui/notice';
import {ErrorState} from '../ui/error-state';
import {RovaqCargando} from '../rovaq-cargando';
import {useJson} from '../ui/use-json';
import {invalidarSwr} from '../../lib/workspace/swr.mjs';

const acepta=(j:unknown)=>{const d=(j as {data?:EstadoIA})?.data;return d&&typeof d==='object'&&'presupuesto' in d&&'roles' in d?d:null;};
/** Micro-USD → «US$1.25» (siempre dos decimales; el tope es de US$5.00 por semana y organización). */
export const usdIA=(micro:number)=>'US$'+(Math.max(0,Math.round(micro/10_000))/100).toFixed(2);
const SEV:Record<string,string>={baja:'Severidad baja',media:'Severidad media',alta:'Severidad alta',desconocida:'Severidad desconocida'};
const SEV_TONO:Record<string,string>={baja:'ok',media:'warn',alta:'bad',desconocida:'info'};
const ESTADO_CONSENSO:Record<string,string>={acuerdo:'Las tres lecturas coinciden',acuerdo_parcial:'Acuerdo parcial',desacuerdo:'Las lecturas se contradicen',incompleto:'Consenso incompleto',sin_lecturas:'Sin lecturas válidas'};
const MOTIVO:Record<string,string>={json_invalido:'el modelo no respondió con un formato válido',severidad_invalida:'la respuesta no tenía una severidad válida',confianza_invalida:'la confianza no era válida',forma_invalida:'la respuesta no tenía la forma pedida',categoria_invalida:'la categoría no era válida',propuesta_invalida:'la propuesta no era válida',pii_en_salida:'la respuesta traía datos personales y se descartó',monto_no_sustentado:'citaba una cifra que no estaba en la evidencia y se descartó',proveedor_sin_respuesta:'el proveedor no respondió a tiempo'};
const ERRORES:Record<string,string>={ia_apagada:'El análisis de IA está apagado en este entorno.',pii_blocked:'Se bloqueó el envío: la evidencia parecía contener datos personales. No se llamó a la IA ni se gastó nada.',pain_point_sin_dato:'Este punto no tiene cifras que analizar todavía.',role_insufficient:'Tu rol no puede pedir análisis de IA.',ia_no_migrada:'La lectura de IA aún no está disponible en la base de datos.'};
const ROL_TXT:Record<string,string>={causa_raiz:'Causa raíz',impacto:'Impacto económico',accion:'Acción recomendada'};
const fecha=(iso:string)=>new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short'});

function Tarjeta({id,nombre,pregunta,lectura}:{id:string;nombre:string;pregunta:string;lectura?:LecturaIA}){
 const c=lectura?.estado==='ok'?lectura.contenido:null;
 return <article className="pp-ia-card" data-rol={id} aria-label={nombre}>
  <header><h4>{nombre}</h4>{c?.severidad&&<span className="pp-ia-sev" data-tono={SEV_TONO[c.severidad]}>{SEV[c.severidad]}</span>}</header>
  <p className="pp-ia-q">{pregunta}</p>
  {c?<>
   <p className="pp-ia-txt">{c.lectura}</p>
   {c.categoria&&<p className="pp-ia-meta">Categoría: <b>{c.categoria.replace('_',' ')}</b></p>}
   {c.puntos&&c.puntos.length>0&&<ul className="pp-lista">{c.puntos.map((t,i)=><li key={i}>{t}</li>)}</ul>}
   {c.propuesta&&<div className="pp-ia-prop"><b>Propuesta: {c.propuesta.titulo}</b><ol className="pp-lista">{c.propuesta.pasos.map((t,i)=><li key={i}>{t}</li>)}</ol><p className="pp-ia-meta">Evidencia: {c.propuesta.evidencia}</p><p className="pp-ia-meta"><b>No se ejecuta nada hasta que una persona lo ordene.</b></p></div>}
   {c.supuestos&&c.supuestos.length>0&&<p className="pp-ia-meta">Supone: {c.supuestos.join('; ')}</p>}
   <footer>Confianza declarada {Math.round((c.confianza??0)*100)} %</footer>
  </>:lectura?<p className="pp-ia-fallo">Esta lectura no se pudo usar: {MOTIVO[lectura.motivoInvalido??'']??'respuesta no válida'}. Vuelve a analizar para reintentarla.</p>
   :<p className="pp-ia-vacia">Sin lectura todavía.</p>}
 </article>;
}

function Resultado({corrida}:{corrida:CorridaIA}){
 const k=corrida.consenso;
 return <>
  <div className="pp-ia-consenso" data-tono={k.tono} role="group" aria-label="Consenso de las tres lecturas">
   <div className="pp-ia-consenso-cab"><strong>{ESTADO_CONSENSO[k.estado]??k.estado}</strong>
    {k.confianza!=null&&<span className="pp-ia-conf" title="Baja si las lecturas discrepan o falta alguna. Nunca pasa de 85 %: es una inferencia.">Confianza {Math.round(k.confianza*100)} %</span>}</div>
   <p>{k.motivo}{k.severidad?` Severidad conjunta: ${k.severidad}.`:k.rango?` Van de ${k.rango[0]} a ${k.rango[1]}.`:''}</p>
   {k.discrepancias.length>0&&<ul className="pp-lista">{k.discrepancias.map(d=><li key={d.rol}>{ROL_TXT[d.rol]??d.rol}: {d.severidad}</li>)}</ul>}
  </div>
 </>;
}

/** «Lectura de IA» del drawer: tres tarjetas + consenso. Siempre rotulada Inferido; solo propone, nunca ejecuta. Sin botón «Actualizar»: «Analizar» corre (o completa) el análisis y respeta el tope semanal. */
export function LecturaIA({puntoId}:{puntoId:string}){
 const base='/api/pain-points/'+encodeURIComponent(puntoId)+'/ia';
 const e=useJson<EstadoIA>(base,acepta);
 const [post,setPost]=useState<EstadoIA|null>(null),[corriendo,setCorriendo]=useState(false),[aviso,setAviso]=useState<string|null>(null);
 const ctl=useRef<AbortController|null>(null);
 useEffect(()=>{setPost(null);setAviso(null);},[puntoId]);
 useEffect(()=>()=>ctl.current?.abort(),[]);
 const analizar=useCallback(async()=>{
  ctl.current?.abort();const c=new AbortController();ctl.current=c;setCorriendo(true);setAviso(null);
  try{
   const r=await fetch(base,{method:'POST',cache:'no-store',signal:c.signal});const j=await r.json().catch(()=>null);
   if(!r.ok){setAviso(ERRORES[(j as {error?:{code?:string}})?.error?.code??'']??'No se pudo analizar ahora. No se perdió nada: reintenta en un momento.');return;}
   const d=acepta(j);if(!d)throw Error();setPost(d);invalidarSwr({prefijo:base});
  }catch{if(!c.signal.aborted)setAviso('No se pudo analizar ahora. No se perdió nada: reintenta en un momento.');}
  finally{if(!c.signal.aborted)setCorriendo(false);}
 },[base]);
 if(!e.data&&!post&&e.busy)return <RovaqCargando compacto mensaje=""/>;
 const d=post??e.data;
 if(!d)return <ErrorState compact title="Lectura de IA no disponible ahora" body="No significa que no haya análisis guardados: reintenta en un momento." onRetry={()=>e.reload()}/>;
 const p=d.presupuesto,corrida=d.actual??d.ultima,esUltima=!d.actual&&Boolean(d.ultima);
 const alDia=!esUltima&&corrida?.estado==='completo';
 const puede=d.puedeAnalizar!==false&&d.habilitada&&!d.topeAlcanzado&&!alDia;
 const r=d.resultado;
 return <div className="pp-ia">
  <div className="pp-ia-cab">
   <div className="pp-ia-estado">
    <KindBadge kind="inferred"/>
    <span className="pp-ia-gasto" data-tope={d.topeAlcanzado||undefined}>{usdIA(p.usedMicro)} de {usdIA(p.topeMicro)} <small>usados esta semana · quedan {usdIA(p.remainingMicro)}</small></span>
   </div>
   <Button variant="primary" size="sm" loading={corriendo} disabled={!puede} onClick={analizar} title={!d.habilitada?'El análisis de IA está apagado en este entorno':d.topeAlcanzado?'Tope semanal de IA alcanzado':alDia?'Las tres lecturas de este corte ya están guardadas':undefined}>{alDia?'Análisis al día':corrida&&!esUltima?'Completar análisis':'Analizar'}</Button>
  </div>
  {!d.habilitada&&<Notice tone="info" title="Análisis de IA apagado">Aquí solo se muestran lecturas ya guardadas. Encenderlo es una decisión de costo: tope de {usdIA(p.topeMicro)} por semana y organización.</Notice>}
  {d.topeAlcanzado&&<Notice tone="warn" title="Tope semanal de IA alcanzado">Se usaron {usdIA(p.usedMicro)} de {usdIA(p.topeMicro)}. {corrida?'Se muestra la última lectura guardada.':'Todavía no hay una lectura guardada de este punto.'} El tope se renueva el lunes (UTC).</Notice>}
  {aviso&&<Notice tone="warn">{aviso}</Notice>}
  {r?.enCurso&&<Notice tone="info">Ya hay un análisis de este punto en curso. Espera a que termine.</Notice>}
  {r&&!r.tope&&!r.enCurso&&r.reutilizado&&<Notice tone="info">Este punto ya tenía las tres lecturas para este corte: no se volvió a llamar a la IA ni se cobró.</Notice>}
  {r&&r.tope&&r.nuevas>0&&<Notice tone="warn" title="Análisis incompleto">El tope semanal se alcanzó a mitad: se guardaron {r.nuevas} lectura(s). El consenso es parcial y su confianza baja.</Notice>}
  {esUltima&&corrida&&<Notice tone="info">Última lectura guardada, de otro corte ({corrida.corte.slice(0,10)}, {fecha(corrida.actualizadoEn)}). Puede no reflejar los datos de hoy.</Notice>}
  {corrida?<>
   <Resultado corrida={corrida}/>
   <div className="pp-ia-cards">{d.roles.map(ro=><Tarjeta key={ro.id} id={ro.id} nombre={ro.nombre} pregunta={ro.pregunta} lectura={corrida.lecturas.find(l=>l.rol===ro.id)}/>)}</div>
  </>:<p className="pp-nota">Aún no hay lectura de IA de este punto. «Analizar» pide tres lecturas independientes (causa raíz, impacto económico y acción) sobre la evidencia sin datos personales y las compara.</p>}
  <p className="pp-nota">Inferido por IA a partir de evidencia redactada: no es un dato observado. Cifras en ingreso bruto (nunca margen), por moneda. La acción es solo una propuesta.</p>
 </div>;
}
