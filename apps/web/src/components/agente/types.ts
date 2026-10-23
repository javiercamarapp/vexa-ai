import type {AdjuntoResumen} from './attachments';
import type {Answer,TraceStep,Block,Coverage,Direct,Figure,SuggestionSet} from '../../../../../packages/agent-datos/index.mjs';
export type Feedback={verdict:'up'|'down';reason?:string;persisted:boolean};
export type ChatMessage={id:string;role:'user'|'assistant';kind?:'adjunto';adjunto?:AdjuntoResumen;text:string;at:string;modo?:string;question?:string;directa?:Direct;answer?:Answer;cancelled?:boolean;citationsOmitted?:boolean;feedback?:Feedback};
export type Conversation={id:string;title:string;updatedAt:string;messages:ChatMessage[]};
export type AgentState={available:boolean;mode:string;role:string;canSeeEvidence:boolean;suggestions:SuggestionSet;limits:{maxQuestionChars:number;maxHistory:number;maxTurnsPerConversation:number};note:string;scope:string;toolLabels:Record<string,string>};
/** One live step of a turn, built ONLY from events the server emitted (tool calls, timings, sources): never model text. */
export type Step={id:string;kind:'plan'|'tool'|'compose'|'verify';tool?:string;label:string;done:boolean;estado?:string;ms?:number|null;detail?:string;cifras?:number;fuentes?:string[]};
export type {TraceStep,Answer,Block,Coverage,Direct,Figure,SuggestionSet};
