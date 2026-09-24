export type EmbeddingReservation={id:string;jobId:string;purpose:'embedding';window:string;taskKey:string;state:string;heldMinor:string;actualMinor:string|null;reportedMinor:string;version:number};
export type EmbeddingBudget={window:string|null;limits:Array<{purpose:'all'|'embedding';limitMinor:string;version:number}>;reservations:EmbeddingReservation[]};
export function createProblemBudget(options:{database:any;window?:unknown}):{
 read():Promise<EmbeddingBudget>;
 configure(input:Record<string,unknown>):Promise<unknown>;
 reconcile(input:Record<string,unknown>):Promise<unknown>;
};
