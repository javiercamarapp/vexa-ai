/** Server-owned 100-chunk cap within the CRM time slice; requests cannot override it. */
export function createCRMHostedHandler(options:{runtime:()=>Promise<any>;secret?:string;timeoutMs?:number;afterWork?:(database:any,result:any,info:{startedAt:number})=>Promise<unknown>}):(request:Request)=>Promise<Response>;
