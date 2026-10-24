'use client';
import {ConMarca} from './brand-mark';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {useId,useState} from 'react';
import type {OriginView} from '../../../../../packages/workspace-service/provenance.mjs';
import {enmascararTerceros} from '../../../../../packages/workspace-service/enmascarar-terceros.mjs';
import {Button} from './button';
import {IdChip} from './id-chip';
import {fetchCupo} from '../../lib/workspace/cupo.mjs';
const roles:Record<string,string>={customer:'Cliente',agent:'Agente',internal:'Nota interna'};
export type CitationData={quote:string;role:string;messageRevisionId:string;category?:string;source?:string;times?:number};
/** Texto MOSTRADO con nombres/direcciones estructurales ocultos (solo presentación: la cita y su hash verificados quedan intactos). A quoted claim and its provenance on demand: citation -> source record -> file row -> file hash. */
export function Citation({quote,role,messageRevisionId,category,source,times}:CitationData){
 const [origin,setOrigin]=useState<OriginView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),panel=useId();
 async function toggle(){
  if(open){setOpen(false);return;}setOpen(true);if(origin)return;setBusy(true);setError('');
  try{const r=await fetchCupo('/api/origin/'+encodeURIComponent(messageRevisionId),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));const j=await r.json();if(!Array.isArray(j?.data?.chain))throw Error('shape');setOrigin(j.data);}
  catch(e){setError(e instanceof Error&&e.message==='404'?'Con tu acceso no hay un origen enlazado a esta cita.':'No se pudo consultar el origen. Reintenta.');}finally{setBusy(false);}
 }
 return <figure className="citation">
  <blockquote>{enmascararTerceros(quote)}</blockquote>
  <figcaption><span className="chip">{roles[role]??role}</span>{category&&<span className="chip">{etiquetaCategoria(category)}</span>}{source&&<span className="chip"><ConMarca marca={source}>{source}</ConMarca></span>}{times!==undefined&&times>1&&<span className="chip" title={`Esta misma cita aparece ${times} veces en la evidencia registrada`}>×{times}</span>}<Button size="sm" aria-expanded={open} aria-controls={panel} loading={busy} onClick={()=>void toggle()}>{open?'Ocultar origen':'Ver origen'}</Button></figcaption>
  <div id={panel} hidden={!open} className="origin" aria-live="polite">
   {error&&<p className="state state-error" role="alert">{error}</p>}
   {origin&&<><ol className="origin-chain">{origin.chain.map(step=><li key={step.step} data-step={step.step}><span className="origin-dot" aria-hidden="true"/><div><span className="origin-label">{step.label}</span><span className="origin-detail" title={step.detail}>{step.detail}</span>{step.hash&&<IdChip value={step.hash} label="hash" head={10} tail={4}/>}</div></li>)}</ol>{origin.gap&&<p className="origin-gap">{origin.gap}</p>}</>}
  </div>
 </figure>;
}
