'use client';
import {useMemo,useState} from 'react';
import {Drawer} from '../ui/overlay';
import {Button} from '../ui/button';
import {ConfirmationDialog} from '../confirmation-dialog';
import {Icon} from './icons';
import {GROUPS,groupLabel} from './store';
import type {Conversation} from './types';
const plain=(t:string)=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Panel «Historial» (Drawer del sistema): chats agrupados por día, buscador, renombrar y borrar con confirmación (acciones al pasar el cursor).
 *  Los chats viven solo en este navegador. Esc cierra, el foco queda atrapado y vuelve al botón «Historial»; en pantallas angostas ocupa toda la pantalla. */
export function HistoryPanel({id,conversations,activeId,leaving,onNew,onOpen,onRename,onDelete,onClose}:{id:string;conversations:Conversation[];activeId:string|null;leaving:boolean;onNew:()=>void;onOpen:(id:string)=>void;onRename:(id:string,title:string)=>void;onDelete:(id:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState('');
 const shown=useMemo(()=>conversations.filter(c=>!query.trim()||plain(c.title).includes(plain(query))),[conversations,query]);
 const groups=useMemo(()=>GROUPS.map(g=>[g,shown.filter(c=>groupLabel(c.updatedAt)===g)] as const).filter(([,list])=>list.length>0),[shown]);
 return <Drawer id={id} open={!leaving} onClose={onClose} size="sm" title="Historial" subtitle={conversations.length?`${conversations.length} ${conversations.length===1?'chat guardado':'chats guardados'} en este navegador`:'Aún sin chats guardados'}
  footer={<p className="ov-foot-note">Se guardan solo en este navegador. Las citas de clientes y el contenido de los adjuntos no se guardan.</p>}>
  <div className="ov-pair agente-hist-top"><button type="button" className="btn btn-primary" onClick={onNew}><Icon name="edit" size={14}/>Chat nuevo</button>
   <label className="ov-search"><Icon name="search" size={14}/><span className="sr-only">Buscar en el historial</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar chats" aria-label="Buscar chats"/></label></div>
  {conversations.length===0?<p className="ov-help" role="status">Aún no tienes chats guardados.</p>:shown.length===0?<p className="ov-help" role="status">Ningún chat coincide con «{query}».</p>:
   groups.map(([label,list])=><section key={label} aria-label={label} className="ov-group"><h3 className="ov-group-title">{label}</h3><ul className="ov-rows">
    {list.map(c=><li key={c.id} className="ov-row">{editing===c.id?
     <form className="agente-rename" onSubmit={e=>{e.preventDefault();onRename(c.id,draft);setEditing(null);}}><label className="sr-only" htmlFor={id+'-r'}>Nuevo nombre</label><input id={id+'-r'} autoFocus value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(null);}}}/><span className="btn-group"><Button type="submit" size="sm" variant="primary">Guardar</Button><Button size="sm" onClick={()=>setEditing(null)}>Cancelar</Button></span></form>:
     <><button type="button" className="ov-row-main" aria-current={c.id===activeId?'true':undefined} onClick={()=>onOpen(c.id)} title={c.title}><span className="ov-row-title">{c.title}</span></button>
      <span className="ov-row-actions"><button type="button" className="icon-btn agente-icon-sm" aria-label={`Renombrar «${c.title}»`} title="Renombrar" onClick={()=>{setDraft(c.title);setEditing(c.id);}}><Icon name="edit" size={14}/></button>
      <ConfirmationDialog triggerLabel="Borrar" title="¿Borrar este chat?" description={`Se borrará «${c.title}» de este navegador. No se puede deshacer.`} confirmLabel="Borrar chat" onConfirm={()=>onDelete(c.id)}/></span></>}</li>)}
   </ul></section>)}
 </Drawer>;
}
