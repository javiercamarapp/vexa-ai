'use client';
import {useMemo,useState} from 'react';
import {Drawer} from '../ui/overlay';
import {useT} from '../i18n/proveedor';
import {Ctl} from './ctl';
import {ConfirmationDialog} from '../confirmation-dialog';
import {Icon} from './icons';
import {GROUPS,groupLabel} from './store';
import type {Conversation} from './types';
const plain=(t:string)=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Panel «Historial» (Drawer del sistema): chats agrupados por día, buscador, renombrar y borrar con confirmación (acciones al pasar el cursor).
 *  Los chats viven solo en este navegador. Esc cierra, el foco queda atrapado y vuelve al botón «Historial»; en pantallas angostas ocupa toda la pantalla. */
export function HistoryPanel({id,conversations,activeId,leaving,onNew,onOpen,onRename,onDelete,onClose}:{id:string;conversations:Conversation[];activeId:string|null;leaving:boolean;onNew:()=>void;onOpen:(id:string)=>void;onRename:(id:string,title:string)=>void;onDelete:(id:string)=>void;onClose:()=>void}){
 const tx=useT();
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState('');
 const shown=useMemo(()=>conversations.filter(c=>!query.trim()||plain(c.title).includes(plain(query))),[conversations,query]);
 const groups=useMemo(()=>GROUPS.map(g=>[g,shown.filter(c=>groupLabel(c.updatedAt)===g)] as const).filter(([,list])=>list.length>0),[shown]);
 return <Drawer id={id} open={!leaving} onClose={onClose} size="sm" title={tx('ag.hTitulo')} subtitle={conversations.length?tx('ag.hSub',{n:conversations.length,x:conversations.length===1?tx('ag.hUno'):tx('ag.hVarios')}):tx('ag.hSinChats')}
  footer={<p className="ov-foot-note">{tx('ag.hPie')}</p>}>
  <div className="ov-pair agente-hist-top"><Ctl variant="soft" onClick={onNew} icon={<Icon name="edit" size={14}/>}>{tx('ag.hNuevo')}</Ctl>
   <label className="ov-search"><Icon name="search" size={14}/><span className="sr-only">{tx('ag.hBuscarLabel')}</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tx('ag.hBuscar')} aria-label={tx('ag.hBuscar')}/></label></div>
  {conversations.length===0?<p className="ov-help" role="status">{tx('ag.hVacio')}</p>:shown.length===0?<p className="ov-help" role="status">{tx('ag.hNinguno',{q:query})}</p>:
   groups.map(([label,list])=><section key={label} aria-label={label} className="ov-group"><h3 className="ov-group-title">{label}</h3><ul className="ov-rows">
    {list.map(c=><li key={c.id} className="ov-row">{editing===c.id?
     <form className="agente-rename" onSubmit={e=>{e.preventDefault();onRename(c.id,draft);setEditing(null);}}><label className="sr-only" htmlFor={id+'-r'}>{tx('ag.hNuevoNombre')}</label><input id={id+'-r'} autoFocus value={draft} maxLength={80} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(null);}}}/><span className="btn-group"><Ctl type="submit" variant="soft">{tx('ag.hGuardar')}</Ctl><Ctl onClick={()=>setEditing(null)}>{tx('ag.hCancelar')}</Ctl></span></form>:
     <><button type="button" className="ov-row-main" aria-current={c.id===activeId?'true':undefined} onClick={()=>onOpen(c.id)} title={c.title}><span className="ov-row-title">{c.title}</span></button>
      <span className="ov-row-actions"><button type="button" className="icon-btn agente-icon-sm" aria-label={tx('ag.hRenombrarDe',{t:c.title})} title={tx('ag.hRenombrar')} onClick={()=>{setDraft(c.title);setEditing(c.id);}}><Icon name="edit" size={14}/></button>
      <ConfirmationDialog triggerLabel={tx('ag.hBorrar')} title={tx('ag.hBorrarTit')} description={tx('ag.hBorrarDesc',{t:c.title})} confirmLabel={tx('ag.hBorrarChat')} onConfirm={()=>onDelete(c.id)}/></span></>}</li>)}
   </ul></section>)}
 </Drawer>;
}
