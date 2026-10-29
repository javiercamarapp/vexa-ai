'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CorridaIA,EstadoIA,LecturaIA} from '../../../../../packages/workspace-service/pain-points-ia.d.mts';
import {useIdioma,useT} from '../i18n/proveedor';
import {diaMes} from '../../lib/formato/idioma.mjs';
import type {Clave} from '../../lib/i18n';
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
const SEV:Record<string,Clave>={baja:'tr.pp.sevBaja',media:'tr.pp.sevMedia',alta:'tr.pp.sevAlta',desconocida:'tr.pp.sevDesconocida'};
const SEV_TONO:Record<string,string>={baja:'ok',media:'warn',alta:'bad',desconocida:'info'};
const ESTADO_CONSENSO:Record<string,Clave>={acuerdo:'tr.pp.consAcuerdo',acuerdo_parcial:'tr.pp.consParcial',desacuerdo:'tr.pp.consDesacuerdo',incompleto:'tr.pp.consIncompleto',sin_lecturas:'tr.pp.consSin'};
const MOTIVO:Record<string,Clave>={json_invalido:'tr.pp.mJson',severidad_invalida:'tr.pp.mSeveridad',confianza_invalida:'tr.pp.mConfianza',forma_invalida:'tr.pp.mForma',categoria_invalida:'tr.pp.mCategoria',propuesta_invalida:'tr.pp.mPropuesta',pii_en_salida:'tr.pp.mPii',monto_no_sustentado:'tr.pp.mMonto',proveedor_sin_respuesta:'tr.pp.mProveedor'};
const ERRORES:Record<string,Clave>={ia_apagada:'tr.pp.eApagada',pii_blocked:'tr.pp.ePii',pain_point_sin_dato:'tr.pp.eSinDato',role_insufficient:'tr.pp.eRol',ia_no_migrada:'tr.pp.eNoMigrada'};
const ROL_TXT:Record<string,Clave>={causa_raiz:'tr.pp.rolCausa',impacto:'tr.pp.rolImpacto',accion:'tr.pp.rolAccion'};
const fecha=(iso:string,idioma:string)=>diaMes(iso,idioma,{largo:false})??'';

function Tarjeta({id,nombre,pregunta,lectura}:{id:string;nombre:string;pregunta:string;lectura?:LecturaIA}){
 const t=useT(),c=lectura?.estado==='ok'?lectura.contenido:null;
 return <article className="pp-ia-card" data-rol={id} aria-label={nombre}>
  <header><h4>{nombre}</h4>{c?.severidad&&<span className="pp-ia-sev" data-tono={SEV_TONO[c.severidad]}>{SEV[c.severidad]?t(SEV[c.severidad]):c.severidad}</span>}</header>
  <p className="pp-ia-q">{pregunta}</p>
  {c?<>
   <p className="pp-ia-txt">{c.lectura}</p>
   {c.categoria&&<p className="pp-ia-meta">{t('tr.pp.categoriaL')} <b>{c.categoria.replace('_',' ')}</b></p>}
   {c.puntos&&c.puntos.length>0&&<ul className="pp-lista">{c.puntos.map((t,i)=><li key={i}>{t}</li>)}</ul>}
   {c.propuesta&&<div className="pp-ia-prop"><b>{t('tr.pp.propuestaT',{titulo:c.propuesta.titulo})}</b><ol className="pp-lista">{c.propuesta.pasos.map((t,i)=><li key={i}>{t}</li>)}</ol><p className="pp-ia-meta">{t('tr.pp.evidenciaDe',{x:c.propuesta.evidencia})}</p><p className="pp-ia-meta"><b>{t('tr.pp.noEjecuta')}</b></p></div>}
   {c.supuestos&&c.supuestos.length>0&&<p className="pp-ia-meta">{t('tr.pp.supone',{x:c.supuestos.join('; ')})}</p>}
   <footer>{t('tr.pp.confDeclarada',{n:Math.round((c.confianza??0)*100)})}</footer>
  </>:lectura?<p className="pp-ia-fallo">{t('tr.pp.lecturaNoUsable',{motivo:t(MOTIVO[lectura.motivoInvalido??'']??'tr.pp.mInvalida')})}</p>
   :<p className="pp-ia-vacia">{t('tr.pp.sinLectura')}</p>}
 </article>;
}

function Resultado({corrida}:{corrida:CorridaIA}){
 const t=useT(),k=corrida.consenso;
 return <>
  <div className="pp-ia-consenso" data-tono={k.tono} role="group" aria-label={t('tr.pp.consensoAria')}>
   <div className="pp-ia-consenso-cab"><strong>{ESTADO_CONSENSO[k.estado]?t(ESTADO_CONSENSO[k.estado]):k.estado}</strong>
    {k.confianza!=null&&<span className="pp-ia-conf" title={t('tr.pp.confTitulo',{max:85})}>{t('tr.pp.confN',{n:Math.round(k.confianza*100)})}</span>}</div>
   <p>{k.motivo}{k.severidad?t('tr.pp.sevConjunta',{x:k.severidad}):k.rango?t('tr.pp.vanDe',{a:k.rango[0],b:k.rango[1]}):''}</p>
   {k.discrepancias.length>0&&<ul className="pp-lista">{k.discrepancias.map(d=><li key={d.rol}>{ROL_TXT[d.rol]?t(ROL_TXT[d.rol]):d.rol}: {d.severidad}</li>)}</ul>}
  </div>
 </>;
}

