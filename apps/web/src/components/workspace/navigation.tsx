'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {WorkspaceIcon} from './icon';
export const destinations=[['/overview','Resumen'],['/problems','Problemas'],['/recommendations','Recomendaciones'],['/explorer','Explorador'],['/interventions','Intervenciones'],['/briefs','Brief ejecutivo']] as const;
const groups:ReadonlyArray<readonly [string,ReadonlyArray<readonly [string,string,string]>]> = [
 ['Operación',[['/economics','Gestión económica','economics'],['/problems/manage','Gestionar problemas','problems'],['/analysis','Análisis','analysis']]],
 ['Datos e inteligencia',[['/imports','Importaciones','imports'],['/connections','Conexiones','connections'],['/history','Histórico','history'],['/evaluation','Evaluación histórica','analysis'],['/evaluation/candidates','Candidatos evaluados','recommendations'],['/migrations','Comparación de migración','connections']]],
 ['Administración',[['/notifications','Notificaciones','notifications'],['/settings/notifications','Preferencias de avisos','settings'],['/settings/team','Equipo','team'],['/settings/retention','Retención y borrado','settings']]]
] as const;
export function navigationQuery(pathname:string,raw:string){const query=new URLSearchParams(raw);for(const key of ['cursor','detail_hash','root_kind','root_id','component_id','event_id'])query.delete(key);if(pathname==='/explorer')for(const key of ['q','status','order','limit'])query.delete(key);return query.toString();}
export function workspaceTitle(pathname:string){const links=[...destinations,...groups.flatMap(([,links])=>links)];return [...links].sort((a,b)=>b[0].length-a[0].length).find(([href])=>pathname===href||pathname.startsWith(href+'/'))?.[1]??'Espacio de trabajo';}
export function Navigation({onNavigate,collapsed=false}:{onNavigate?:()=>void;collapsed?:boolean}){
 const [openGroups,setOpenGroups]=useState<ReadonlySet<string>>(()=>new Set(groups.map(([label])=>label)));
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString());
 const active=(href:string)=>pathname===href||(pathname.startsWith(href+'/')&&!groups.flatMap(([,links])=>links).some(([other])=>other!==href&&other.startsWith(href+'/')&&(pathname===other||pathname.startsWith(other+'/'))));
 return <><nav aria-label="Espacio de trabajo"><p className="nav-caption">Espacio de trabajo</p><ul>{destinations.map(([href,label])=><li key={href}><Link title={label} onClick={onNavigate} aria-current={active(href)?'page':undefined} href={href+(query?'?'+query:'')}><WorkspaceIcon name={href.slice(1)}/><span className="nav-label">{label}</span></Link></li>)}</ul></nav>
 <nav aria-label="Gestión">{groups.map(([label,links])=><details className="nav-group" key={label} open={collapsed||openGroups.has(label)} onToggle={event=>{if(collapsed)return;const open=event.currentTarget.open;setOpenGroups(previous=>{if(previous.has(label)===open)return previous;const next=new Set(previous);if(open)next.add(label);else next.delete(label);return next;});}}><summary><span className="nav-label">{label}</span><WorkspaceIcon name="chevron"/></summary><ul>{links.map(([href,label,icon])=><li key={href}><Link title={label} onClick={onNavigate} aria-current={active(href)?'page':undefined} href={href==='/imports'&&query?href+'?'+query:href}><WorkspaceIcon name={icon}/><span className="nav-label">{label}</span></Link></li>)}</ul></details>)}</nav></>;
}
