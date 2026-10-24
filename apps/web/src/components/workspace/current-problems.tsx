'use client';
import {Drawer} from '../ui/overlay';
import {Icon} from '../ui/icons';
import {EmptyState} from '../ui/empty-state';
import {SkeletonRows} from '../ui/skeletons';
import Link from './navigation-lifecycle';
import {useEffect,useMemo,useState} from 'react';
import {useJson} from '../ui/use-json';
type Problem={id:string;label:string;version:number;state:string;conversationIds:string[];conversationCount?:number};
const conversaciones=(p:Problem)=>p.conversationCount??p.conversationIds.length;
function problems(value:unknown):Problem[]|null{
 if(!value||typeof value!=='object'||!('problems' in value)||!Array.isArray(value.problems))return null;
 for(const row of value.problems)if(!row||typeof row.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(row.id)||typeof row.label!=='string'||!Number.isInteger(row.version)||!['active','retired'].includes(row.state)||!Array.isArray(row.conversationIds)||row.conversationIds.some((id:unknown)=>typeof id!=='string')||(row.conversationCount!==undefined&&!Number.isInteger(row.conversationCount)))return null;
 return value.problems.filter((row:Problem)=>row.state==='active');
}
const GRUPOS=['Order','Warranty','Pre-sale','Other'] as const;
const prefijo=(label:string)=>/^(order|orden|pedido)/i.test(label)?'Order':/^(warranty|garant)/i.test(label)?'Warranty':/^(pre-?sale|pre-?venta|preventa)/i.test(label)?'Pre-sale':'Other';
const plano=(t:string)=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Compact catalogue entry: one button with the count; the list (including problems with no financial association) opens in a drawer
 *  as a dense list: 40 px rows grouped by prefix, ordered by volume, with a mini bar in the «Problemas» colour (violet) and a tabular count. */
export function CurrentProblems(){
 const [open,setOpen]=useState(false),[pedir,setPedir]=useState(false),[q,setQ]=useState('');
 // El catálogo repite la verificación de resumen de todo el catálogo (~7 s en frío) que ya hace la lectura de Problemas: se pide cuando la pantalla quedó quieta (o al abrirlo), no a la vez (N5, QA-2: la segunda visita era más lenta que la primera).
 useEffect(()=>{const w=window as Window&{requestIdleCallback?:(f:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(h:number)=>void};if(w.requestIdleCallback){const h=w.requestIdleCallback(()=>setPedir(true),{timeout:8000});return()=>w.cancelIdleCallback?.(h);}const t=setTimeout(()=>setPedir(true),5000);return()=>clearTimeout(t);},[]);
 const {data:rows,error,busy}=useJson<Problem[]>(pedir||open?'/api/problems':null,problems);
 const max=Math.max(1,...(rows??[]).map(conversaciones));
 const grupos=useMemo(()=>{const f=(rows??[]).filter(r=>!q.trim()||plano(r.label).includes(plano(q))).sort((a,b)=>conversaciones(b)-conversaciones(a)||a.label.localeCompare(b.label,'es'));
  return GRUPOS.map(g=>[g,f.filter(r=>prefijo(r.label)===g)] as const).filter(([,l])=>l.length>0);},[rows,q]);
 const mostradas=grupos.reduce((n,[,l])=>n+l.length,0);
 return <>
  <button type="button" className="btn btn-secondary" onClick={()=>{setPedir(true);setOpen(true);}} aria-haspopup="dialog" aria-label="Catálogo actual de problemas"><Icon name="list" size={14}/><span className="btn-label">Catálogo</span>{rows&&<span className="count-pill">{rows.length}</span>}</button>
  <Drawer open={open} onClose={()=>setOpen(false)} size="sm" title="Catálogo de problemas" subtitle="Estado actual; incluye problemas sin asociación financiera y no cambia con los filtros de la publicación." footer={<p className="ov-foot-note">{rows?`${mostradas} de ${rows.length} problemas activos · por volumen`:'Cargando el catálogo…'}</p>}>
   {busy&&!rows&&<SkeletonRows rows={4}/>}
   {error&&<p className="notice-bar" role="alert">{error}</p>}
   {rows&&(!rows.length?<EmptyState compact art="inbox" title="Sin problemas activos" body="No hay problemas activos con evidencia accesible."/>:<>
    <label className="ov-search"><Icon name="search" size={14}/><span className="sr-only">Buscar en el catálogo</span><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar problema" aria-label="Buscar en el catálogo"/></label>
    {mostradas===0?<p className="ov-help" role="status">Ningún problema coincide con «{q}».</p>:grupos.map(([g,list])=><section key={g} className="ov-group" aria-label={g}>{grupos.length>1&&<h3 className="ov-group-title">{g}</h3>}<ul className="ov-rows">{list.map(row=>{const n=conversaciones(row);return <li key={row.id} className="ov-row"><Link className="ov-row-main" href={'/problems/'+row.id} title={row.label}><span className="ov-row-title">{row.label}</span><span className="ov-row-meta">v{row.version}</span><span className="ov-row-bar" aria-hidden="true"><i style={{width:Math.max(6,Math.round(n/max*100))+'%'}}/></span><span className="ov-row-count" aria-label={n+(n===1?' conversación':' conversaciones')}>{n}</span><span className="ov-row-chev" aria-hidden="true"><Icon name="chevron-right" size={14}/></span></Link></li>;})}</ul></section>)}
   </>)}
  </Drawer>
 </>;
}
