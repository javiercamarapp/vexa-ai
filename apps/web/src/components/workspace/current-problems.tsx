'use client';
import {Button,Refresh} from '../ui/button';
import {Drawer} from '../ui/overlay';
import {Icon} from '../ui/icons';
import {EmptyState} from '../ui/empty-state';
import {SkeletonRows} from '../ui/skeletons';
import {StatusChip} from '../ui/status-chip';
import Link from './navigation-lifecycle';
import {useState} from 'react';
import {useJson} from '../ui/use-json';
type Problem={id:string;label:string;version:number;state:string;conversationIds:string[]};
function problems(value:unknown):Problem[]|null{
 if(!value||typeof value!=='object'||!('problems' in value)||!Array.isArray(value.problems))return null;
 for(const row of value.problems)if(!row||typeof row.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(row.id)||typeof row.label!=='string'||!Number.isInteger(row.version)||!['active','retired'].includes(row.state)||!Array.isArray(row.conversationIds)||row.conversationIds.some((id:unknown)=>typeof id!=='string'))return null;
 return value.problems.filter((row:Problem)=>row.state==='active');
}
/** Compact catalogue entry: one button with the count; the list (including problems with no financial association) opens in a drawer. */
export function CurrentProblems(){
 const {data:rows,error,busy,reload}=useJson<Problem[]>('/api/problems',problems);
 const [open,setOpen]=useState(false);
 return <>
  <button type="button" className="btn btn-secondary" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-label="Catálogo actual de problemas"><Icon name="list" size={14}/><span className="btn-label">Catálogo</span>{rows&&<span className="count-pill">{rows.length}</span>}</button>
  <Drawer open={open} onClose={()=>setOpen(false)} title="Catálogo de problemas" subtitle="Estado actual; incluye problemas sin asociación financiera y no cambia con los filtros de la publicación." footer={<Button size="sm" icon={<Refresh/>} loading={busy} onClick={reload}>Actualizar catálogo</Button>}>
   {busy&&!rows&&<SkeletonRows rows={4}/>}
   {error&&<p className="notice-bar" role="alert">{error}</p>}
   {rows&&(!rows.length?<EmptyState compact art="inbox" title="Sin problemas activos" body="No hay problemas activos con evidencia accesible."/>:<ul className="row-list">{rows.map(row=><li key={row.id}><Link className="row-link" href={'/problems/'+row.id}><span className="row-link-title">{row.label}</span><span className="row-link-meta"><StatusChip tone="info">{row.conversationIds.length} {row.conversationIds.length===1?'conversación':'conversaciones'}</StatusChip><span className="chip">v{row.version}</span></span><Icon name="chevron-right" size={16}/></Link></li>)}</ul>)}
  </Drawer>
 </>;
}
