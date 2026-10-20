'use client';
import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {Button} from '../ui/button';
import {ConfirmationDialog} from '../confirmation-dialog';
import {Icon} from './icons';
import {GROUPS,groupLabel} from './store';
import type {Conversation} from './types';
const plain=(t:string)=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Local history (this browser): grouped by day, search, rename, delete with confirmation. Esc closes; Tab stays inside. */
export function HistoryPanel({id,conversations,activeId,onNew,onOpen,onRename,onDelete,onClose}:{id:string;conversations:Conversation[];activeId:string|null;onNew:()=>void;onOpen:(id:string)=>void;onRename:(id:string,title:string)=>void;onDelete:(id:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState('');
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{root.current?.querySelector<HTMLElement>('button')?.focus();},[]);
 const shown=useMemo(()=>conversations.filter(c=>!query.trim()||plain(c.title).includes(plain(query))),[conversations,query]);
 const groups=useMemo(()=>GROUPS.map(g=>[g,shown.filter(c=>groupLabel(c.updatedAt)===g)] as const).filter(([,list])=>list.length>0),[shown]);
 function keys(e:KeyboardEvent){
  if(e.key==='Escape'){e.stopPropagation();onClose();return;}
  if(e.key!=='Tab'||!root.current)return;
  const f=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,[href]')].filter(el=>el.offsetParent!==null);
  if(!f.length)return;const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
 }
 return <aside id={id} ref={root} className="agente-history" role="dialog" aria-label="Historial de chats" onKeyDown={keys}>
  <div className="agente-history-head"><h2>Historial</h2><Button size="sm" icon={<Icon name="close"/>} onClick={onClose}>Cerrar</Button></div>
  <div className="agente-history-tools"><Button size="sm" variant="primary" icon={<Icon name="plus"/>} onClick={onNew}>Chat nuevo</Button>
   <label className="sr-only" htmlFor={id+'-q'}>Buscar en el historial</label><input id={id+'-q'} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar en el historial"/></div>
  <p className="card-lead agente-note">Se guarda solo en este navegador. Las citas de clientes no se guardan.</p>
  {conversations.length===0?<p className="state" role="status">Aún no tienes chats guardados.</p>:shown.length===0?<p className="state" role="status">Ningún chat coincide con «{query}».</p>:
   groups.map(([label,list])=><section key={label} aria-label={label} className="agente-history-group"><h3 className="eyebrow">{label}</h3><ul>
    {list.map(c=><li key={c.id}>{editing===c.id?
     <form className="agente-rename" onSubmit={e=>{e.preventDefault();onRename(c.id,draft);setEditing(null);}}><label className="sr-only" htmlFor={id+'-r'}>Nuevo nombre</label><input id={id+'-r'} autoFocus value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(null);}}}/><span className="btn-group"><Button type="submit" size="sm" variant="primary">Guardar</Button><Button size="sm" onClick={()=>setEditing(null)}>Cancelar</Button></span></form>:
     <><Button className="agente-history-item" aria-current={c.id===activeId?'true':undefined} onClick={()=>onOpen(c.id)}><span className="agente-history-title">{c.title}</span></Button>
      <span className="btn-group"><Button size="sm" icon={<Icon name="edit"/>} aria-label={`Renombrar «${c.title}»`} onClick={()=>{setDraft(c.title);setEditing(c.id);}}>Renombrar</Button>
      <ConfirmationDialog triggerLabel="Borrar" title="¿Borrar este chat?" description={`Se borrará «${c.title}» de este navegador. No se puede deshacer.`} confirmLabel="Borrar chat" onConfirm={()=>onDelete(c.id)}/></span></>}</li>)}
   </ul></section>)}
 </aside>;
}
