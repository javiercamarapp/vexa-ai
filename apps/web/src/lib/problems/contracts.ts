import type {ProblemSummary,ProblemDetail,ProblemJob} from '../../../../../packages/problems/repository.mjs';
export type {ProblemSummary,ProblemDetail};
import type {EmbeddingBudget} from '../../../../../packages/problems/budget.mjs';
export type {EmbeddingBudget};
export type ProblemSnapshot={problems:ProblemSummary[];sources:{id:string;conversationId:string;createdAt:string}[];jobs:ProblemJob[];canSubmit:boolean;canRestructure:boolean;canConfigureBudget:boolean;budget:EmbeddingBudget|null;configuration:{ready:boolean;enabled:boolean}};
export type Match={embeddingId:string;problemId:string|null;distance:number};
