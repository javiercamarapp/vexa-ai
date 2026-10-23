'use client';
import {Button,Refresh} from '../ui/button';
import {Drawer} from '../ui/overlay';
import {Icon} from '../ui/icons';
import {EmptyState} from '../ui/empty-state';
import {SkeletonRows} from '../ui/skeletons';
import {StatusChip} from '../ui/status-chip';
import Link from './navigation-lifecycle';
import {useEffect,useState} from 'react';
import {useJson} from '../ui/use-json';
type Problem={id:string;label:string;version:number;state:string;conversationIds:string[];conversationCount?:number};
const conversaciones=(p:Problem)=>p.conversationCount??p.conversationIds.length;
function problems(value:unknown):Problem[]|null{
 if(!value||typeof value!=='object'||!('problems' in value)||!Array.isArray(value.problems))return null;
 for(const row of value.problems)if(!row||typeof row.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(row.id)||typeof row.label!=='string'||!Number.isInteger(row.version)||!['active','retired'].includes(row.state)||!Array.isArray(row.conversationIds)||row.conversationIds.some((id:unknown)=>typeof id!=='string')||(row.conversationCount!==undefined&&!Number.isInteger(row.conversationCount)))return null;
 return value.problems.filter((row:Problem)=>row.state==='active');
}
/** Compact catalogue entry: one button with the count; the list (including problems with no financial association) opens in a drawer. */
export function CurrentProblems(){
 const [open,setOpen]=useState(false),[pedir,setPedir]=useState(false);
 // El catálogo repite la verificación de resumen de todo el catálogo (~7 s en frío) que ya hace la lectura de Problemas: se pide cuando la pantalla quedó quieta (o al abrirlo), no a la vez (N5, QA-2: la segunda visita era más lenta que la primera).
 useEffect(()=>{const w=window as Window&{requestIdleCallback?:(f:()=>void,o?:{timeout:number})=>number;cancelIdleCallback?:(h:number)=>void};if(w.requestIdleCallback){const h=w.requestIdleCallback(()=>setPedir(true),{timeout:8000});return()=>w.cancelIdleCallback?.(h);}const t=setTimeout(()=>setPedir(true),5000);return()=>clearTimeout(t);},[]);
 const {data:rows,error,busy,reload}=useJson<Problem[]>(pedir||open?'/api/problems':null,problems);
 return <>
  <button type="button" className="btn btn-secondary" onClick={()=>{setPedir(true);setOpen(true);}} aria-haspopup="dialog" aria-label="Catálogo actual de problemas"><Icon name="list" size={14}/><span className="btn-label">Catálogo</span>{rows&&<span className="count-pill">{rows.length}</span>}</button>
  <Drawer open={open} onClose={()=>setOpen(false)} title="Catálogo de problemas" subtitle="Estado actual; incluye problemas sin asociación financiera y no cambia con los filtros de la publicación." footer={<Button size="sm" icon={<Refresh/>} loading={busy} onClick={reload}>Actualizar catálogo</Button>}>
   {busy&&!rows&&<SkeletonRows rows={4}/>}
   {error&&<p className="notice-bar" role="alert">{error}</p>}
   {rows&&(!rows.length?<EmptyState compact art="inbox" title="Sin problemas activos" body="No hay problemas activos con evidencia accesible."/>:<ul className="row-list">{rows.map(row=><li key={row.id}><Link className="row-link" href={'/problems/'+row.id}><span className="row-link-title">{row.label}</span><span className="row-link-meta"><StatusChip tone="info">{conversaciones(row)} {conversaciones(row)===1?'conversación':'conversaciones'}</StatusChip><span className="chip">v{row.version}</span></span><Icon name="chevron-right" size={16}/></Link></li>)}</ul>)}
  </Drawer>
 </>;
}
