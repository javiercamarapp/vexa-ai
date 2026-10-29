'use client';
import type {Identidad} from '../../lib/legibilidad/fuentes.mjs';
import {KindBadge} from '../ui/kind-badge';
import {ProgressRing} from '../ui/progress-ring';
import {EmptyState} from '../ui/empty-state';
import {SkeletonCards} from '../ui/skeletons';
import {Button,Refresh} from '../ui/button';
import {nf,fmtPct} from '../ui/format';
import Link from '../workspace/navigation-lifecycle';
import {useT} from '../i18n/proveedor';
import './datos.css';

/** Cobertura de identidad de las relaciones ticket–contacto: la cifra que habilita (o bloquea) el dinero por problema. */
export function IdentidadCard({id,busy,error,onRetry,enlaceDetalle=false}:{id:Identidad|null;busy:boolean;error:string;onRetry:()=>void;enlaceDetalle?:boolean}){
 const tx=useT();
 return <section className="card" aria-labelledby="ds-id-t">
   <div className="card-title"><div><h2 id="ds-id-t">{tx('tr.datos.idTitulo')}</h2><p>{tx('tr.datos.idSub')}</p></div>{id&&<KindBadge kind={id.estimado?'estimated':'observed'}/>}</div>
   {busy?<SkeletonCards count={1}/>:!id?<EmptyState art="shield" compact tone="warn" title={tx('hoy.noDisponible')} body={error||tx('tr.datos.idErr')} action={<Button icon={<Refresh/>} onClick={onRetry}>{tx('hoy.reintentar')}</Button>}/>:<>
    <div className="dn-hero">
     <div className="dn-hero-fig"><ProgressRing value={id.bps/10000} size={96} stroke={9} label={Math.round(id.bps/100)+' %'} title={tx('tr.datos.idRing',{pct:fmtPct(id.bps/100)})}/>
      <div><p className="dn-big">{nf.format(id.vinculadas)}<small>{tx('tr.datos.idDe',{n:nf.format(id.total)})}</small></p><p className="dn-meta">{tx('tr.datos.idVinc')}</p></div></div>
     <div>
      <div className="dn-bar" role="img" aria-label={tx('tr.datos.idAria',{v:nf.format(id.vinculadas),s:nf.format(id.sinIdentificar),r:nf.format(id.porRevisar),t:nf.format(id.retenidas)})}><span className="dn-in" style={{flexBasis:id.vinculadas*100/id.total+'%'}}/>{id.sinIdentificar>0&&<span className="dn-pen" style={{flexBasis:id.sinIdentificar*100/id.total+'%'}}/>}{id.porRevisar+id.retenidas>0&&<span className="dn-rej" style={{flexBasis:(id.porRevisar+id.retenidas)*100/id.total+'%'}}/>}</div>
      <ul className="dn-legend"><li><i className="dn-in"/>{tx('tr.datos.nVinc',{n:nf.format(id.vinculadas)})}</li><li><i className="dn-pen"/>{tx('tr.datos.nSinId',{n:nf.format(id.sinIdentificar)})}</li><li><i className="dn-rej"/>{tx('tr.datos.nRevRet',{r:nf.format(id.porRevisar),t:nf.format(id.retenidas)})}</li></ul>
      {id.vinculosActivos!==null&&<p className="dn-meta">{tx('tr.datos.idActivos',{n:nf.format(id.vinculosActivos)})}</p>}
     </div>
    </div>
    <p className="dn-note">{tx('tr.datos.idNota')} {enlaceDetalle&&<>{' '}<Link className="row-link-inline" href="/history">{tx('tr.datos.idVerDetalle')}</Link></>}</p>
   </>}
  </section>;
}
