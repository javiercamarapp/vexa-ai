'use client';
import type {Identidad} from '../../lib/legibilidad/fuentes.mjs';
import {KindBadge} from '../ui/kind-badge';
import {ProgressRing} from '../ui/progress-ring';
import {EmptyState} from '../ui/empty-state';
import {SkeletonCards} from '../ui/skeletons';
import {Button,Refresh} from '../ui/button';
import {nf,fmtPct} from '../ui/format';
import Link from '../workspace/navigation-lifecycle';
import './datos.css';

/** Cobertura de identidad de las relaciones ticket–contacto: la cifra que habilita (o bloquea) el dinero por problema. */
export function IdentidadCard({id,busy,error,onRetry,enlaceDetalle=false}:{id:Identidad|null;busy:boolean;error:string;onRetry:()=>void;enlaceDetalle?:boolean}){
 return <section className="card" aria-labelledby="ds-id-t">
   <div className="card-title"><div><h2 id="ds-id-t">Cobertura de identidad</h2><p>Relaciones entre cada ticket y el cliente al que pertenece.</p></div>{id&&<KindBadge kind={id.estimado?'estimated':'observed'}/>}</div>
   {busy?<SkeletonCards count={1}/>:!id?<EmptyState art="shield" compact tone="warn" title="No disponible ahora" body={error||'Los conteos de relaciones ticket–contacto no respondieron. Reintenta en unos segundos; no se estiman.'} action={<Button icon={<Refresh/>} onClick={onRetry}>Reintentar</Button>}/>:<>
    <div className="dn-hero">
     <div className="dn-hero-fig"><ProgressRing value={id.bps/10000} size={96} stroke={9} label={Math.round(id.bps/100)+' %'} title={`${fmtPct(id.bps/100)} de las relaciones ticket–contacto está vinculado`}/>
      <div><p className="dn-big">{nf.format(id.vinculadas)}<small>de {nf.format(id.total)} relaciones</small></p><p className="dn-meta">vinculadas a un cliente</p></div></div>
     <div>
      <div className="dn-bar" role="img" aria-label={`${nf.format(id.vinculadas)} vinculadas, ${nf.format(id.sinIdentificar)} sin identificar, ${nf.format(id.porRevisar)} por revisar, ${nf.format(id.retenidas)} retenidas`}><span className="dn-in" style={{flexBasis:id.vinculadas*100/id.total+'%'}}/>{id.sinIdentificar>0&&<span className="dn-pen" style={{flexBasis:id.sinIdentificar*100/id.total+'%'}}/>}{id.porRevisar+id.retenidas>0&&<span className="dn-rej" style={{flexBasis:(id.porRevisar+id.retenidas)*100/id.total+'%'}}/>}</div>
      <ul className="dn-legend"><li><i className="dn-in"/>{nf.format(id.vinculadas)} vinculadas</li><li><i className="dn-pen"/>{nf.format(id.sinIdentificar)} sin identificar</li><li><i className="dn-rej"/>{nf.format(id.porRevisar)} por revisar · {nf.format(id.retenidas)} retenidas</li></ul>
      {id.vinculosActivos!==null&&<p className="dn-meta">Vínculos activos conversación–cliente: {nf.format(id.vinculosActivos)}.</p>}
     </div>
    </div>
    <p className="dn-note">Por qué importa: sin identificar al cliente no se puede unir una conversación con sus pedidos, y por eso el dinero por problema todavía no está disponible. {enlaceDetalle&&<>{' '}<Link className="row-link-inline" href="/history">Ver el detalle de las relaciones</Link></>}</p>
   </>}
  </section>;
}
