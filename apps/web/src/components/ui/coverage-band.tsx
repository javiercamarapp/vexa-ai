'use client';
import {useLocaleIntl,useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
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
const UNIT:Record<string,Clave>={associations:'tr.ui.cbHechos',ledger:'tr.ui.cbRegistros',excel:'tr.ui.cbFilasVig'};
// Fecha en la zona horaria de quien mira (antes UTC: a las 8 p. m. de México mostraba «mañana»).
const when=(iso:string|null,loc:string)=>iso?new Intl.DateTimeFormat(loc,{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso)):null;
function Tile({s}:{s:CoverageSource}){
 const t=useT(),loc=useLocaleIntl();
 const own=s.detail.length>0,share=pct(s.incorporated,s.total),seg=(n:number)=>s.total>0?n*100/s.total:0;
 const [head,...rest]=s.label.split(' (');
 const bd=s.rejectionBreakdown?.status==='ok'?s.rejectionBreakdown:null,reasons=bd?[bd.bodyIncomplete?t('tr.ui.cbCuerpoInc',{n:nf.format(bd.bodyIncomplete)}):'',bd.roleAmbiguous?t('tr.ui.cbRolAmb',{n:nf.format(bd.roleAmbiguous)}):'',bd.otherDefects?t('tr.ui.cbOtros',{n:nf.format(bd.otherDefects)}):''].filter(Boolean):[];
 const BASE=bd?t('tr.ui.cbBase',{conv:nf.format(bd.conversationRows??0),total:nf.format(s.total),meta:nf.format(bd.metadataOnly??0)}):'';
 const ringShare=bd?bd.incorporatedShare:share;
 return <li className="cov-tile" data-source={s.key} data-loaded>
  <div className="cov-tile-head"><span className="stat-icon" aria-hidden="true"><Icon name={ICON[s.key]??'database'} size={15}/></span><div className="cov-tile-name"><strong title={s.label}>{head}</strong>{rest.length>0&&<small>{rest.join(' (').replace(/\)$/,'')}</small>}</div><KindBadge kind={s.class}/></div>
  {own?<>
   <div className="cov-big"><strong>{nf.format(s.incorporated)}</strong><span>{t(UNIT[s.key]??'tr.ui.cbFilas')}</span></div>
   <p className="cov-meta">{s.detail[0]}</p>
   {s.detail.length>1&&<Popover label={t('tr.ui.cbMasDetalleDe',{head})} trigger={<>{t('tr.ui.cbMasDetalle')}</>} width={340}><ul className="cov-detail-list">{s.detail.slice(1).map((l,i)=><li key={i}>{l}</li>)}</ul></Popover>}
  </>:<>
   <div className="cov-ring-row"><ProgressRing value={ringShare===null?0:ringShare/100} size={52} stroke={6} label={ringShare===null?'—':Math.round(ringShare)+'%'} title={bd?t('tr.ui.cbRingBd',{head,pct:fmtPct(ringShare),conv:nf.format(bd.conversationRows??0),meta:nf.format(bd.metadataOnly??0)}):t('tr.ui.cbRing',{head,pct:fmtPct(share)})}/><div className="cov-big"><strong>{nf.format(s.incorporated)}</strong><span>{bd?t('tr.ui.cbDeConv',{n:nf.format(bd.conversationRows??0)}):t('tr.ui.cbDeFilas',{n:nf.format(s.total)})}</span></div></div>
   <div className="cov-track" role="img" aria-label={bd?t('tr.ui.cbTrackBd',{head,inc:nf.format(s.incorporated),def:nf.format(bd.defects??0),meta:nf.format(bd.metadataOnly??0),pen:nf.format(s.pending),total:nf.format(s.total)}):t('tr.ui.cbTrack',{head,inc:nf.format(s.incorporated),rej:nf.format(s.rejected),pen:nf.format(s.pending),total:nf.format(s.total)})}>
    {s.incorporated>0&&<span className="cov-seg cov-in" style={{flexBasis:seg(s.incorporated)+'%'}}/>}
    {bd&&(bd.metadataOnly??0)>0&&<span className="cov-seg cov-metaonly" style={{flexBasis:Math.max(seg(bd.metadataOnly??0),1)+'%'}}/>}
    {(bd?(bd.defects??0):s.rejected)>0&&<span className="cov-seg cov-rej" style={{flexBasis:Math.max(seg(bd?(bd.defects??0):s.rejected),1)+'%'}}/>}
    {s.pending>0&&<span className="cov-seg cov-pen" style={{flexBasis:Math.max(seg(s.pending),1)+'%'}}/>}
   </div>
   {bd?<ul className="cov-legend" data-breakdown="hubspot"><li><i className="sw cov-in"/><Tip label={BASE}>{t('tr.ui.cbLegInc',{n:nf.format(s.incorporated)})}</Tip></li><li><i className="sw cov-rej"/><Tip label={t('tr.ui.cbDef')}>{reasons.length>0?t('tr.ui.cbLegDefMotivos',{n:nf.format(bd.defects??0),motivos:reasons.join(' · ')}):t('tr.ui.cbLegDef',{n:nf.format(bd.defects??0)})}</Tip></li><li><i className="sw cov-metaonly"/><Tip label={t('tr.ui.cbMeta')}>{t('tr.ui.cbLegMeta',{n:nf.format(bd.metadataOnly??0)})}</Tip></li><li><i className="sw cov-pen"/>{t('tr.ui.cbPend',{n:nf.format(s.pending)})}</li></ul>
   :<ul className="cov-legend"><li><i className="sw cov-in"/>{t('tr.ui.cbIncN',{n:nf.format(s.incorporated)})}</li><li><i className="sw cov-rej"/><Tip label={t('tr.ui.cbRej')}>{t('tr.ui.cbRechN',{n:nf.format(s.rejected)})}</Tip></li><li><i className="sw cov-pen"/>{t('tr.ui.cbPend',{n:nf.format(s.pending)})}</li></ul>}
   {s.key==='hubspot'&&s.rejectionBreakdown?.status==='unavailable'&&<p className="cov-meta" role="status">{t('tr.ui.cbDesglose')}</p>}
   {s.rejectionNote&&<p className="cov-meta cov-rej-note">{s.rejectionNote}</p>}
   <p className="cov-meta">{t(s.imports===1?'tr.ui.cbImp1':'tr.ui.cbImpN',{n:s.imports})}{s.openImports>0?' · '+t(s.openImports===1?'tr.ui.cbProc1':'tr.ui.cbProcN',{n:s.openImports}):''}{when(s.lastUpdate,loc)?' · '+when(s.lastUpdate,loc):''}</p>
  </>}
 </li>;
}
/** Which part of the historical information is incorporated, per source: exact counts, class label, rejected-by-design in neutral grey. */
export function CoverageBand({endpoint='/api/coverage'}:{endpoint?:string}){
 const t=useT();
 const {data:view,error,busy,reload}=useJson<CoverageView>(endpoint,j=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;});
 const loaded=view?.sources.filter(s=>s.loaded)??[],unavailable=view?.sources.filter(s=>s.status==='timeout')??[],empty=view?.sources.filter(s=>!s.loaded&&s.status!=='timeout')??[];
 return <section className="card coverage" aria-labelledby="coverage-title" aria-busy={busy}>
  <div className="card-title"><div><h2 id="coverage-title">{t('tr.ui.cbTitulo')}</h2>{view&&<p>{t('tr.ui.cbSub',{a:loaded.length,b:view.sources.length})}</p>}</div></div>
  {busy&&!view&&<SkeletonCards count={3}/>}
  {error&&<div className="notice-bar" role="alert"><Icon name="info" size={14}/><span>{error}</span><Button size="sm" icon={<Refresh/>} onClick={reload}>{t('tr.ui.cbReintentar')}</Button></div>}
  {view&&<>
   {loaded.length===0?<EmptyState art="plug" compact title={t('tr.ui.cbVacioT')} body={t('tr.ui.cbVacioB')} action={<LinkButton href="/imports" variant="primary" size="sm" icon={<Arrow/>}>{t('panel.importar')}</LinkButton>}/>
    :<ul className="cov-grid">{loaded.map(s=><Tile key={s.key} s={s}/>)}</ul>}
   {empty.length>0&&<p className="cov-missing"><span className="cov-missing-label"><i className="sw sw-empty"/>{t('tr.ui.cbSinCargar')}</span>{empty.map(s=><span className="chip" key={s.key} title={t('tr.ui.cbTitSin')}>{s.label}</span>)}</p>}
   {unavailable.length>0&&<p className="cov-missing" role="status"><span className="cov-missing-label">{t('hoy.noDisponible')}</span>{unavailable.map(s=><span className="chip" key={s.key} title={t('tr.ui.cbTitTimeout')}>{s.label}</span>)}</p>}
   <details className="cov-table"><summary>{t('cfo.serie.verTabla')}</summary><p className="card-lead">{view.note}</p><div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.ui.cbTablaAria')}><table><thead><tr><th scope="col">{t('conf.hFuente')}</th><th scope="col" className="num">{t('tr.ui.cbThFilas')}</th><th scope="col" className="num">{t('tr.ui.cbThInc')}</th><th scope="col" className="num">{t('tr.ui.cbThRech')}</th><th scope="col" className="num">{t('tr.ui.cbThPen')}</th></tr></thead><tbody>{view.sources.map(s=><tr key={s.key}><th scope="row">{s.label}</th><td className="num">{s.loaded?nf.format(s.total):s.status==='timeout'?t('tr.ui.cbNoDisp'):t('tr.ui.cbSinCargar')}</td><td className="num">{s.loaded?nf.format(s.incorporated):'—'}</td><td className="num">{s.loaded?nf.format(s.rejected):'—'}</td><td className="num">{s.loaded?nf.format(s.pending):'—'}</td></tr>)}</tbody></table></div></details>
  </>}
 </section>;
}
