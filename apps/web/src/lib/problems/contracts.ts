import type {ProblemSummary,ProblemDetail,ProblemJob} from '../../../../../packages/problems/repository.mjs';
export type {ProblemSummary,ProblemDetail};
export type ProblemSnapshot={problems:ProblemSummary[];sources:{id:string;conversationId:string;createdAt:string}[];jobs:ProblemJob[];canSubmit:boolean;canRestructure:boolean;configuration:{ready:boolean;enabled:boolean}};
export type Match={embeddingId:string;problemId:string|null;distance:number};