/** «Lectura de IA» del drawer: tres tarjetas + consenso. Siempre rotulada Inferido; solo propone, nunca ejecuta. Sin botón «Actualizar»: «Analizar» corre (o completa) el análisis y respeta el tope semanal. */
export function LecturaIA({puntoId}:{puntoId:string}){return <LecturaPorPunto key={puntoId} puntoId={puntoId}/>;}
function LecturaPorPunto({puntoId}:{puntoId:string}){
 const t=useT(),idioma=useIdioma();
 const base='/api/pain-points/'+encodeURIComponent(puntoId)+'/ia';
 const e=useJson<EstadoIA>(base,acepta);
 const [post,setPost]=useState<EstadoIA|null>(null),[corriendo,setCorriendo]=useState(false),[aviso,setAviso]=useState<string|null>(null);
 const ctl=useRef<AbortController|null>(null);
 useEffect(()=>()=>ctl.current?.abort(),[]);
 const analizar=useCallback(async()=>{
  ctl.current?.abort();const c=new AbortController();ctl.current=c;setCorriendo(true);setAviso(null);
  try{
   const r=await fetch(base,{method:'POST',cache:'no-store',signal:c.signal});const j=await r.json().catch(()=>null);
   if(!r.ok){setAviso(t(ERRORES[(j as {error?:{code?:string}})?.error?.code??'']??'tr.pp.eNoAnalizo'));return;}
   const d=acepta(j);if(!d)throw Error();setPost(d);invalidarSwr({prefijo:base});
  }catch{if(!c.signal.aborted)setAviso(t('tr.pp.eNoAnalizo'));}
  finally{if(!c.signal.aborted)setCorriendo(false);}
 },[base,t]);
 if(!e.data&&!post&&e.busy)return <RovaqCargando compacto mensaje=""/>;
 const d=post??e.data;
 if(!d)return <ErrorState compact title={t('tr.pp.iaNoDisp')} body={t('tr.pp.iaNoDispBody')} onRetry={()=>e.reload()}/>;
 const p=d.presupuesto,corrida=d.actual??d.ultima,esUltima=!d.actual&&Boolean(d.ultima);
 const alDia=!esUltima&&corrida?.estado==='completo';
 const puede=d.puedeAnalizar!==false&&d.habilitada&&!d.topeAlcanzado&&!alDia;
 const r=d.resultado;
 return <div className="pp-ia">
  <div className="pp-ia-cab">
   <div className="pp-ia-estado">
    <KindBadge kind="inferred"/>
    <span className="pp-ia-gasto" data-tope={d.topeAlcanzado||undefined}>{t('tr.pp.gastoDe',{used:usdIA(p.usedMicro),tope:usdIA(p.topeMicro)})} <small>{t('tr.pp.usadosSemana',{rest:usdIA(p.remainingMicro)})}</small></span>
   </div>
   <Button variant="primary" size="sm" loading={corriendo} disabled={!puede} onClick={analizar} title={!d.habilitada?t('tr.pp.btnApagado'):d.topeAlcanzado?t('tr.pp.btnTope'):alDia?t('tr.pp.btnGuardadas'):undefined}>{alDia?t('tr.pp.btnAlDia'):corrida&&!esUltima?t('tr.pp.btnCompletar'):t('tr.pp.btnAnalizar')}</Button>
  </div>
  {!d.habilitada&&<Notice tone="info" title={t('tr.pp.apagadoT')}>{t('tr.pp.apagadoB',{tope:usdIA(p.topeMicro)})}</Notice>}
  {d.topeAlcanzado&&<Notice tone="warn" title={t('tr.pp.topeT')}>{t('tr.pp.topeB',{used:usdIA(p.usedMicro),tope:usdIA(p.topeMicro),x:corrida?t('tr.pp.topeUltima'):t('tr.pp.topeNinguna')})}</Notice>}
  {aviso&&<Notice tone="warn">{aviso}</Notice>}
  {r?.enCurso&&<Notice tone="info">{t('tr.pp.enCurso')}</Notice>}
  {r&&!r.tope&&!r.enCurso&&r.reutilizado&&<Notice tone="info">{t('tr.pp.reutilizado')}</Notice>}
  {r&&r.tope&&r.nuevas>0&&<Notice tone="warn" title={t('tr.pp.incompletoT')}>{t('tr.pp.incompletoB',{n:r.nuevas})}</Notice>}
  {esUltima&&corrida&&<Notice tone="info">{t('tr.pp.ultimaOtroCorte',{corte:corrida.corte.slice(0,10),fecha:fecha(corrida.actualizadoEn,idioma)})}</Notice>}
  {corrida?<>
   <Resultado corrida={corrida}/>
   <div className="pp-ia-cards">{d.roles.map(ro=><Tarjeta key={ro.id} id={ro.id} nombre={ro.nombre} pregunta={ro.pregunta} lectura={corrida.lecturas.find(l=>l.rol===ro.id)}/>)}</div>
  </>:<p className="pp-nota">{t('tr.pp.sinLecturaIA')}</p>}
  <p className="pp-nota">{t('tr.pp.notaIA')}</p>
 </div>;
}
