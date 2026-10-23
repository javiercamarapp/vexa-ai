'use client';
import type {CoverageSource,CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import {Button,Refresh} from './button';
import {KindBadge} from './kind-badge';
import {ProgressRing} from './progress-ring';
import {Popover} from './overlay';
import {Tip} from './tip';
import {Icon} from './icons';
import {EmptyState} from './empty-state';
import {SkeletonCards} from './skeletons';
import {LinkButton,Arrow} from './button';
import {nf,pct,fmtPct} from './format';
import {useJson} from './use-json';
const ICON:Record<string,string>={hubspot:'message',associations:'link',csv:'file',ledger:'database',excel:'columns',attachments:'file',zendesk:'message'};
const UNIT:Record<string,string>={associations:'hechos',ledger:'registros',excel:'filas vigentes'};
// Fecha en la zona horaria de quien mira (antes UTC: a las 8 p. m. de México mostraba «mañana»).
const when=(iso:string|null)=>iso?new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso)):null;
const META='Registros de HubSpot que solo traen metadatos (sin mensajes): no son conversaciones y no se pierden; su relación ticket–contacto se lee en Asociaciones.';
const DEF='Filas con conversación que las reglas de validación dejan fuera por un defecto real (cuerpo incompleto o rol ambiguo).';
const REJ='Filas que las reglas de validación dejan fuera por diseño; no son una falla de la carga.';
function Tile({s}:{s:CoverageSource}){
 const own=s.detail.length>0,share=pct(s.incorporated,s.total),seg=(n:number)=>s.total>0?n*100/s.total:0;
 const [head,...rest]=s.label.split(' (');
 const bd=s.rejectionBreakdown?.status==='ok'?s.rejectionBreakdown:null,reasons=bd?[bd.bodyIncomplete?`cuerpo incompleto ${nf.format(bd.bodyIncomplete)}`:'',bd.roleAmbiguous?`rol ambiguo ${nf.format(bd.roleAmbiguous)}`:'',bd.otherDefects?`otros motivos ${nf.format(bd.otherDefects)}`:''].filter(Boolean):[];
 const BASE=bd?`El porcentaje se calcula solo sobre las ${nf.format(bd.conversationRows??0)} filas con conversación: las ${nf.format(s.total)} filas leídas menos ${nf.format(bd.metadataOnly??0)} registros solo de metadatos.`:'';
 const ringShare=bd?bd.incorporatedShare:share;
 return <li className="cov-tile" data-source={s.key} data-loaded>
  <div className="cov-tile-head"><span className="stat-icon" aria-hidden="true"><Icon name={ICON[s.key]??'database'} size={15}/></span><div className="cov-tile-name"><strong title={s.label}>{head}</strong>{rest.length>0&&<small>{rest.join(' (').replace(/\)$/,'')}</small>}</div><KindBadge kind={s.class}/></div>
  {own?<>
   <div className="cov-big"><strong>{nf.format(s.incorporated)}</strong><span>{UNIT[s.key]??'filas'}</span></div>
   <p className="cov-meta">{s.detail[0]}</p>
   {s.detail.length>1&&<Popover label={'Más detalle de '+head} trigger={<>Más detalle</>} width={340}><ul className="cov-detail-list">{s.detail.slice(1).map((l,i)=><li key={i}>{l}</li>)}</ul></Popover>}
  </>:<>
   <div className="cov-ring-row"><ProgressRing value={ringShare===null?0:ringShare/100} size={52} stroke={6} label={ringShare===null?'—':Math.round(ringShare)+'%'} title={bd?`${head}: ${fmtPct(ringShare)} de las ${nf.format(bd.conversationRows??0)} filas con conversación está incorporado (excluye ${nf.format(bd.metadataOnly??0)} registros solo de metadatos, que no son conversaciones)`:`${head}: ${fmtPct(share)} de las filas leídas está incorporado; el resto son filas rechazadas por diseño o pendientes`}/><div className="cov-big"><strong>{nf.format(s.incorporated)}</strong><span>{bd?`de ${nf.format(bd.conversationRows??0)} filas con conversación`:`de ${nf.format(s.total)} filas`}</span></div></div>
   <div className="cov-track" role="img" aria-label={bd?`${head}: ${nf.format(s.incorporated)} conversaciones incorporadas, ${nf.format(bd.defects??0)} rechazadas con defecto, ${nf.format(bd.metadataOnly??0)} registros solo de metadatos, ${nf.format(s.pending)} pendientes, de ${nf.format(s.total)} filas leídas`:`${head}: ${nf.format(s.incorporated)} incorporadas, ${nf.format(s.rejected)} rechazadas por diseño, ${nf.format(s.pending)} pendientes, de ${nf.format(s.total)}`}>
    {s.incorporated>0&&<span className="cov-seg cov-in" style={{flexBasis:seg(s.incorporated)+'%'}}/>}
    {bd&&(bd.metadataOnly??0)>0&&<span className="cov-seg cov-metaonly" style={{flexBasis:Math.max(seg(bd.metadataOnly??0),1)+'%'}}/>}
    {(bd?(bd.defects??0):s.rejected)>0&&<span className="cov-seg cov-rej" style={{flexBasis:Math.max(seg(bd?(bd.defects??0):s.rejected),1)+'%'}}/>}
    {s.pending>0&&<span className="cov-seg cov-pen" style={{flexBasis:Math.max(seg(s.pending),1)+'%'}}/>}
   </div>
   {bd?<ul className="cov-legend" data-breakdown="hubspot"><li><i className="sw cov-in"/><Tip label={BASE}>Conversaciones incorporadas: {nf.format(s.incorporated)}</Tip></li><li><i className="sw cov-rej"/><Tip label={DEF}>Rechazadas con defecto: {nf.format(bd.defects??0)}{reasons.length>0&&` (${reasons.join(' · ')})`}</Tip></li><li><i className="sw cov-metaonly"/><Tip label={META}>Registros solo de metadatos (sin mensajes): {nf.format(bd.metadataOnly??0)} — no son conversaciones perdidas</Tip></li><li><i className="sw cov-pen"/>{nf.format(s.pending)} pendientes</li></ul>
   :<ul className="cov-legend"><li><i className="sw cov-in"/>{nf.format(s.incorporated)} incorporadas</li><li><i className="sw cov-rej"/><Tip label={REJ}>{nf.format(s.rejected)} rechazadas por diseño</Tip></li><li><i className="sw cov-pen"/>{nf.format(s.pending)} pendientes</li></ul>}
   {s.key==='hubspot'&&s.rejectionBreakdown?.status==='unavailable'&&<p className="cov-meta" role="status">Desglose de rechazadas por motivo: No disponible ahora.</p>}
   {s.rejectionNote&&<p className="cov-meta cov-rej-note">{s.rejectionNote}</p>}
   <p className="cov-meta">{s.imports} {s.imports===1?'importación':'importaciones'}{s.openImports>0?` · ${s.openImports} ${s.openImports===1?'sigue procesándose':'siguen procesándose'}`:''}{when(s.lastUpdate)?' · '+when(s.lastUpdate):''}</p>
  </>}
 </li>;
}
/** Which part of the historical information is incorporated, per source: exact counts, class label, rejected-by-design in neutral grey. */
export function CoverageBand({endpoint='/api/coverage'}:{endpoint?:string}){
 const {data:view,error,busy,reload}=useJson<CoverageView>(endpoint,j=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;});
 const loaded=view?.sources.filter(s=>s.loaded)??[],unavailable=view?.sources.filter(s=>s.status==='timeout')??[],empty=view?.sources.filter(s=>!s.loaded&&s.status!=='timeout')??[];
 return <section className="card coverage" aria-labelledby="coverage-title" aria-busy={busy}>
  <div className="card-title"><div><h2 id="coverage-title">Información incorporada</h2>{view&&<p>{loaded.length} de {view.sources.length} fuentes con datos cargados · cifras exactas por fuente</p>}</div></div>
  {busy&&!view&&<SkeletonCards count={3}/>}
  {error&&<div className="notice-bar" role="alert"><Icon name="info" size={14}/><span>{error}</span><Button size="sm" icon={<Refresh/>} onClick={reload}>Reintentar cobertura</Button></div>}
  {view&&<>
   {loaded.length===0?<EmptyState art="plug" compact title="Aún no hay datos cargados" body="Conecta una fuente o importa un archivo para ver aquí cuánto está incorporado." action={<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>Importar datos</LinkButton>}/>
    :<ul className="cov-grid">{loaded.map(s=><Tile key={s.key} s={s}/>)}</ul>}
   {empty.length>0&&<p className="cov-missing"><span className="cov-missing-label"><i className="sw sw-empty"/>Sin cargar</span>{empty.map(s=><span className="chip" key={s.key} title="Aún no hay datos de esta fuente; su tamaño no se estima.">{s.label}</span>)}</p>}
   {unavailable.length>0&&<p className="cov-missing" role="status"><span className="cov-missing-label">No disponible ahora</span>{unavailable.map(s=><span className="chip" key={s.key} title="La consulta acotada superó el tiempo permitido; reintenta.">{s.label}</span>)}</p>}
   <details className="cov-table"><summary>Ver como tabla</summary><p className="card-lead">{view.note}</p><div className="table-wrap" tabIndex={0} role="region" aria-label="Cobertura por fuente"><table><thead><tr><th scope="col">Fuente</th><th scope="col" className="num">Filas</th><th scope="col" className="num">Incorporadas</th><th scope="col" className="num">Rechazadas</th><th scope="col" className="num">Pendientes</th></tr></thead><tbody>{view.sources.map(s=><tr key={s.key}><th scope="row">{s.label}</th><td className="num">{s.loaded?nf.format(s.total):s.status==='timeout'?'No disponible':'Sin cargar'}</td><td className="num">{s.loaded?nf.format(s.incorporated):'—'}</td><td className="num">{s.loaded?nf.format(s.rejected):'—'}</td><td className="num">{s.loaded?nf.format(s.pending):'—'}</td></tr>)}</tbody></table></div></details>
  </>}
 </section>;
}
