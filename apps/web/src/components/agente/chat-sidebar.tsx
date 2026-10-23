'use client';
import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {Button,LinkButton} from '../ui/button';
import {ConfirmationDialog} from '../confirmation-dialog';
import {Icon} from './icons';
import {RovaqWordmark} from './rovaq-mark';
import {GROUPS,groupLabel} from './store';
import type {Conversation} from './types';
const plain=(t:string)=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const LINKS:[string,string][]=[['/overview','Resumen'],['/problems','Problemas'],['/explorer','Explorador'],['/briefs','Brief']];
/** Own conversation sidebar (this browser only): grouped by day, search, rename, delete with confirmation, and the way back to the workspace.
 *  On narrow screens it is a drawer: Esc closes it and Tab stays inside. */
export function ChatSidebar({id,conversations,activeId,drawer,open,onNew,onOpen,onRename,onDelete,onClose}:{id:string;conversations:Conversation[];activeId:string|null;drawer:boolean;open:boolean;onNew:()=>void;onOpen:(id:string)=>void;onRename:(id:string,title:string)=>void;onDelete:(id:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState('');
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{if(drawer&&open)root.current?.querySelector<HTMLElement>('button,a,input')?.focus();},[drawer,open]);
 function keys(e:KeyboardEvent){
  if(!drawer||!open)return;
  if(e.key==='Escape'){e.stopPropagation();onClose();return;}
  if(e.key!=='Tab'||!root.current)return;
  const f=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,[href]')].filter(el=>el.offsetParent!==null);
  if(!f.length)return;const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
 }
 const shown=useMemo(()=>conversations.filter(c=>!query.trim()||plain(c.title).includes(plain(query))),[conversations,query]);
 const groups=useMemo(()=>GROUPS.map(g=>[g,shown.filter(c=>groupLabel(c.updatedAt)===g)] as const).filter(([,list])=>list.length>0),[shown]);
 return <aside id={id} ref={root} className="chat-sidebar" data-drawer={drawer||undefined} data-open={open} aria-label="Conversaciones y navegación" role={drawer&&open?'dialog':undefined} aria-modal={drawer&&open?true:undefined} onKeyDown={keys} inert={drawer&&!open?true:undefined}>
  <div className="chat-sidebar-head"><RovaqWordmark size={28}/>{drawer&&<Button size="sm" icon={<Icon name="close"/>} onClick={onClose} aria-label="Cerrar menú">Cerrar</Button>}</div>
  <div className="agente-history-tools"><Button size="sm" variant="primary" icon={<Icon name="plus"/>} onClick={onNew}>Chat nuevo</Button>
   <label className="sr-only" htmlFor={id+'-q'}>Buscar en el historial</label><input id={id+'-q'} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar en el historial"/></div>
  <div className="chat-sidebar-scroll">
   {conversations.length===0?<p className="state" role="status">Aún no tienes chats guardados.</p>:shown.length===0?<p className="state" role="status">Ningún chat coincide con «{query}».</p>:
    groups.map(([label,list])=><section key={label} aria-label={label} className="agente-history-group"><p className="eyebrow" role="heading" aria-level={3}>{label}</p><ul>
     {list.map(c=><li key={c.id}>{editing===c.id?
      <form className="agente-rename" onSubmit={e=>{e.preventDefault();onRename(c.id,draft);setEditing(null);}}><label className="sr-only" htmlFor={id+'-r'}>Nuevo nombre</label><input id={id+'-r'} autoFocus value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(null);}}}/><span className="btn-group"><Button type="submit" size="sm" variant="primary">Guardar</Button><Button size="sm" onClick={()=>setEditing(null)}>Cancelar</Button></span></form>:
      <><Button className="agente-history-item" aria-current={c.id===activeId?'true':undefined} onClick={()=>onOpen(c.id)}><span className="agente-history-title">{c.title}</span></Button>
       <span className="btn-group"><Button size="sm" icon={<Icon name="edit"/>} aria-label={`Renombrar «${c.title}»`} onClick={()=>{setDraft(c.title);setEditing(c.id);}}>Renombrar</Button>
       <ConfirmationDialog triggerLabel="Borrar" title="¿Borrar este chat?" description={`Se borrará «${c.title}» de este navegador. No se puede deshacer.`} confirmLabel="Borrar chat" onConfirm={()=>onDelete(c.id)}/></span></>}</li>)}
    </ul></section>)}
  </div>
  <nav className="chat-sidebar-foot" aria-label="Volver al espacio de trabajo">
   <p className="card-lead agente-note">Los chats se guardan solo en este navegador. Las citas de clientes y el contenido de los adjuntos no se guardan.</p>
   <LinkButton href="/overview" variant="primary" size="sm" icon={<Icon name="back"/>}>Volver al espacio de trabajo</LinkButton>
   <ul className="chat-sidebar-links">{LINKS.map(([href,label])=><li key={href}><LinkButton href={href} size="sm" variant="ghost">{label}</LinkButton></li>)}</ul>
  </nav>
 </aside>;
}
