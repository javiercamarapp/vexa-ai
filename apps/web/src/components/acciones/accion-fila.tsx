'use client';
import {useRef,useState} from 'react';
import {useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import type {Recommendation,RecommendationList} from '../../../../../packages/recommendations/index.mjs';
import {accionesPermitidas,etapaActual} from '../../../../../packages/recommendations/flujo.mjs';
import {formatMinorUnits} from '../../lib/formato/dinero-pantalla.mjs';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {Citation} from '../ui/citation';
import {IdChip} from '../ui/id-chip';
import {Icon} from '../ui/icons';
import {Drawer} from '../ui/overlay';
import {WaitStatus} from '../ui/wait-status';
import {TituloAuto} from '../ui/titulo-auto';
import {nf} from '../ui/format';
import {ESPERA} from '../../lib/legibilidad/espera.mjs';
import {consultaFijada} from '../../lib/workspace/precalentar.mjs';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {textoLegible,etiquetaCausal,esDeGeneradorAnterior} from '../../lib/legibilidad/recomendaciones-vista.mjs';
import {persona,EtapasFlujo,LineaFlujo,type FlowItem} from '../recommendations/flujo-vista';
import {ProcederDrawer,AjustarDrawer,DescartarDrawer,ResultadoDrawer,IniciarBoton} from '../recommendations/flujo-acciones';
import {BorradoresDrawer} from '../recommendations/flujo-borradores';
import {BarraParte} from '../panel-comun/kpi-linea';
import css from '../recommendations/panel.module.css';
import './acciones.css';

export type Operation=(url:string,body:unknown)=>Promise<boolean>;
export type VistaAccion='por-decidir'|'en-curso'|'resultados';
const PRIO_TONO={critical:'bad',high:'warn',normal:'ok'} as const;
const CAUSAL:Record<string,Clave>={unassessed:'acc.cSinEvaluar',confirmed:'acc.cConfirmada',retracted:'acc.cRetractada',hypothesis:'acc.cHipotesis',candidate:'acc.cCandidata',supported:'acc.cConRespaldo',unsupported:'acc.cSinRespaldo',insufficient:'acc.cInsuficiente'};
const PRIO:Record<string,Clave>={critical:'acc.prioCritical',high:'acc.prioHigh',normal:'acc.prioNormal'};
const ETAPA:Record<string,Clave>={propuesta:'acc.etPropuesta',ajustada:'acc.etAjustada',aprobada:'acc.etAprobada',en_curso:'acc.etEnCurso',resultado:'acc.etResultado',descartada:'acc.etDescartada'};
const RESULT:Record<string,Clave>={yes:'acc.resSi',no:'acc.resNo',partial:'acc.resParcial'};
const fechaTxt=(v:string|null|undefined)=>{if(!v)return '—';const d=new Date(v.length===10?v+'T12:00:00Z':v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('es-MX',{day:'numeric',month:'short',timeZone:'UTC'});};
const pinned=(scope:Recommendation['scope'],snapshot:string,hash:string)=>consultaFijada(scope as never,snapshot,hash);

function Cifra({etiqueta,valor,pie,c}:{etiqueta:string;valor:string;pie:string;c?:number}){return <div className="ac-cifra" style={c?{['--cat' as string]:`var(--chart-${c})`}:undefined}><dt>{etiqueta}</dt><dd>{valor}</dd><small>{pie}</small></div>;}

/** Una acción en una FILA compacta. Por decidir: evidencia, dinero en juego y Proceder / Ajustar / Descartar. En curso: etapa, responsable, compromiso y borradores.
 *  Resultados: respuesta, comparación antes/después solo con dato observado. Descartadas: motivo y Reabrir (historial reversible: cada cambio es un evento nuevo). */
export function AccionFila({item,members,busy,conflict,operate,vista,descartada=false,flowAvailable,onRegenerate}:{item:FlowItem;members:RecommendationList['members'];busy:boolean;conflict:boolean;operate:Operation;vista:VistaAccion;descartada?:boolean;flowAvailable:boolean;onRegenerate?:(problemId:string)=>void}){
 const t=useT();
 const [action,setAction]=useState(item.action),[conditions,setConditions]=useState(item.preconditions.join('\n')),[rationale,setRationale]=useState(item.rationale),[owner,setOwner]=useState(item.ownerId??''),[reason,setReason]=useState(''),[stateReason,setStateReason]=useState(''),[evidence,setEvidence]=useState(false),[edit,setEdit]=useState(false),[full,setFull]=useState<Recommendation|null>(item.verification==='full'?item:null),[openState,setOpenState]=useState<'idle'|'loading'|'unavailable'|'error'>('idle');
 const draftKey=useRef<string|null>(null),locked=busy||conflict||!item.canMutate,endpoint='/api/recommendations/'+item.id;
 const create=()=>{draftKey.current??=crypto.randomUUID();void operate(endpoint+'/interventions',{expectedVersion:item.version,requestKey:draftKey.current});};
 const evidenceQuery=pinned(item.scope,item.snapshotId,item.scopeHash);evidenceQuery.set('detail_hash',item.detailHash);
 const eventos=item.flow?.events??[],etapa=etapaActual(item,eventos),permisos=accionesPermitidas({item,eventos,rol:item.flow?.role,flujoDisponible:flowAvailable}),[abierto,setAbierto]=useState<''|'proceder'|'ajustar'|'descartar'|'reabrir'|'resultado'|'borradores'>('');
 const bloqueo=(etapa==='propuesta'||etapa==='ajustada')?permisos.proceder.motivo:null,decide=item.flow?.role!=='viewer'&&!!item.flow,conFlujo=flowAvailable&&!!item.flow,cierra=()=>setAbierto('');
 const openEvidence=()=>{setEvidence(true);if(full||openState==='loading')return;setOpenState('loading');const corte=new AbortController(),tm=window.setTimeout(()=>corte.abort(),45000);void fetchCupo(endpoint,{cache:'no-store',signal:corte.signal}).then(async r=>{if(r.status===403||r.status===404){setOpenState('unavailable');return;}if(!r.ok)throw Error('x');const j=await r.json();if(!j.data||j.data.id!==item.id)throw Error('x');setFull(j.data as Recommendation);setOpenState('idle');}).catch(()=>setOpenState('error')).finally(()=>window.clearTimeout(tm));};
 const close=(ok:Promise<boolean>)=>{void ok.then(saved=>{if(saved)setEdit(false);});};
 const aprobada=eventos.find(e=>e.kind==='approved'),resuelta=eventos.find(e=>e.kind==='resolved');
 const prioKey=(item.priority in PRIO_TONO?item.priority:'normal') as keyof typeof PRIO_TONO,titulo=etiquetaCategoria(item.title);
 const motivoDescarte=descartada?[...(item.history??[])].sort((a,b)=>b.version-a.version).find(h=>h.status==='dismissed')?.reason:null;
 const cmp=resuelta?.comparison??null,fmt=(v:string)=>cmp?formatMinorUnits(v,cmp.moneda,cmp.exponente):v,mx=cmp?Math.max(Math.abs(Number(cmp.antesMinor)),Math.abs(Number(cmp.despuesMinor)),1):1;
 const resp=conFlujo&&(aprobada?.ownerId??item.ownerId)?persona(aprobada?.ownerId??item.ownerId,members):t('acc.sinAsignar');
 return <article className="ac-fila" data-vista={vista} data-prio={prioKey} data-descartada={descartada||undefined} aria-label={t('acc.fila',{titulo})}>
  <div className="ac-main">
   <div className="ac-linea"><span className="pc-estado" data-tono={descartada?'off':PRIO_TONO[prioKey]}>{descartada?t('acc.descartada'):PRIO[item.priority]?t(PRIO[item.priority]):item.priority}</span>{conFlujo&&!descartada&&<span className="ac-etapa">{ETAPA[etapa]?t(ETAPA[etapa]):etapa} · v{item.version}</span>}{item.stale&&<span className="pc-estado" data-tono="warn">{t('acc.evCambio')}</span>}</div>
   <h3 className="ac-t">{titulo}</h3>
   <TituloAuto problemId={item.problemId} label={item.title}/>
   <p className="ac-a">{textoLegible(item.action)}</p>
   {vista==='por-decidir'&&!descartada&&<p className="ac-w"><b>{t('acc.porQue')}</b> {textoLegible(item.rationale)}</p>}
   {descartada&&motivoDescarte&&<p className="ac-w"><b>{t('acc.motivo')}</b> {textoLegible(motivoDescarte)}</p>}
   {vista==='en-curso'&&aprobada?.comment&&<p className="ac-w"><b>{t('acc.alAprobar')}</b> {textoLegible(aprobada.comment)}</p>}
   {vista==='resultados'&&resuelta&&<p className="ac-w"><span className="pc-estado" data-tono={resuelta.outcome==='yes'?'ok':resuelta.outcome==='partial'?'warn':'bad'}>{RESULT[resuelta.outcome??'']?t(RESULT[resuelta.outcome??'']):resuelta.outcome}</span> {textoLegible(resuelta.note??'')} <i>{t('acc.lasEscribioPersona')}</i></p>}
  </div>
  {vista==='por-decidir'&&!descartada&&<dl className="ac-cifras" aria-label={t('acc.evidAria')}>
   <Cifra etiqueta={t('acc.citas')} valor={nf.format(item.evidenceCount)} pie={t('acc.verifGuardar')} c={6}/>
   <Cifra etiqueta={t('acc.version')} valor={'v'+item.version} pie={item.history.length>1?t('acc.enHistorial',{n:nf.format(item.history.length)}):t('acc.sinAjustes')}/>
   <Cifra etiqueta={t('acc.causa')} valor={CAUSAL[item.causalState]?t(CAUSAL[item.causalState]):etiquetaCausal(item.causalState)} pie={t('acc.noDemuestra')}/>
  </dl>}
  {vista==='en-curso'&&<div className="ac-curso">{conFlujo&&<EtapasFlujo etapa={etapa}/>}
   <dl className="ac-datos"><div><dt>{t('acc.responsable')}</dt><dd>{resp}</dd></div><div><dt>{t('acc.compromiso')}</dt><dd>{fechaTxt(aprobada?.dueDate)}</dd></div><div><dt>{t('acc.borradores')}</dt><dd>{item.drafts.length>0?nf.format(item.drafts.length):'—'}</dd></div></dl></div>}
  {vista==='resultados'&&!descartada&&<div className="ac-cmp" aria-label={t('acc.antesDespues')}>{cmp?<><BarraParte etiqueta={t('acc.antes')} valor={Math.abs(Number(cmp.antesMinor))} max={mx} c={5} fin={fmt(cmp.antesMinor)}/><BarraParte etiqueta={t('acc.despues')} valor={Math.abs(Number(cmp.despuesMinor))} max={mx} c={6} estado={cmp.completa?'real':'parcial'} fin={fmt(cmp.despuesMinor)}/><small>{cmp.completa?t('acc.ingresoObs'):t('acc.medIncompleta')}</small></>:<><div className="pc-pista" data-vacio role="img" aria-label={t('acc.sinMedAria')}/><small>{t('acc.sinMedTxt')}</small></>}</div>}
  {vista==='por-decidir'&&!descartada&&<div className="ac-dinero"><span className="ac-et">{t('acc.dineroEnJuego')}</span><strong data-vacio>—</strong><small>{t('acc.sinImporte')}</small><span className="ac-et">{t('acc.responsable')}</span><b>{conFlujo&&item.ownerId?persona(item.ownerId,members):t('acc.sinAsignar')}</b></div>}
  <div className="ac-botones">
   {conFlujo&&decide&&(etapa==='propuesta'||etapa==='ajustada')&&<div className="ac-grupo" role="group" aria-label={t('acc.decidirAria')}><Button size="sm" variant="primary" disabled={!permisos.proceder.permitido||busy||conflict} onClick={()=>setAbierto('proceder')}>{t('acc.proceder')}</Button><Button size="sm" variant="secondary" disabled={!permisos.ajustar.permitido||busy||conflict} onClick={()=>setAbierto('ajustar')}>{t('acc.ajustar')}</Button><Button size="sm" variant="ghost" disabled={!permisos.descartar.permitido||busy||conflict} onClick={()=>setAbierto('descartar')}>{t('acc.descartar')}</Button></div>}
   {conFlujo&&decide&&(etapa==='aprobada'||etapa==='en_curso')&&<div className="ac-grupo"><Button size="sm" variant="secondary" onClick={()=>setAbierto('borradores')}>{t('acc.verBorradores')}</Button>{permisos.iniciar.permitido&&<IniciarBoton item={item} busy={busy||conflict} operate={operate}/>}{permisos.resultado.permitido&&<Button size="sm" variant="primary" disabled={busy||conflict} onClick={()=>setAbierto('resultado')}>{t('acc.registrarRes')}</Button>}</div>}
   {conFlujo&&decide&&etapa==='resultado'&&<Button size="sm" variant="ghost" onClick={()=>setAbierto('borradores')}>{t('acc.verBorradores')}</Button>}
   {conFlujo&&decide&&etapa==='descartada'&&<Button size="sm" variant="secondary" disabled={busy||conflict||!item.canMutate} onClick={()=>setAbierto('reabrir')}>{t('acc.reabrir')}</Button>}
   {!conFlujo&&item.canMutate&&item.status==='proposed'&&<Button size="sm" variant="primary" disabled={locked||item.drafts.length>0} onClick={create}>{t('acc.crearBorrador')}</Button>}
   <div className="ac-grupo"><Button size="sm" variant="ghost" icon={<Icon name="eye" size={14}/>} onClick={openEvidence}>{t('acc.evidenciaN',{n:item.evidenceCount})}</Button>{!conFlujo&&item.canMutate&&<Button size="sm" variant="ghost" icon={<Icon name="settings" size={14}/>} onClick={()=>setEdit(true)}>{t('acc.editar')}</Button>}</div>
   {bloqueo&&<p className="ac-bloqueo" role="note">{bloqueo}</p>}
  </div>
  {(conFlujo&&(eventos.length>0||item.history.length>1))&&<div className="ac-pie"><LineaFlujo item={item} miembros={members}/></div>}
  {item.drafts.length>0&&vista!=='por-decidir'&&<div className="ac-pie ac-drafts" aria-label={t('acc.intervGuardada')}>{item.drafts.map(d=><span key={d.id} className="ac-draft"><span>{d.hypothesis}</span><LinkButton href={'/interventions?vista=en-curso&'+pinned(item.scope,item.snapshotId,item.scopeHash).toString()+'#intervention-'+d.id} size="sm" variant="ghost" icon={<Arrow/>}>{t('acc.abrirInterv')}</LinkButton></span>)}</div>}
  {item.stale&&<p className="ac-pie ac-nota" role="status">{t('acc.stale')}</p>}
  {onRegenerate&&esDeGeneradorAnterior(item)&&<p className="ac-pie ac-nota" role="note">{t('acc.genAnterior')} <Button size="sm" variant="ghost" disabled={busy||conflict} onClick={()=>onRegenerate(item.problemId)}>{t('acc.regenerar')}</Button> {t('acc.regenNota')}</p>}
  {conFlujo&&!decide&&<p className="ac-pie ac-nota">{t('acc.soloConsultar')}</p>}
  {conFlujo&&decide&&<>
   <ProcederDrawer open={abierto==='proceder'} onClose={cierra} item={item} miembros={members} busy={busy||conflict} operate={operate}/>
   <AjustarDrawer open={abierto==='ajustar'} onClose={cierra} item={item} miembros={members} busy={busy||conflict} operate={operate} prioridad={item.priority}/>
   <DescartarDrawer open={abierto==='descartar'||abierto==='reabrir'} reabrir={abierto==='reabrir'} onClose={cierra} item={item} busy={busy||conflict} operate={operate}/>
   <ResultadoDrawer open={abierto==='resultado'} onClose={cierra} item={item} busy={busy||conflict} operate={operate}/>
   <BorradoresDrawer open={abierto==='borradores'} onClose={cierra} item={item} miembros={members}/>
  </>}
  <Drawer open={evidence} onClose={()=>setEvidence(false)} width={420} title={titulo} subtitle={t('acc.drawerSub')} footer={<LinkButton href={'/problems/'+item.problemId+'?'+evidenceQuery.toString()} size="sm" variant="primary" icon={<Arrow/>}>{t('acc.verProblema')}</LinkButton>}>
   <div className="stack">
    <p className="card-lead">{textoLegible(item.rationale)}</p>
    <p className="card-lead">{t('acc.noCausalidad')}</p>
    <details className={css.fold}><summary>{t('acc.condiciones',{n:item.preconditions.length})}</summary><ul>{item.preconditions.map((v,i)=><li key={i}>{textoLegible(v)}</li>)}</ul></details>
    <section><h3>{t('acc.evidRec',{n:full?full.evidenceRefs.length:item.evidenceCount})}</h3>{openState==='loading'&&<WaitStatus {...ESPERA.evidencia}/>}{openState==='unavailable'&&<p className="state state-error" role="alert">{t('acc.evidNoDisp')}</p>}{openState==='error'&&<p className="state state-error" role="alert">{t('acc.evidError')} <Button size="sm" icon={<Refresh/>} onClick={openEvidence}>{t('acc.reintentar')}</Button></p>}{full&&full.evidenceRefs.map((e,i)=><Citation key={e.runId+':'+e.messageRevisionId+':'+i} quote={e.quote} role={e.role} category={e.category} messageRevisionId={e.messageRevisionId}/>)}</section>
    <div className="meta-row"><span className="chip">{t('acc.problemaV',{n:item.problemVersion})}</span><IdChip value={item.snapshotId} label={t('acc.publicacion')}/><IdChip value={item.scopeHash} label={t('acc.alcance')}/></div>
    <details><summary>{t('acc.historialVer',{n:item.history.length})}</summary><ol>{item.history.map(v=><li key={v.version}><strong>v{v.version} · {v.status==='dismissed'?t('acc.vDescartada'):t('acc.vPropuesta')}</strong><p>{v.action}</p><p>{v.reason}</p><p>{t('acc.respLinea',{r:v.ownerId??t('acc.sinAsignar'),a:v.actorId})}<time>{v.createdAt}</time></p></li>)}</ol></details>
   </div>
  </Drawer>
  {item.canMutate&&!conFlujo&&<Drawer open={edit} onClose={()=>setEdit(false)} width={560} title={t('acc.editarGestionar')} subtitle={titulo}>
   <div className="stack">
    <section><h3>{t('acc.revisarProp')}</h3><form className="action-form" aria-label={t('acc.revisarRec')} onSubmit={e=>{e.preventDefault();if(!locked)close(operate(endpoint,{operation:'revise',expectedVersion:item.version,action,preconditions:conditions.split(/\r?\n/).map(v=>v.trim()).filter(Boolean),rationale,ownerId:owner||null,reason}));}}>
     <label htmlFor={item.id+'-action'}>{t('acc.accionProp')}</label><textarea id={item.id+'-action'} required minLength={20} maxLength={2000} value={action} onChange={e=>setAction(e.target.value)} disabled={busy}/>
     <label htmlFor={item.id+'-conditions'}>{t('acc.condPrevias')}</label><textarea id={item.id+'-conditions'} required value={conditions} onChange={e=>setConditions(e.target.value)} disabled={busy}/>
     <label htmlFor={item.id+'-rationale'}>{t('acc.justif')}</label><textarea id={item.id+'-rationale'} required minLength={20} maxLength={4000} value={rationale} onChange={e=>setRationale(e.target.value)} disabled={busy}/>
     <label htmlFor={item.id+'-owner'}>{t('acc.respRec')}</label><select id={item.id+'-owner'} value={owner} onChange={e=>setOwner(e.target.value)} disabled={busy}><option value="">{t('acc.sinAsignar')}</option>{members.map(m=><option key={m.id} value={m.id}>{m.id} · {m.role}</option>)}</select>
     <label htmlFor={item.id+'-reason'}>{t('acc.razonCambio')}</label><textarea id={item.id+'-reason'} required minLength={20} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/>
     <div className="btn-group"><Button type="submit" variant="primary" size="sm" disabled={locked}>{t('acc.guardarRev')}</Button></div>
    </form></section>
    <details className={css.fold}><summary>{item.status==='dismissed'?t('acc.reabrirLa'):t('acc.descartarLa')} {t('acc.laRec')}</summary><form className="action-form" aria-label={t('acc.cambiarEstado')} onSubmit={e=>{e.preventDefault();if(!locked)close(operate(endpoint,{operation:'state',expectedVersion:item.version,status:item.status==='dismissed'?'proposed':'dismissed',reason:stateReason}));}}>
     <label htmlFor={item.id+'-state-reason'}>{t('acc.razonEstado')}</label><textarea id={item.id+'-state-reason'} required minLength={20} maxLength={2000} value={stateReason} onChange={e=>setStateReason(e.target.value)} disabled={busy}/>
     <div className="btn-group"><Button type="submit" size="sm" disabled={locked}>{item.status==='dismissed'?t('acc.reabrirRec'):t('acc.descartarRec')}</Button></div>
    </form></details>
   </div>
  </Drawer>}
 </article>;
}
