export type ModelCatalog = {version:string; fetchedAt:string; expiresAt:string; models:Array<{id:string;contextTokens:number;supportedParameters:string[]}>};
export function validCatalog(value:unknown,now?:number):value is ModelCatalog;
export function catalogModel(catalog:unknown,id:string,now?:number):ModelCatalog['models'][number]|null;
export function parseModelCatalog(body:unknown,options?:{fetchedAt?:number;ttlMs?:number}):ModelCatalog;
export function fetchModelCatalog(options?:{fetch?:typeof fetch;clock?:()=>number;ttlMs?:number;timeoutMs?:number}):Promise<ModelCatalog>;
