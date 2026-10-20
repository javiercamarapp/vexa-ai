import type {Answer,Block,Coverage,Direct,Figure,SuggestionSet} from '../../../../../packages/agent-datos/index.mjs';
export type Feedback={verdict:'up'|'down';reason?:string;persisted:boolean};
export type ChatMessage={id:string;role:'user'|'assistant';text:string;at:string;question?:string;directa?:Direct;answer?:Answer;cancelled?:boolean;citationsOmitted?:boolean;feedback?:Feedback};
export type Conversation={id:string;title:string;updatedAt:string;messages:ChatMessage[]};
export type AgentState={available:boolean;mode:string;role:string;canSeeEvidence:boolean;suggestions:SuggestionSet;limits:{maxQuestionChars:number;maxHistory:number;maxTurnsPerConversation:number};note:string;scope:string;toolLabels:Record<string,string>};
export type Step={tool:string;done:boolean};
export type {Answer,Block,Coverage,Direct,Figure,SuggestionSet};
