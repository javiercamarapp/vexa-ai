'use client';
import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {Button} from '../ui/button';
import {ConfirmationDialog} from '../confirmation-dialog';
import {Icon} from './icons';
import {GROUPS,groupLabel} from './store';
import type {Conversation} from './types';
const plain=(t:string)=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Panel «Historial» (como el de ChatDatosShell de Atiende): flota a la derecha del contenido, agrupado por día, con buscador, renombrar y borrar con confirmación.
 *  Los chats viven solo en este navegador. Esc cierra y el foco queda atrapado dentro; en pantallas angostas ocupa todo el contenido. */
export function HistoryPanel({id,conversations,activeId,leaving,onNew,onOpen,onRename,onDelete,onClose}:{id:string;conversations:Conversation[];activeId:string|null;leaving:boolean;onNew:()=>void;onOpen:(id:string)=>void;onRename:(id:string,title:string)=>void;onDelete:(id:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState('');
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{root.current?.querySelector<HTMLElement>('button,input')?.focus();},[]);
 function keys(e:KeyboardEvent){
  if(e.key==='Escape'&&editing===null){e.stopPropagation();onClose();return;}
  if(e.key!=='Tab'||!root.current)return;
  const f=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,[href]')].filter(el=>el.offsetParent!==null);
  if(!f.length)return;const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
 }
 const shown=useMemo(()=>conversations.filter(c=>!query.trim()||plain(c.title).includes(plain(query))),[conversations,query]);
 const groups=useMemo(()=>GROUPS.map(g=>[g,shown.filter(c=>groupLabel(c.updatedAt)===g)] as const).filter(([,list])=>list.length>0),[shown]);
 return <div id={id} ref={root} role="dialog" aria-label="Historial de chats" className="agente-history" data-leaving={leaving||undefined} onKeyDown={keys}>
  <div className="agente-history-head"><button type="button" className="agente-hist-new" onClick={onNew} aria-label="Chat nuevo"><Icon name="edit" size={14}/>Chat nuevo</button><button type="button" className="agente-hist-close" onClick={onClose} aria-label="Cerrar historial"><Icon name="close" size={16}/></button></div>
  <div className="agente-history-tools"><label className="agente-hist-search"><Icon name="search" size={14}/><span className="sr-only">Buscar en el historial</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar chats" aria-label="Buscar chats"/></label></div>
  <div className="agente-history-scroll">
   {conversations.length===0?<p className="state" role="status">Aún no tienes chats guardados.</p>:shown.length===0?<p className="state" role="status">Ningún chat coincide con «{query}».</p>:
    groups.map(([label,list])=><section key={label} aria-label={label} className="agente-history-group"><p className="agente-hist-group" role="heading" aria-level={3}>{label}</p><ul>
     {list.map(c=><li key={c.id}>{editing===c.id?
      <form className="agente-rename" onSubmit={e=>{e.preventDefault();onRename(c.id,draft);setEditing(null);}}><label className="sr-only" htmlFor={id+'-r'}>Nuevo nombre</label><input id={id+'-r'} autoFocus value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(null);}}}/><span className="btn-group"><Button type="submit" size="sm" variant="primary">Guardar</Button><Button size="sm" onClick={()=>setEditing(null)}>Cancelar</Button></span></form>:
      <><button type="button" className="agente-history-item" aria-current={c.id===activeId?'true':undefined} onClick={()=>onOpen(c.id)}><span className="agente-history-title">{c.title}</span></button>
       <span className="agente-history-actions"><button type="button" className="agente-icon-sm" aria-label={`Renombrar «${c.title}»`} title="Renombrar" onClick={()=>{setDraft(c.title);setEditing(c.id);}}><Icon name="edit" size={14}/></button>
       <ConfirmationDialog triggerLabel="Borrar" title="¿Borrar este chat?" description={`Se borrará «${c.title}» de este navegador. No se puede deshacer.`} confirmLabel="Borrar chat" onConfirm={()=>onDelete(c.id)}/></span></>}</li>)}
    </ul></section>)}
  </div>
  <p className="card-lead agente-note">Los chats se guardan solo en este navegador. Las citas de clientes y el contenido de los adjuntos no se guardan.</p>
 </div>;
}
