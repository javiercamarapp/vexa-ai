export type ProblemSummary={id:string;label:string;version:number;state:'active'|'retired';outlier:boolean;modelId:string;dimensions:number;embeddingVersion:string;embeddingIds:string[];conversationIds:string[];orderIds:string[]};
export type ProblemDetail=ProblemSummary&{history:Array<{id:string;version:number;provenance:Record<string,unknown>}>};
export type ProblemJob={id:string;extractionRunId:string;state:string;reason:string|null;createdAt:string};
export function createProblemRepository(options:{database:any}):{
 list():Promise<ProblemSummary[]>;
 detail(input:{problemId:string}):Promise<ProblemDetail>;
 sources():Promise<Array<{id:string;conversationId:string;createdAt:string}>>;
 jobs():Promise<ProblemJob[]>;
 submit(input:{extractionRunId:string;requestKey:string;configHash:string}):Promise<ProblemJob>;
 retrieve(input:{embeddingId:string;limit?:number}):Promise<Array<{embeddingId:string;problemId:string|null;distance:number}>>;
 restructure(input:{operation:'split'|'merge';parents:Array<{problemId:string;expectedVersion:number}>;children:Array<{label:string;embeddingIds:string[]}>;reason:string;approved:true}):Promise<ProblemSummary[]>;
};
