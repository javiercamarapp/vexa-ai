import type {Recommendation, RecommendationList} from './index.mjs';
import type {FlowEvent, Etapa} from './flujo.mjs';
export type FlowRecommendation = Recommendation & {priorityBase: string; flow: {available: boolean; role: string; events: FlowEvent[]; etapa: Etapa; interventionId: string | null}};
export type FlowList = Omit<RecommendationList, 'items'> & {flowAvailable: boolean; items: FlowRecommendation[]};
export function createFlowRepository(options: {database: any; recommendations: any; interventions?: any; ahora?: () => Date}): {
  list(input: {query: URLSearchParams}): Promise<FlowList>;
  get(input: {id: string}): Promise<FlowRecommendation>;
  approve(input: {id: string; expectedVersion: number; ownerId: string; dueDate: string; comment?: string; requestKey: string}): Promise<FlowRecommendation>;
  adjust(input: {id: string; expectedVersion: number; action: string; rationale: string; preconditions: string[]; ownerId?: string | null; priority?: string | null; comment: string; requestKey: string}): Promise<FlowRecommendation>;
  start(input: {id: string; expectedVersion: number; comment?: string; requestKey: string}): Promise<FlowRecommendation>;
  resolve(input: {id: string; expectedVersion: number; outcome: string; note: string; requestKey: string}): Promise<FlowRecommendation>;
};
