export type OperationalEvidence={id:string;recordId:string;version:number;status:'active'|'withdrawn';sourceKind:'inspection'|'lab'|'carrier_record';observedAt:string;report:string;digest:string;stance:'supports'|'contradicts';facts:{batch:string|null;carrier:string|null;sku:string|null};actorId:string;createdAt:string};
export type CauseClaim={version:number;symptom:string;probableCause:string|null;state:'unassessed'|'hypothesis'|'confirmed'|'retracted';evidenceIds:string[];reason:string;actorId:string|null;facts:{batch:string|null;carrier:string|null;sku:string|null};criticalReview:boolean};
export type CauseView={problemId:string;claim:CauseClaim;evidence:OperationalEvidence[];history:CauseClaim[];canRecord:boolean;canConfirm:boolean};
export function createCausalityRepository(options:{database:any}):{
 get(input:{problemId:string}):Promise<CauseView>;
 recordEvidence(input:{problemId:string;expectedVersion:number;expectedEvidenceVersion:number;recordId:string;sourceKind:'inspection'|'lab'|'carrier_record';observedAt:string;report:string;stance:'supports'|'contradicts';facts:{batch:string|null;carrier:string|null;sku:string|null};status:'active'|'withdrawn';attested:true}):Promise<CauseView>;
 revise(input:{problemId:string;expectedVersion:number;symptom:string;probableCause:string|null;state:'hypothesis'|'confirmed'|'retracted';evidenceIds:string[];reason:string;approved:true}):Promise<CauseView>;
};
