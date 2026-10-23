import type {Answer} from '../agente/types';
export type RespuestaCfo = {mode: 'directa' | 'ia' | 'rechazada' | 'sin_ia'; answer: string; steps: {tool: string; label: string; status: string; error?: string}[]; citations: {label: string; href: string}[]; figures: {id: string; label: string; display: string; kind: string; coverage: string | null; scope: string | null; tool?: string}[]; costMicro?: string; guard?: {ok: boolean; violations: string[]}; budget?: {spent: string; cap: string; pctBps: number | null; exhausted: boolean}};
export function esFueraDeCfo(reply: RespuestaCfo | null | undefined): boolean;
export function adaptarRespuestaCfo(reply: RespuestaCfo, opts?: {sugerencias?: string[]; descripciones?: Record<string, string>}): Answer;
export function cuerpoConsultaCfo(input?: {question?: string; history?: {role: string; text: string}[]; directa?: {tool: string; args?: Record<string, unknown>}}): Record<string, unknown>;
export function esPreguntaDeCfo(question: string): boolean;
