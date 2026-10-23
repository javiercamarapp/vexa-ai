import type {ProblemSummary as RepoSummary,ProblemDetail as RepoDetail,ProblemJob} from '../../../../../packages/problems/repository.mjs';
/** Lo que recibe el navegador (ver proyeccion.mjs): conteos para todos; ids y datos técnicos solo para el propietario. */
type Conteos={conversationCount?:number;embeddingCount?:number;orderCount?:number};
export type ProblemSummary=RepoSummary&Conteos;
export type ProblemDetail=RepoDetail&Conteos;
import type {EmbeddingBudget} from '../../../../../packages/problems/budget.mjs';
export type {EmbeddingBudget};
export type ProblemSnapshot={problems:ProblemSummary[];sources:{id:string;conversationId:string;createdAt:string}[];jobs:ProblemJob[];canSubmit:boolean;canRestructure:boolean;canConfigureBudget:boolean;budget:EmbeddingBudget|null;configuration:{ready:boolean;enabled:boolean};verification?:{mode:'summary'|'full';note:string}};
export type Match={embeddingId:string;problemId:string|null;distance:number};
