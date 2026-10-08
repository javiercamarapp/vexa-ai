'use client';
import Link from './navigation-lifecycle';
import {useId,useState} from 'react';
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
export function workspaceIconName(pathname:string){const links=[...destinations,...groups.flatMap(([,links])=>links)];const link=[...links].sort((a,b)=>b[0].length-a[0].length).find(([href])=>pathname===href||pathname.startsWith(href+'/'));return link?.[2]??link?.[0].slice(1)??'overview';}
export function Navigation({onNavigate,collapsed=false}:{onNavigate?:()=>void;collapsed?:boolean}){
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString()),id=useId();
 const sections=[['Espacio de trabajo',destinations.filter(([href])=>href!=='/overview').map(([href,label])=>[href,label,href.slice(1)] as const)] as const,...groups];
 const rootItem=['/overview','Resumen','overview'] as const;
 const current=[{group:null,link:rootItem},...sections.flatMap(([group,links])=>links.map(link=>({group,link})))].sort((a,b)=>b.link[0].length-a.link[0].length).find(({link:[href]})=>pathname===href||pathname.startsWith(href+'/'));
 const [openGroup,setOpenGroup]=useState<string|null>(current?.group??'Espacio de trabajo');
 const [previousPath,setPreviousPath]=useState(pathname);
 if(previousPath!==pathname){setPreviousPath(pathname);setOpenGroup(current?.group??'Espacio de trabajo');}
 function item([href,label,icon]:readonly [string,string,string]){return <li key={href}><Link title={label} aria-label={collapsed?label:undefined} onClick={onNavigate} aria-current={current?.link[0]===href?'page':undefined} href={href+((destinations.some(([destination])=>destination===href)||href==='/imports')&&query?'?'+query:'')}><WorkspaceIcon name={icon}/><span className="nav-label">{label}</span></Link></li>;}
 return <nav aria-label="Navegación principal">
  <ul className="nav-root">{item(rootItem)}</ul>
  {!collapsed&&current?.group&&openGroup!==current.group&&<div className="nav-current"><p className="nav-caption">Página actual</p><ul>{item(current.link)}</ul></div>}
  {sections.map(([label,links],index)=>{const expanded=openGroup===label,controls=id+'-group-'+index;return <div className="nav-group" key={label}>
   {!collapsed&&<button className="nav-group-toggle" type="button" aria-expanded={expanded} aria-controls={controls} onClick={()=>setOpenGroup(expanded?null:label)}><span>{label}</span><WorkspaceIcon name="chevron"/></button>}
   <ul id={controls} hidden={!collapsed&&!expanded}>{links.map(item)}</ul>
  </div>;})}
 </nav>;
}
