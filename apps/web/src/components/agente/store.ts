import type {Conversation} from './types';
import type {Clave} from '../../lib/i18n';
import {adjuntoSinContenido} from './attachments';
// Local-only history (this browser). Customer quotes are NOT persisted: citations are dropped on save and the message says so.
const MAX_CONVERSATIONS=50;
const key=(scope:string)=>`vexa-agent-chats:v1:${scope}`;
export function loadConversations(scope:string):Conversation[]{
 try{const raw=window.localStorage.getItem(key(scope));if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list))return [];return list.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(0,MAX_CONVERSATIONS);}catch{return [];}
}
export function saveConversations(scope:string,list:Conversation[]){
 const safe=list.slice(0,MAX_CONVERSATIONS).map(c=>({...c,messages:c.messages.map(m=>m.adjunto?{...m,adjunto:adjuntoSinContenido(m.adjunto)}:m.answer?.citations?.length?{...m,citationsOmitted:true,answer:{...m.answer,citations:[]}}:m)}));
 try{window.localStorage.setItem(key(scope),JSON.stringify(safe));}catch{/* Storage is optional: the chat keeps working in memory. */}
}
export const titleOf=(question:string)=>{const t=question.replace(/\s+/g,' ').trim();return t.length>60?t.slice(0,57)+'…':t;};
export function groupLabel(iso:string,now:Date=new Date()){
 const d=new Date(iso),day=(x:Date)=>Math.floor(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate())/86400000);
 const diff=day(now)-day(d);
 return diff<=0?'Hoy':diff===1?'Ayer':diff<=7?'Últimos 7 días':diff<=30?'Últimos 30 días':'Anteriores';
}
export const GROUPS=['Hoy','Ayer','Últimos 7 días','Últimos 30 días','Anteriores'];
/** Clave traducida de cada fase del agente (el texto en español es el identificador interno de la fase, ver PHASES en use-agente). */
export const PHASE_CLAVES:Record<string,Clave>={'Entendiendo tu pregunta…':'tr.ag.f1','Consultando tus datos…':'tr.ag.f2','Armando la respuesta…':'tr.ag.f3','Sigo trabajando en esto…':'tr.ag.f4'};
/** Etiqueta traducida de cada grupo (el texto en español es el identificador interno del grupo). */
export const GROUP_CLAVES:Record<string,Clave>={'Hoy':'nav.item.overview','Ayer':'tr.ag.gAyer','Últimos 7 días':'tr.ag.g7','Últimos 30 días':'tr.ag.g30','Anteriores':'tr.ag.gAnt'};
