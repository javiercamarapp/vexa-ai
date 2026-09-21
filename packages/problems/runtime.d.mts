export function createProblemConfigResolver(raw?:string):(tenantId:string)=>{hash:string;modelId:string;dimensions:number;version:string;threshold:number;gateway:any};
export function createProblemRuntime(options:{database:any;resolveConfig:(tenantId:string)=>any;apiKey?:string;runtime?:string;fetch?:typeof fetch}):{tick():Promise<{state:string;id?:string;reason?:string}>};
